// Encrypted repository: bridges domain objects <-> encrypted IndexedDB records.
// Every read decrypts with the in-memory vault key; every write encrypts first.

import {
  decryptJSON,
  encryptJSON,
  sha256Hex,
  type CipherPayload,
} from "./crypto"
import {
  openDatabase,
  deleteRecord,
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
): Promise<string> {
  const plaintext = await decryptJSON<EvidencePlaintext>(
    key,
    toCipherPayload(record),
  )
  const bytes = new Uint8Array(plaintext.bytes)
  const blob = new Blob([bytes], { type: record.mimeType })
  return URL.createObjectURL(blob)
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

async function evidenceMetaFor(
  incidentId: string,
): Promise<EvidenceMeta[]> {
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
  // Re-persist the incident with sealed=true (deletion disabled).
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

// Backup helpers - Android WebView compatible version
export async function exportAllRecords() {
  try {
    // Use explicit transaction for better compatibility
    const db = await openDatabase()
    
    // Get all records using explicit transactions
    const incidents = await new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction(STORES.incidents, 'readonly')
      const store = tx.objectStore(STORES.incidents)
      const request = store.getAll()
      
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    
    const evidence = await new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction(STORES.evidence, 'readonly')
      const store = tx.objectStore(STORES.evidence)
      const request = store.getAll()
      
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    
    const alerts = await new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction(STORES.patternAlerts, 'readonly')
      const store = tx.objectStore(STORES.patternAlerts)
      const request = store.getAll()
      
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    
    const users = await new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction(STORES.users, 'readonly')
      const store = tx.objectStore(STORES.users)
      const request = store.getAll()
      
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    return {
      version: 1,
      exportedAt: Date.now(),
      incidents,
      evidence,
      alerts,
      users,
    }
  } catch (error) {
    console.error('Export failed:', error)
    // Return empty data structure on failure
    return {
      version: 1,
      exportedAt: Date.now(),
      incidents: [],
      evidence: [],
      alerts: [],
      users: [],
    }
  }
}

export async function importAllRecords(data: {
  incidents: any[]
  evidence: any[]
  alerts: any[]
  users: any[]
}) {
  try {
    const db = await openDatabase()

    // Use explicit transactions for each store for better Android compatibility
    if (data.incidents && data.incidents.length > 0) {
      const tx = db.transaction(STORES.incidents, 'readwrite')
      const store = tx.objectStore(STORES.incidents)
      for (const item of data.incidents) {
        await new Promise<void>((resolve, reject) => {
          const request = store.put(item)
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      }
      await tx.done
    }

    if (data.evidence && data.evidence.length > 0) {
      const tx = db.transaction(STORES.evidence, 'readwrite')
      const store = tx.objectStore(STORES.evidence)
      for (const item of data.evidence) {
        await new Promise<void>((resolve, reject) => {
          const request = store.put(item)
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      }
      await tx.done
    }

    if (data.alerts && data.alerts.length > 0) {
      const tx = db.transaction(STORES.patternAlerts, 'readwrite')
      const store = tx.objectStore(STORES.patternAlerts)
      for (const item of data.alerts) {
        await new Promise<void>((resolve, reject) => {
          const request = store.put(item)
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      }
      await tx.done
    }

    if (data.users && data.users.length > 0) {
      const tx = db.transaction(STORES.users, 'readwrite')
      const store = tx.objectStore(STORES.users)
      for (const item of data.users) {
        await new Promise<void>((resolve, reject) => {
          const request = store.put(item)
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      }
      await tx.done
    }
  } catch (error) {
    console.error('Import failed:', error)
    throw error
  }
}