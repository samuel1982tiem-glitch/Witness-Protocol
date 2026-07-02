import { zipSync, unzipSync, type Zippable } from "fflate"
import {
  encryptJSON,
  decryptJSON,
  encryptRaw,
  decryptRaw,
  compress,
  decompress,
  deriveKey,
} from "./crypto"
import { Filesystem, Directory } from "@capacitor/filesystem"
import {
  exportAllRecords,
  exportMetadataOnly,
  exportEvidenceBlobs,
  importAllRecords,
  mergeIncidentRecords,
  type VaultBackup,
  type MergeProgress,
  type MergeResult,
} from "./repo"
import {
  getRecord,
  putRecord,
  STORES,
  type VaultRecord,
  type IncidentRecord,
  type EvidenceRecord,
} from "./db"

// ---------------------------------------------------------------------------
// Shared binary coercion helpers
// ---------------------------------------------------------------------------

function toUint8(val: any): Uint8Array {
  if (val instanceof Uint8Array) return val
  if (Array.isArray(val)) return new Uint8Array(val)
  if (val && typeof val === "object") return new Uint8Array(Object.values(val))
  return new Uint8Array(0)
}

function reviveBuffers(backup: VaultBackup): VaultBackup {
  for (const incident of backup.incidents ?? []) {
    incident.iv = toUint8(incident.iv)
    incident.data = toUint8(incident.data) as any
  }
  for (const evidence of backup.evidence ?? []) {
    evidence.iv = toUint8(evidence.iv)
    evidence.data = toUint8(evidence.data) as any
  }
  for (const alert of backup.alerts ?? []) {
    if (alert.iv != null) alert.iv = toUint8(alert.iv)
    if (alert.data != null) alert.data = toUint8(alert.data)
  }
  for (const user of backup.users ?? []) {
    if ("salt" in user) user.salt = toUint8((user as any).salt)
    if ("verifierIv" in user) (user as any).verifierIv = toUint8((user as any).verifierIv)
    if ("verifierData" in user) (user as any).verifierData = toUint8((user as any).verifierData) as any
  }
  for (const profile of backup.userProfile ?? []) {
    if (profile.iv != null) profile.iv = toUint8(profile.iv)
    if (profile.data != null) profile.data = toUint8(profile.data)
  }
  return backup
}

// ---------------------------------------------------------------------------
// File format detection
// ---------------------------------------------------------------------------

function detectFileFormat(
  bytes: Uint8Array,
  fileName?: string,
): "png" | "zip" | "json" | "unknown" {
  if (bytes.length < 4) return "json"

  // PNG
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png"
  }

  // ZIP / .wpbz
  if (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  ) {
    return "zip"
  }

  try {
    const text = new TextDecoder().decode(bytes.slice(0, 32))
    const trimmed = text.trimStart()
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json"
  } catch {
    // ignore
  }

  if (fileName?.endsWith(".wpbz")) return "zip"
  if (fileName?.endsWith(".wpb")) return "json"

  return "unknown"
}

// ---------------------------------------------------------------------------
// Version 3 (.wpb) legacy JSON backup
// ---------------------------------------------------------------------------

async function exportVaultBackupV3(key: CryptoKey): Promise<string> {
  const backup = await exportAllRecords()
  const encrypted = await encryptJSON(key, backup)

  const vault = await getRecord<VaultRecord>(STORES.users, "vault")

  const payload = {
    version: 3,
    exportedAt: Date.now(),
    salt: vault ? Array.from(vault.salt) : undefined,
    iv: Array.from(encrypted.iv),
    data: Array.from(new Uint8Array(encrypted.data as ArrayBuffer)),
  }

  const fileName =
    "WitnessProtocolBackup-" +
    new Date().toISOString().replace(/[:.]/g, "-") +
    ".wpb"

  await Filesystem.writeFile({
    path: fileName,
    data: JSON.stringify(payload),
    directory: Directory.Documents,
    encoding: "utf8",
    recursive: true,
  })

  return fileName
}

async function importVaultBackupV3(
  raw: any,
  passcode: string,
): Promise<{ key: CryptoKey; autoLockMs: number }> {
  if (!raw.salt) {
    throw new Error(
      "This backup was created with an older version of the app. Please export a new backup from your previous device first.",
    )
  }

  const salt = new Uint8Array(raw.salt as number[])
  const key = await deriveKey(passcode, salt)

  const iv = new Uint8Array(raw.iv as number[])
  const dataBytes = new Uint8Array(raw.data as number[])

  let backup: VaultBackup
  try {
    backup = await decryptJSON<VaultBackup>(key, { iv, data: dataBytes })
  } catch (err) {
    throw new Error(
      "Incorrect passcode or corrupted backup file. (" + String(err) + ")",
    )
  }

  const revived = reviveBuffers(backup)

  const currentVault = await getRecord<VaultRecord>(STORES.users, "vault")
  try {
    await importAllRecords(revived)
  } catch (err) {
    if (currentVault) await putRecord(STORES.users, currentVault)
    throw err
  }

  return { key, autoLockMs: 3 * 60 * 1000 }
}

// ---------------------------------------------------------------------------
// Version 4 (.wpbz) ZIP backup
// ---------------------------------------------------------------------------

interface ManifestV4 {
  version: 4
  exportedAt: number
  salt: number[]
  evidenceCount: number
}

interface EvidenceSidecar {
  id: string
  incidentId: string
  kind: string
  mimeType: string
  size: number
  sha256: string
  createdAt: number
  name: string
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

export async function exportVaultBackupV4(key: CryptoKey): Promise<string> {
  const vault = await getRecord<VaultRecord>(STORES.users, "vault")
  if (!vault) throw new Error("Vault is not set up.")

  const backup = await exportMetadataOnly()
  const metaPlain = new TextEncoder().encode(JSON.stringify(backup))
  const metaCompressed = await compress(metaPlain)
  const metaEncrypted = await encryptRaw(key, metaCompressed)

  const evidenceBlobs = await exportEvidenceBlobs(key)

  const zipEntries: Zippable = {
    "manifest.json": new TextEncoder().encode(
      JSON.stringify({
        version: 4,
        exportedAt: Date.now(),
        salt: Array.from(vault.salt),
        evidenceCount: evidenceBlobs.length,
      } satisfies ManifestV4),
    ),
    "meta.json.enc": metaEncrypted,
  }

  for (const blob of evidenceBlobs) {
    const encrypted = await encryptRaw(key, blob.raw)
    zipEntries[`evidence/${blob.record.id}.enc`] = encrypted
    zipEntries[`evidence/${blob.record.id}.json`] = new TextEncoder().encode(
      JSON.stringify({
        id: blob.record.id,
        incidentId: blob.record.incidentId,
        kind: blob.record.kind,
        mimeType: blob.record.mimeType,
        size: blob.record.size,
        sha256: blob.record.sha256,
        createdAt: blob.record.createdAt,
        name: blob.name,
      }),
    )
  }

  const zipped = zipSync(zipEntries, { level: 0 })

  const fileName =
    "WitnessProtocolBackup-" +
    new Date().toISOString().replace(/[:.]/g, "-") +
    ".wpbz"

  await Filesystem.writeFile({
    path: fileName,
    data: uint8ToBase64(zipped),
    directory: Directory.Documents,
    recursive: true,
  })

  return fileName
}

async function importVaultBackupV4(
  zipBytes: Uint8Array,
  passcode: string,
): Promise<{ key: CryptoKey; autoLockMs: number }> {
  const files = unzipSync(zipBytes)

  const manifestBytes = files["manifest.json"]
  if (!manifestBytes) {
    throw new Error("Backup file is missing manifest.json — file may be corrupted.")
  }

  const manifest: ManifestV4 = JSON.parse(
    new TextDecoder().decode(manifestBytes),
  )

  if (manifest.version !== 4) {
    throw new Error(`Unsupported backup version: ${manifest.version}`)
  }

  const salt = new Uint8Array(manifest.salt)
  const key = await deriveKey(passcode, salt)

  const metaEncrypted = files["meta.json.enc"]
  if (!metaEncrypted) {
    throw new Error("Backup file is missing meta.json.enc — file may be corrupted.")
  }

  let metaPlain: Uint8Array
  try {
    const metaCompressed = await decryptRaw(key, metaEncrypted)
    metaPlain = await decompress(metaCompressed)
  } catch (err) {
    throw new Error(
      "Incorrect passcode or corrupted backup file. (" + String(err) + ")",
    )
  }

  const meta = JSON.parse(new TextDecoder().decode(metaPlain)) as Omit<
    VaultBackup,
    "evidence"
  >

  const evidenceRecords: EvidenceRecord[] = []
  const evidencePaths = Object.keys(files).filter(
    (p) => p.startsWith("evidence/") && p.endsWith(".enc"),
  )

  for (const path of evidencePaths) {
    const id = path.slice("evidence/".length, path.length - ".enc".length)
    const sidecarPath = `evidence/${id}.json`
    const sidecarBytes = files[sidecarPath]
    if (!sidecarBytes) continue

    let sidecar: EvidenceSidecar
    try {
      sidecar = JSON.parse(new TextDecoder().decode(sidecarBytes))
    } catch {
      continue
    }

    const blob = files[path]
    if (!blob || blob.byteLength < 13) continue

    const iv = blob.slice(0, 12)
    const ciphertext = blob.slice(12)

    evidenceRecords.push({
      id: sidecar.id,
      incidentId: sidecar.incidentId,
      kind: sidecar.kind,
      mimeType: sidecar.mimeType,
      size: sidecar.size,
      sha256: sidecar.sha256,
      createdAt: sidecar.createdAt,
      iv,
      data: ciphertext.buffer.slice(
        ciphertext.byteOffset,
        ciphertext.byteOffset + ciphertext.byteLength,
      ),
    } as EvidenceRecord)
  }

  const fullBackup: VaultBackup = {
    version: meta.version,
    exportedAt: meta.exportedAt,
    incidents: meta.incidents ?? [],
    evidence: evidenceRecords,
    alerts: meta.alerts ?? [],
    users: meta.users ?? [],
    userProfile: meta.userProfile ?? [],
    seals: meta.seals ?? [],
  }

  const revived = reviveBuffers(fullBackup)

  const currentVault = await getRecord<VaultRecord>(STORES.users, "vault")
  try {
    await importAllRecords(revived)
  } catch (err) {
    if (currentVault) await putRecord(STORES.users, currentVault)
    throw err
  }

  return { key, autoLockMs: 3 * 60 * 1000 }
}

// ---------------------------------------------------------------------------
// Public export/import API
// ---------------------------------------------------------------------------

export async function exportVaultBackup(key: CryptoKey): Promise<string> {
  return exportVaultBackupV4(key)
}

export async function importVaultBackupFresh(
  file: File,
  passcode: string,
): Promise<{ key: CryptoKey; autoLockMs: number }> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const format = detectFileFormat(bytes, file.name)

  if (format === "png") {
    throw new Error(
      "This file is an image (PNG), not a valid backup file. Please select a .wpb or .wpbz file.",
    )
  }

  if (format === "unknown") {
    throw new Error(
      "This file format is not recognized. Please select a valid backup file (.wpb or .wpbz).",
    )
  }

  if (format === "zip") {
    return importVaultBackupV4(bytes, passcode)
  }

  if (format === "json") {
    try {
      const text = new TextDecoder().decode(bytes)
      const raw = JSON.parse(text)
      return importVaultBackupV3(raw, passcode)
    } catch {
      throw new Error(
        "The file is not a valid JSON backup. Please ensure you selected the correct file.",
      )
    }
  }

  throw new Error(
    "Unable to determine file format. Please select a valid backup file (.wpb or .wpbz).",
  )
}

// ---------------------------------------------------------------------------
// Merge import
// ---------------------------------------------------------------------------

interface ParsedBackup {
  sourceKey: CryptoKey
  incidents: IncidentRecord[]
  evidence: EvidenceRecord[]
}

async function parseVaultBackupV3(
  raw: any,
  passcode: string,
): Promise<ParsedBackup> {
  if (!raw.salt) {
    throw new Error(
      "This backup was created with an older version of the app. Please export a new backup from your previous device first.",
    )
  }

  const salt = new Uint8Array(raw.salt as number[])
  const sourceKey = await deriveKey(passcode, salt)

  const iv = new Uint8Array(raw.iv as number[])
  const dataBytes = new Uint8Array(raw.data as number[])

  let backup: VaultBackup
  try {
    backup = await decryptJSON<VaultBackup>(sourceKey, { iv, data: dataBytes })
  } catch (err) {
    throw new Error(
      "Incorrect passcode or corrupted backup file. (" + String(err) + ")",
    )
  }

  const revived = reviveBuffers(backup)

  return {
    sourceKey,
    incidents: revived.incidents as unknown as IncidentRecord[],
    evidence: revived.evidence as unknown as EvidenceRecord[],
  }
}

async function parseVaultBackupV4(
  zipBytes: Uint8Array,
  passcode: string,
): Promise<ParsedBackup> {
  const files = unzipSync(zipBytes)

  const manifestBytes = files["manifest.json"]
  if (!manifestBytes) {
    throw new Error("Backup file is missing manifest.json — file may be corrupted.")
  }

  const manifest: ManifestV4 = JSON.parse(
    new TextDecoder().decode(manifestBytes),
  )

  if (manifest.version !== 4) {
    throw new Error(`Unsupported backup version: ${manifest.version}`)
  }

  const salt = new Uint8Array(manifest.salt)
  const sourceKey = await deriveKey(passcode, salt)

  const metaEncrypted = files["meta.json.enc"]
  if (!metaEncrypted) {
    throw new Error("Backup file is missing meta.json.enc — file may be corrupted.")
  }

  let metaPlain: Uint8Array
  try {
    const metaCompressed = await decryptRaw(sourceKey, metaEncrypted)
    metaPlain = await decompress(metaCompressed)
  } catch (err) {
    throw new Error(
      "Incorrect passcode or corrupted backup file. (" + String(err) + ")",
    )
  }

  const meta = JSON.parse(new TextDecoder().decode(metaPlain)) as Omit<
    VaultBackup,
    "evidence"
  >

  const evidenceRecords: EvidenceRecord[] = []
  const evidencePaths = Object.keys(files).filter(
    (p) => p.startsWith("evidence/") && p.endsWith(".enc"),
  )

  for (const path of evidencePaths) {
    const id = path.slice("evidence/".length, path.length - ".enc".length)
    const sidecarPath = `evidence/${id}.json`
    const sidecarBytes = files[sidecarPath]
    if (!sidecarBytes) continue

    let sidecar: EvidenceSidecar
    try {
      sidecar = JSON.parse(new TextDecoder().decode(sidecarBytes))
    } catch {
      continue
    }

    const blob = files[path]
    if (!blob || blob.byteLength < 13) continue

    const iv = blob.slice(0, 12)
    const ciphertext = blob.slice(12)

    evidenceRecords.push({
      id: sidecar.id,
      incidentId: sidecar.incidentId,
      kind: sidecar.kind,
      mimeType: sidecar.mimeType,
      size: sidecar.size,
      sha256: sidecar.sha256,
      createdAt: sidecar.createdAt,
      iv,
      data: ciphertext.buffer.slice(
        ciphertext.byteOffset,
        ciphertext.byteOffset + ciphertext.byteLength,
      ),
    } as EvidenceRecord)
  }

  return {
    sourceKey,
    incidents: (meta.incidents ?? []) as unknown as IncidentRecord[],
    evidence: evidenceRecords,
  }
}

export async function mergeVaultBackup(
  file: File,
  passcode: string,
  currentKey: CryptoKey,
  onProgress?: (progress: MergeProgress) => void,
): Promise<MergeResult> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const format = detectFileFormat(bytes, file.name)

  if (format === "png") {
    throw new Error(
      "This file is an image (PNG), not a valid backup file. Please select a .wpb or .wpbz file.",
    )
  }

  if (format === "unknown") {
    throw new Error(
      "This file format is not recognized. Please select a valid backup file (.wpb or .wpbz).",
    )
  }

  let parsed: ParsedBackup

  if (format === "zip") {
    parsed = await parseVaultBackupV4(bytes, passcode)
  } else if (format === "json") {
    try {
      const text = new TextDecoder().decode(bytes)
      const raw = JSON.parse(text)
      parsed = await parseVaultBackupV3(raw, passcode)
    } catch {
      throw new Error(
        "The file is not a valid JSON backup. Please ensure you selected the correct file.",
      )
    }
  } else {
    throw new Error(
      "Unable to determine file format. Please select a valid backup file (.wpb or .wpbz).",
    )
  }

  return mergeIncidentRecords(
    parsed.sourceKey,
    currentKey,
    parsed.incidents,
    parsed.evidence,
    onProgress,

  )
}