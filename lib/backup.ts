import { zipSync, unzipSync, type Zippable } from "fflate"
import {
  encryptJSON,
  decryptJSON,
  encryptRaw,
  decryptRaw,
  compress,
  decompress,
  deriveKey,
  type CipherPayload,
} from "./crypto"
import { Filesystem, Directory } from "@capacitor/filesystem"
import {
  exportAllRecords,
  exportEvidenceBlobs,
  importAllRecords,
  mergeIncidentRecords,
  saveEvidence,
  type VaultBackup,
  type EvidenceInput,
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

// Safely convert any value coming out of JSON.parse to a Uint8Array.
// Handles: real Uint8Array, plain JS Array [255,12,...],
// and plain object {0:255, 1:12} which Android WebView IDB can produce.
function toUint8(val: any): Uint8Array {
  if (val instanceof Uint8Array) return val
  if (Array.isArray(val)) return new Uint8Array(val)
  if (val && typeof val === "object") return new Uint8Array(Object.values(val))
  return new Uint8Array(0)
}

function reviveBuffers(backup: VaultBackup): VaultBackup {
  // Store EVERYTHING as Uint8Array, never ArrayBuffer.
  // Android WebView IndexedDB stores and retrieves Uint8Array correctly,
  // but silently mangles ArrayBuffer on read-back, causing "data too small".
  // toCipherPayload in db.ts converts Uint8Array → ArrayBuffer for Web Crypto.
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
    if ("salt" in user) user.salt = toUint8(user.salt)
    if ("verifierIv" in user) user.verifierIv = toUint8(user.verifierIv)
    if ("verifierData" in user) user.verifierData = toUint8(user.verifierData) as any
  }
  for (const profile of backup.userProfile ?? []) {
    if (profile.iv != null) profile.iv = toUint8(profile.iv)
    if (profile.data != null) profile.data = toUint8(profile.data)
  }
  return backup
}

// ---------------------------------------------------------------------------
// File format detection (ADDED)
// ---------------------------------------------------------------------------

/**
 * Detect the format of the uploaded backup file.
 * Returns one of: 'png', 'zip', 'json', 'unknown'
 * 
 * This prevents PNG images from being parsed as JSON, which was causing:
 *   SyntaxError: Unexpected token '👁', "👁️PNG"… is not valid JSON
 */
function detectFileFormat(bytes: Uint8Array, fileName?: string): 'png' | 'zip' | 'json' | 'unknown' {
  if (bytes.length < 4) {
    return 'json' // Assume JSON for very small files
  }

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'png'
  }

  // ZIP: 50 4B 03 04 (including .wpbz)
  if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'zip'
  }

  // JSON: starts with { or [
  try {
    const text = new TextDecoder().decode(bytes.slice(0, 20))
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      return 'json'
    }
  } catch (_) {
    // ignore
  }

  // If it's a .wpbz but we didn't detect ZIP (corrupted), trust the extension
  if (fileName && fileName.endsWith('.wpbz')) {
    return 'zip'
  }

  return 'unknown'
}

// ---------------------------------------------------------------------------
// Version 3 (.wpb) — legacy JSON format, kept for backwards compatibility
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
      "This backup was created with an older version of the app. " +
        "Please export a new backup from your previous device first.",
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
// Version 4 (.wpbz) — ZIP container, compressed metadata, raw-binary evidence
// ---------------------------------------------------------------------------
//
// Layout inside the ZIP:
//   manifest.json     — unencrypted: version, salt, exportedAt, counts
//   meta.json.enc      — encrypted+compressed: incidents/users/alerts/seals/profile
//   evidence/<id>.enc — encrypted raw bytes per evidence file (no compression;
//                        media formats like JPG/MP4/MP3 are already compressed)
//
// Each .enc file produced by encryptRaw is self-contained: a 12-byte IV
// prefix followed by the AES-GCM ciphertext. No external IV bookkeeping
// is needed for evidence files.

interface ManifestV4 {
  version: 4
  exportedAt: number
  salt: number[]
  evidenceCount: number
}

function buildMetaPlaintext(backup: VaultBackup): Uint8Array {
  // Reuses the same VaultBackup shape as v3, minus the evidence array
  // (evidence ships as separate files in the evidence/ folder instead).
  const meta = {
    version: backup.version,
    exportedAt: backup.exportedAt,
    incidents: backup.incidents,
    alerts: backup.alerts,
    users: backup.users,
    userProfile: backup.userProfile,
    seals: backup.seals,
  }
  return new TextEncoder().encode(JSON.stringify(meta))
}

export async function exportVaultBackupV4(key: CryptoKey): Promise<string> {
  const vault = await getRecord<VaultRecord>(STORES.users, "vault")
  if (!vault) throw new Error("Vault is not set up.")

  // 1. Gather metadata (incidents, users, alerts, seals, profile)
  const backup = await exportAllRecords()
  const metaPlain = buildMetaPlaintext(backup)

  // 2. Compress metadata, then encrypt
  const metaCompressed = await compress(metaPlain)
  const metaEncrypted = await encryptRaw(key, metaCompressed)

  // 3. Gather and encrypt evidence as raw binary — no compression,
  //    since photos/video/audio are already compressed formats.
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
    // Store filename + mimeType alongside via a tiny sidecar JSON so the
    // ZIP entry itself stays pure binary (faster to write, no escaping).
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
  // level: 0 — fflate's own compression is disabled because:
  //   - metadata is already deflate-compressed above
  //   - evidence is already-compressed media (or raw, also not worth zipping)
  // The ZIP container here is just a file-structure format, not a
  // second compression pass.

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

  // 1. Re-derive the key from the manifest's salt + passcode
  const salt = new Uint8Array(manifest.salt)
  const key = await deriveKey(passcode, salt)

  // 2. Decrypt + decompress metadata
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

  // 3. Decrypt every evidence file and re-encrypt under the in-memory
  //    vault key in the same shape saveEvidence() produces, so the
  //    existing read path (loadEvidenceBlobUrl) needs no changes.
  const evidenceRecords: any[] = []
  const evidencePaths = Object.keys(files).filter(
    (p) => p.startsWith("evidence/") && p.endsWith(".enc"),
  )

  for (const path of evidencePaths) {
    const id = path.slice("evidence/".length, path.length - ".enc".length)
    const sidecarPath = `evidence/${id}.json`
    const sidecarBytes = files[sidecarPath]
    if (!sidecarBytes) continue // skip if sidecar metadata is missing

    let sidecar: EvidenceSidecar
    try {
      sidecar = JSON.parse(new TextDecoder().decode(sidecarBytes))
    } catch {
      continue
    }

    const raw = await decryptRaw(key, files[path])

    const input: EvidenceInput = {
      kind: sidecar.kind as EvidenceInput["kind"],
      name: sidecar.name,
      mimeType: sidecar.mimeType,
      size: sidecar.size,
      sha256: sidecar.sha256,
      bytes: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    }

    // saveEvidence re-encrypts under `key` and writes directly to IndexedDB,
    // matching the exact record shape the rest of the app expects.
    await saveEvidence(key, sidecar.incidentId, input)
  }

  // 4. Restore incidents/users/alerts/seals/profile metadata.
  //    Snapshot the current vault record first — if anything fails partway,
  //    restore it so the PIN keeps working.
  const fullBackup: VaultBackup = {
    version: meta.version,
    exportedAt: meta.exportedAt,
    incidents: meta.incidents,
    evidence: [], // evidence already written above via saveEvidence
    alerts: meta.alerts,
    users: meta.users,
    userProfile: meta.userProfile,
    seals: meta.seals,
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
// Public API — format detection + unified entry points
// ---------------------------------------------------------------------------

/**
 * Export the vault as a Version 4 (.wpbz) backup.
 * This is the default export format going forward.
 */
export async function exportVaultBackup(key: CryptoKey): Promise<string> {
  return exportVaultBackupV4(key)
}

/**
 * Import a backup file, auto-detecting Version 3 (.wpb, JSON) vs
 * Version 4 (.wpbz, ZIP) by file extension and content sniffing.
 *
 * Always re-derives the key from the salt embedded in the backup file
 * + the user's passcode — never uses the current device key. Works
 * identically for normal import and fresh-install restore.
 */
export async function importVaultBackupFresh(
  file: File,
  passcode: string,
): Promise<{ key: CryptoKey; autoLockMs: number }> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  
  // Detect format using the new function
  const format = detectFileFormat(bytes, file.name)
  
  // Gracefully handle PNG files
  if (format === 'png') {
    throw new Error(
      'This file is an image (PNG), not a valid backup file. Please select a .wpb or .wpbz file.'
    )
  }
  
  if (format === 'unknown') {
    throw new Error(
      'This file format is not recognized. Please select a valid backup file (.wpb or .wpbz).'
    )
  }
  
  // ZIP format (which is what .wpbz is)
  if (format === 'zip') {
    return importVaultBackupV4(bytes, passcode)
  }
  
  // JSON format (legacy .wpb)
  if (format === 'json') {
    try {
      const text = new TextDecoder().decode(bytes)
      const raw = JSON.parse(text)
      return importVaultBackupV3(raw, passcode)
    } catch (e) {
      throw new Error('The file is not a valid JSON backup. Please ensure you selected the correct file.')
    }
  }
  
  // Fallback safety
  throw new Error('Unable to determine file format. Please select a valid backup file (.wpb or .wpbz).')
}

// ---------------------------------------------------------------------------
// Base64 helper for Capacitor Filesystem (which expects base64 for
// binary writes when no explicit encoding is given)
// ---------------------------------------------------------------------------

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000 // avoid call-stack limits on large arrays
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

// ---------------------------------------------------------------------------
// Merge import — decrypt a second backup file and merge its incidents
// into the currently unlocked vault, rather than replacing it.
// Unlike importVaultBackupFresh, this never touches the users/vault
// store — only incidents and their evidence are merged.
// ---------------------------------------------------------------------------

interface ParsedBackup {
  sourceKey: CryptoKey
  incidents: IncidentRecord[]
  evidence: EvidenceRecord[]
}

/**
 * Decrypt a v3 (.wpb) backup file into its raw incident/evidence arrays,
 * without writing anything to IndexedDB. Used by mergeVaultBackup.
 */
async function parseVaultBackupV3(
  raw: any,
  passcode: string,
): Promise<ParsedBackup> {
  if (!raw.salt) {
    throw new Error(
      "This backup was created with an older version of the app. " +
        "Please export a new backup from your previous device first.",
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

/**
 * Decrypt a v4 (.wpbz) backup file into its raw incident/evidence arrays,
 * without writing anything to IndexedDB. Used by mergeVaultBackup.
 */
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

  // Evidence stays encrypted under sourceKey here — mergeIncidentRecords
  // decrypts each file lazily with sourceKey as it processes incidents,
  // so we reconstruct EvidenceRecord-shaped entries pointing at the
  // raw encrypted .enc bytes via a synthetic iv+data pair compatible
  // with toCipherPayload (encryptRaw's [iv][ciphertext] format needs
  // splitting back into the two-field shape first).
  const evidenceRecords: EvidenceRecord[] = []
  const evidencePaths = Object.keys(files).filter(
    (p) => p.startsWith("evidence/") && p.endsWith(".enc"),
  )

  for (const path of evidencePaths) {
    const id = path.slice("evidence/".length, path.length - ".enc".length)
    const sidecarPath = `evidence/${id}.json`
    const sidecarBytes = files[sidecarPath]
    if (!sidecarBytes) continue
    if (!sidecarPath.endsWith(".json")) continue

    let sidecar: EvidenceSidecar
    try {
      sidecar = JSON.parse(new TextDecoder().decode(sidecarBytes))
    } catch {
      continue
    }

    const blob = files[path]
    if (!blob) continue
    // encryptRaw format: [12-byte IV][ciphertext]. Split it back into
    // the iv/data shape that toCipherPayload (and thus decryptJSON in
    // repo.ts's saveEvidence/decrypt path) expects, but since merge's
    // evidence decryption goes through decryptRaw directly inside
    // mergeIncidentRecords, we instead stash the whole .enc blob and
    // decrypt it with decryptRaw at merge time. To keep EvidenceRecord's
    // shape (iv: Uint8Array, data: ArrayBuffer) usable by the standard
    // toCipherPayload/decryptJSON path mergeIncidentRecords relies on,
    // we split the blob here once.
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
    incidents: meta.incidents as unknown as IncidentRecord[],
    evidence: evidenceRecords,
  }
}

/**
 * Merge a backup file's incidents into the currently unlocked vault.
 * Auto-detects v3 (.wpb) vs v4 (.wpbz) the same way importVaultBackupFresh
 * does. The vault's own salt/PIN/users store is never touched — only
 * incidents and their evidence are merged in, deduplicated by content hash.
 *
 * currentKey must be the already-unlocked vault's key (keyRef.current).
 * passcode is the PASSCODE OF THE SOURCE FILE being merged in, which may
 * differ from the current vault's PIN if it came from another device.
 */
export async function mergeVaultBackup(
  file: File,
  passcode: string,
  alert("D4\nfiles: " + Object.keys(files).join("|"))
  currentKey: CryptoKey,
  onProgress?: (progress: MergeProgress) => void,
): Promise<MergeResult> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  
  // Use the same format detection for merge
  const format = detectFileFormat(bytes, file.name)
  
  // Gracefully handle PNG files in merge as well
  if (format === 'png') {
    throw new Error(
      'This file is an image (PNG), not a valid backup file. Please select a .wpb or .wpbz file.'
    )
  }
  
  if (format === 'unknown') {
    throw new Error(
      'This file format is not recognized. Please select a valid backup file (.wpb or .wpbz).'
    )
  }

  let parsed: ParsedBackup
  if (format === 'zip') {
    parsed = await parseVaultBackupV4(bytes, passcode)
  } else if (format === 'json') {
    try {
      const text = new TextDecoder().decode(bytes)
      const raw = JSON.parse(text)
      parsed = await parseVaultBackupV3(raw, passcode)
    } catch (e) {
      throw new Error('The file is not a valid JSON backup. Please ensure you selected the correct file.')
    }
  } else {
    throw new Error('Unable to determine file format. Please select a valid backup file (.wpb or .wpbz).')
  }

  return mergeIncidentRecords(
    parsed.sourceKey,
    currentKey,
    parsed.incidents,
    parsed.evidence,
    onProgress,
  )
}