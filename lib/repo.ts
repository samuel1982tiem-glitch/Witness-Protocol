// Encrypted repository: bridges domain objects <-> encrypted IndexedDB records.
// Every read decrypts with the in-memory vault key; every write encrypts first.

import {
  decryptJSON,
  decryptBytes,
  encryptJSON,
  sha256Hex,
  type CipherPayload,
} from "./crypto"
import {
  deleteRecord,
  getRecord,
  getAll,
  getAllByIndex,
  putRecord,
  STORES,
  toCipherPayload,
  type EvidenceRecord,
  type IncidentRecord,
  type SealRecord,
} from "./db"
import type {
  CategoryId,
  EvidenceMeta,
  GeoLocation,
  Incident,
} from "./types"

export interface IncidentInput {
  title: string
  description: string
  category: CategoryId
  occurredAt: number
  location: GeoLocation | null
}

export interface EvidenceInput {
  kind: EvidenceMeta["kind"]
  name: string
  mimeType: string
  size: number
  sha256: string
  bytes: ArrayBuffer
}

/** Encrypted payload shape stored inside an incident record. */
interface IncidentPlaintext {
  title: string
  description: string
  category: CategoryId
  occurredAt: number
  location: GeoLocation | null
}

interface EvidencePlaintext {
  name: string
  bytes: number[] // serialized for JSON; small attachments
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

export async function saveIncident(
  key: CryptoKey,
  input: IncidentInput,
  existing?: { id: string; createdAt: number; sealed: boolean },
): Promise<string> {
  const id = existing?.id ?? genId("inc")
  const plaintext: IncidentPlaintext = {
    title: input.title,
    description: input.description,
    category: input.category,
    occurredAt: input.occurredAt,
    location: input.location,
  }
  const payload = await encryptJSON(key, plaintext)
  const record: IncidentRecord = {
    id,
    createdAt: existing?.createdAt ?? Date.now(),
    sealed: existing?.sealed ?? false,
    iv: payload.iv,
    data: payload.data,
  }
  await putRecord(STORES.incidents, record)
  return id
}

export async function saveEvidence(
  key: CryptoKey,
  incidentId: string,
  input: EvidenceInput,
): Promise<string> {
  const id = genId("ev")
  const plaintext: EvidencePlaintext = {
    name: input.name,
    bytes: Array.from(new Uint8Array(input.bytes)),
  }
  const payload = await encryptJSON(key, plaintext)
  const record: EvidenceRecord = {
    id,
    incidentId,
    kind: input.kind,
    mimeType: input.mimeType,
    size: input.size,
    sha256: input.sha256,
    createdAt: Date.now(),
    iv: payload.iv,
    data: payload.data,
  }
  await putRecord(STORES.evidenceFiles, record)
  return id
}

/** Decrypt a single evidence file back into an object URL for viewing/playback. */
export async function loadEvidenceBlobUrl(
  key: CryptoKey,
  record: EvidenceRecord,
): Promise<{ url: string; name: string }> {
  const plaintext = await decryptJSON<EvidencePlaintext>(
    key,
    toCipherPayload(record),
  )
  const bytes = new Uint8Array(plaintext.bytes)
  const blob = new Blob([bytes], { type: record.mimeType })
  return { url: URL.createObjectURL(blob), name: plaintext.name }
}

/**
 * Decrypt an evidence file and save it to the device's Downloads/Documents
 * directory (outside the encrypted vault), so the user can view or share
 * it with other apps. Returns the saved filename.
 */
export async function downloadEvidenceFile(
  key: CryptoKey,
  record: EvidenceRecord,
): Promise<string> {
  const { Filesystem, Directory } = await import("@capacitor/filesystem")

  try {
    await Filesystem.requestPermissions()
  } catch {
    // Permission API not available on this platform — continue anyway
  }

  const plaintext = await decryptJSON<EvidencePlaintext>(
    key,
    toCipherPayload(record),
  )
  const bytes = new Uint8Array(plaintext.bytes)

  // Base64-encode for Capacitor's writeFile — chunked to avoid call-stack
  // limits on large files (same approach used by the backup export pipeline).
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  const base64 = btoa(binary)

  // Ensure a sensible filename even if the stored name is empty/generic.
  const safeName =
    plaintext.name && plaintext.name.trim().length > 0
      ? plaintext.name
      : `${record.kind}-${record.id}`

  await Filesystem.writeFile({
    path: safeName,
    data: base64,
    directory: Directory.Documents,
    recursive: true,
  })

  return safeName
}

export async function getEvidenceRecords(
  incidentId: string,
): Promise<EvidenceRecord[]> {
  return getAllByIndex<EvidenceRecord>(
    STORES.evidenceFiles,
    "incidentId",
    incidentId,
  )
}

async function evidenceMetaFor(incidentId: string): Promise<EvidenceMeta[]> {
  const records = await getEvidenceRecords(incidentId)
  return records
    .map((r) => ({
      id: r.id,
      incidentId: r.incidentId,
      kind: r.kind as EvidenceMeta["kind"],
      name: "", // resolved lazily on detail view to avoid bulk decryption
      mimeType: r.mimeType,
      size: r.size,
      sha256: r.sha256,
      createdAt: r.createdAt,
    }))
    .sort((a, b) => a.createdAt - b.createdAt)
}

/** Decrypt all incidents into in-memory domain objects. */
export async function loadAllIncidents(key: CryptoKey): Promise<Incident[]> {
  const [records, seals] = await Promise.all([
    getAll<IncidentRecord>(STORES.incidents),
    getAll<SealRecord>(STORES.evidenceSeals),
  ])
  const sealByIncident = new Map(seals.map((s) => [s.incidentId, s]))

  const incidents = await Promise.all(
    records.map(async (record) => {
      const plaintext = await decryptJSON<IncidentPlaintext>(
        key,
        toCipherPayload(record),
      )
      const seal = sealByIncident.get(record.id) ?? null
      const evidence = await evidenceMetaFor(record.id)
      const incident: Incident = {
        id: record.id,
        title: plaintext.title,
        description: plaintext.description,
        category: plaintext.category,
        occurredAt: plaintext.occurredAt,
        createdAt: record.createdAt,
        location: plaintext.location,
        sealed: record.sealed,
        seal: seal
          ? {
              id: seal.id,
              incidentId: seal.incidentId,
              hash: seal.hash,
              sealedAt: seal.sealedAt,
            }
          : null,
        evidence,
      }
      return incident
    }),
  )

  return incidents.sort((a, b) => b.occurredAt - a.occurredAt)
}

/** Build a canonical string over incident + evidence hashes, then SHA-256 it. */
export async function computeSealHash(incident: Incident): Promise<string> {
  const canonical = JSON.stringify({
    title: incident.title,
    description: incident.description,
    category: incident.category,
    occurredAt: incident.occurredAt,
    createdAt: incident.createdAt,
    location: incident.location,
    evidence: incident.evidence
      .map((e) => `${e.kind}:${e.sha256}:${e.size}`)
      .sort(),
  })
  return sha256Hex(canonical)
}

export async function sealIncident(
  key: CryptoKey,
  incident: Incident,
): Promise<SealRecord> {
  const hash = await computeSealHash(incident)
  const seal: SealRecord = {
    id: genId("seal"),
    incidentId: incident.id,
    hash,
    sealedAt: Date.now(),
  }
  await putRecord(STORES.evidenceSeals, seal)
  await saveIncident(
    key,
    {
      title: incident.title,
      description: incident.description,
      category: incident.category,
      occurredAt: incident.occurredAt,
      location: incident.location,
    },
    { id: incident.id, createdAt: incident.createdAt, sealed: true },
  )
  return seal
}

export async function deleteIncident(incidentId: string): Promise<void> {
  const evidence = await getEvidenceRecords(incidentId)
  await Promise.all(
    evidence.map((e) => deleteRecord(STORES.evidenceFiles, e.id)),
  )
  await deleteRecord(STORES.incidents, incidentId)
}

export type StoredCipher = CipherPayload

// ---------------------------------------------------------------------------
// Backup helpers
// ---------------------------------------------------------------------------

export interface VaultBackup {
  version: number
  exportedAt: number
  incidents: IncidentRecord[]
  evidence: EvidenceRecord[]
  alerts: any[]
  users: any[]
  userProfile: any[]
  seals: SealRecord[]
}

/**
 * Evidence blob returned by exportEvidenceBlobs.
 * raw contains the decrypted file bytes ready for re-encryption
 * under the backup key in the v4 pipeline.
 */
export interface EvidenceBlob {
  record: EvidenceRecord  // metadata (id, incidentId, mimeType, etc.)
  name: string            // decrypted filename
  raw: Uint8Array         // decrypted file bytes
}

function serializeBinary(val: any): number[] {
  if (val instanceof Uint8Array) return Array.from(val)
  if (val instanceof ArrayBuffer) return Array.from(new Uint8Array(val))
  if (Array.isArray(val)) return val
  if (val && typeof val === "object")
    return Array.from(new Uint8Array(Object.values(val)))
  return []
}

function serializeRecord(record: any): any {
  const out: any = { ...record }
  if ("iv" in out) out.iv = serializeBinary(out.iv)
  if ("data" in out) out.data = serializeBinary(out.data)
  if ("salt" in out) out.salt = serializeBinary(out.salt)
  if ("verifierIv" in out) out.verifierIv = serializeBinary(out.verifierIv)
  if ("verifierData" in out) out.verifierData = serializeBinary(out.verifierData)
  return out
}

/**
 * Export all records as a serialization-safe VaultBackup.
 * All binary fields are converted to plain number arrays so that
 * JSON.stringify produces correct output (ArrayBuffer serializes as {}).
 * Used by both v3 and v4 export for the metadata section.
 */
export async function exportAllRecords(): Promise<VaultBackup> {
  const [incidents, evidence, alerts, users, userProfile, seals] =
    await Promise.all([
      getAll<IncidentRecord>(STORES.incidents),
      getAll<EvidenceRecord>(STORES.evidenceFiles),
      getAll(STORES.patternAlerts),
      getAll(STORES.users),
      getAll(STORES.userProfile),
      getAll<SealRecord>(STORES.evidenceSeals),
    ])

  return {
    version: 2,
    exportedAt: Date.now(),
    incidents: incidents.map(serializeRecord),
    evidence: evidence.map(serializeRecord),
    alerts: alerts.map(serializeRecord),
    users: users.map(serializeRecord),
    seals,
    userProfile: userProfile.map(serializeRecord),
  }
}

/**
 * Decrypt all evidence files from IndexedDB and return raw bytes.
 * Used exclusively by the v4 export pipeline — evidence is stored
 * as raw binary in the ZIP rather than base64-encoded JSON.
 */
export async function exportEvidenceBlobs(
  key: CryptoKey,
): Promise<EvidenceBlob[]> {
  const records = await getAll<EvidenceRecord>(STORES.evidenceFiles)

  return Promise.all(
    records.map(async (record) => {
      const plaintext = await decryptJSON<EvidencePlaintext>(
        key,
        toCipherPayload(record),
      )
      return {
        record,
        name: plaintext.name,
        raw: new Uint8Array(plaintext.bytes),
      }
    }),
  )
}

/**
 * Returns just the evidence record list (metadata only — no decryption,
 * no file bytes loaded). Used by the streaming v4 export pipeline to
 * know the total count up front and iterate records one at a time,
 * instead of exportEvidenceBlobs's Promise.all-everything approach
 * which holds every decrypted file in memory simultaneously.
 */
export async function listEvidenceRecords(): Promise<EvidenceRecord[]> {
  return getAll<EvidenceRecord>(STORES.evidenceFiles)
}

/**
 * Decrypt a single evidence file's raw bytes, skipping the
 * EvidencePlaintext {name, bytes: number[]} JSON round-trip that
 * exportEvidenceBlobs uses. The number[] format costs ~8x memory
 * overhead per byte (each byte becomes a full JS number in an array),
 * which compounds badly when decrypting large media files. This
 * decrypts straight to a Uint8Array instead.
 *
 * Used by the streaming v4 export pipeline, one record at a time,
 * so peak memory is "one file" rather than "every file at once".
 */
export async function decryptEvidenceRaw(
  key: CryptoKey,
  record: EvidenceRecord,
): Promise<{ name: string; raw: Uint8Array }> {
  const plaintext = await decryptJSON<EvidencePlaintext>(
    key,
    toCipherPayload(record),
  )
  return {
    name: plaintext.name,
    raw: new Uint8Array(plaintext.bytes),
  }
}

export async function importAllRecords(data: {
  incidents: any[]
  evidence: any[]
  alerts: any[]
  users: any[]
  userProfile?: any[]
  seals: any[]
}) {
  for (const item of data.incidents ?? []) {
    await putRecord(STORES.incidents, item)
  }
  for (const item of data.evidence ?? []) {
    await putRecord(STORES.evidenceFiles, item)
  }
  for (const item of data.alerts ?? []) {
    await putRecord(STORES.patternAlerts, item)
  }
  for (const item of data.users ?? []) {
    await putRecord(STORES.users, item)
  }
  for (const item of data.userProfile ?? []) {
    await putRecord(STORES.userProfile, item)
  }
  for (const item of data.seals ?? []) {
    await putRecord(STORES.evidenceSeals, item)
  }
}

export async function saveUserProfile(key: CryptoKey, profile: unknown) {
  const payload = await encryptJSON(key, profile)
  await putRecord(STORES.userProfile, {
    id: "profile",
    iv: payload.iv,
    data: payload.data,
    updatedAt: Date.now(),
  })
}

export async function loadUserProfile<T>(key: CryptoKey): Promise<T | null> {
  const record = await getRecord<any>(STORES.userProfile, "profile")
  if (!record) return null
  return decryptJSON<T>(key, toCipherPayload(record))
}

// ---------------------------------------------------------------------------
// Merge import — combine a second backup's incidents into the currently
// unlocked vault, rather than replacing it. Used when the vault already
// has data and the user imports another backup file (e.g. from a second
// device) to consolidate records.
// ---------------------------------------------------------------------------

export type MergeOutcome = "added" | "duplicate" | "diverged"

export interface MergeProgress {
  /** Number of incidents processed so far, including the current one. */
  processed: number
  /** Total incidents in the source file. */
  total: number
  /** Title of the incident currently being processed, for display. */
  currentTitle: string
}

export interface MergeResult {
  added: number
  duplicates: number
  diverged: number
  totalEvidenceAdded: number
}

/**
 * Decrypt one IncidentRecord (from either the current vault or a source
 * backup) into a comparable Incident-shaped object, without touching seals
 * or evidence content lookups beyond what's needed for content hashing.
 */
async function decryptIncidentForCompare(
  key: CryptoKey,
  record: IncidentRecord,
  evidenceRecords: EvidenceRecord[],
): Promise<Incident> {
  const plaintext = await decryptJSON<IncidentPlaintext>(
    key,
    toCipherPayload(record),
  )
  const evidence: EvidenceMeta[] = evidenceRecords
    .filter((e) => e.incidentId === record.id)
    .map((e) => ({
      id: e.id,
      incidentId: e.incidentId,
      kind: e.kind as EvidenceMeta["kind"],
      name: "",
      mimeType: e.mimeType,
      size: e.size,
      sha256: e.sha256,
      createdAt: e.createdAt,
    }))
  return {
    id: record.id,
    title: plaintext.title,
    description: plaintext.description,
    category: plaintext.category,
    occurredAt: plaintext.occurredAt,
    createdAt: record.createdAt,
    location: plaintext.location,
    sealed: record.sealed,
    seal: null,
    evidence,
  }
}

/**
 * Same as computeSealHash but without createdAt — used for merge-import
 * content comparison, where two incidents with the same logical content
 * may have been saved at different times across devices.
 */
async function computeContentHash(incident: Incident): Promise<string> {
  const canonical = JSON.stringify({
    title: incident.title,
    description: incident.description,
    category: incident.category,
    occurredAt: incident.occurredAt,
    location: incident.location,
    evidence: incident.evidence
      .map((e) => `${e.kind}:${e.sha256}:${e.size}`)
      .sort(),
  })
  return sha256Hex(canonical)
}

/**
 * Merge a decrypted source backup's incidents + evidence into the
 * currently unlocked vault (encrypted under currentKey).
 *
 * For each source incident:
 *   - No existing incident with the same ID  -> import as-is (re-encrypted
 *     under currentKey), outcome "added"
 *   - Existing incident with same ID, identical content (via content hash)
 *     -> skip, outcome "duplicate"
 *   - Existing incident with same ID, different content
 *     -> import as a new incident with a freshly generated ID,
 *        outcome "diverged" (never silently overwrites)
 *
 * Evidence files belonging to imported incidents are decrypted with
 * sourceKey and re-encrypted under currentKey via saveEvidence, so the
 * existing read path needs no changes.
 *
 * onProgress is called once per source incident processed, so the UI
 * can render a live progress bar and running counts.
 */
export async function mergeIncidentRecords(
  sourceKey: CryptoKey,
  currentKey: CryptoKey,
  sourceIncidents: IncidentRecord[],
  sourceEvidence: EvidenceRecord[],
  onProgress?: (progress: MergeProgress) => void,
): Promise<MergeResult> {
  const result: MergeResult = {
    added: 0,
    duplicates: 0,
    diverged: 0,
    totalEvidenceAdded: 0,
  }

  // Load current vault's incidents once, keyed by ID, for fast lookup.
  const currentRecords = await getAll<IncidentRecord>(STORES.incidents)
  const currentEvidenceAll = await getAll<EvidenceRecord>(STORES.evidenceFiles)
  const currentById = new Map(currentRecords.map((r) => [r.id, r]))

  const total = sourceIncidents.length

  for (let i = 0; i < sourceIncidents.length; i++) {
    const sourceRecord = sourceIncidents[i]
    const sourceEvidenceForThis = sourceEvidence.filter(
      (e) => e.incidentId === sourceRecord.id,
    )

    const sourceIncident = await decryptIncidentForCompare(
      sourceKey,
      sourceRecord,
      sourceEvidence,
    )

    onProgress?.({
      processed: i + 1,
      total,
      currentTitle: sourceIncident.title,
    })

    const existingRecord = currentById.get(sourceRecord.id)

    let targetId = sourceRecord.id
    let outcome: MergeOutcome = "added"

    if (existingRecord) {
      const existingIncident = await decryptIncidentForCompare(
        currentKey,
        existingRecord,
        currentEvidenceAll,
      )
      const [sourceHash, existingHash] = await Promise.all([
        computeContentHash(sourceIncident),
        computeContentHash(existingIncident),
      ])

      if (sourceHash === existingHash) {
        outcome = "duplicate"
      } else {
        outcome = "diverged"
        targetId = genId("inc") // fresh ID — never overwrite
      }
    }

    if (outcome === "duplicate") {
      result.duplicates++
      continue
    }

    // Re-encrypt the incident under the current vault's key
    const newId = await saveIncident(
      currentKey,
      {
        title: sourceIncident.title,
        description: sourceIncident.description,
        category: sourceIncident.category,
        occurredAt: sourceIncident.occurredAt,
        location: sourceIncident.location,
      },
      {
        id: targetId,
        createdAt: sourceRecord.createdAt,
        sealed: false, // merged incidents always land unsealed; user can re-seal
      },
    )

    // Re-encrypt each evidence file under the current vault's key
    for (const evRecord of sourceEvidenceForThis) {
      // v3 backups store evidence as JSON {name, bytes:[...]} (decryptJSON).
      // v4 backups store evidence as raw encrypted binary directly
      // (decryptBytes) — no JSON wrapper. Try JSON first, fall back to raw.
      let rawBytes: ArrayBuffer
      let evName = (evRecord as any).name ?? ""
      try {
        const evPlaintext = await decryptJSON<EvidencePlaintext>(
          sourceKey,
          toCipherPayload(evRecord),
        )
        rawBytes = new Uint8Array(evPlaintext.bytes).buffer
        evName = evPlaintext.name
      } catch {
        rawBytes = await decryptBytes(sourceKey, toCipherPayload(evRecord))
      }
      await saveEvidence(currentKey, newId, {
        kind: evRecord.kind as EvidenceMeta["kind"],
        name: evName,
        mimeType: evRecord.mimeType,
        size: evRecord.size,
        sha256: evRecord.sha256,
        bytes: rawBytes,
      })
      result.totalEvidenceAdded++
    }

    if (outcome === "added") result.added++
    else result.diverged++
  }

  return result
}
