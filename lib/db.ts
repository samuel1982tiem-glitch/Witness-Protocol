// IndexedDB storage layer.
// Stores ciphertext only — plaintext is never written to disk.

import type { CipherPayload } from "./crypto"

const DB_NAME = "witness-protocol"
const DB_VERSION = 2

export const STORES = {
  users: "users",
  userProfile: "userProfile",
  categories: "categories",
  incidents: "incidents",
  evidenceFiles: "evidenceFiles",
  patternAlerts: "patternAlerts",
  evidenceSeals: "evidenceSeals",
} as const

/** Vault configuration record (store: users). Not secret on its own. */
export interface VaultRecord {
  id: "vault"
  salt: Uint8Array
  verifierIv: Uint8Array
  verifierData: ArrayBuffer
  autoLockMs: number
  createdAt: number
}

export interface UserProfileRecord {
  id: "profile"
  iv: Uint8Array
  data: ArrayBuffer
  updatedAt: number
}


/** Encrypted incident record (store: incidents). */
export interface IncidentRecord {
  id: string
  /** Plaintext metadata used only for ordering; not sensitive. */
  createdAt: number
  sealed: boolean
  iv: Uint8Array
  data: ArrayBuffer
}

/** Encrypted evidence file record (store: evidenceFiles). */
export interface EvidenceRecord {
  id: string
  incidentId: string
  kind: string
  mimeType: string
  size: number
  sha256: string
  createdAt: number
  iv: Uint8Array
  data: ArrayBuffer
}

/** Encrypted pattern alert (store: patternAlerts). */
export interface AlertRecord {
  id: string
  iv: Uint8Array
  data: ArrayBuffer
  createdAt: number
}

/** Evidence seal record (store: evidenceSeals). Hash is non-reversible. */
export interface SealRecord {
  id: string
  incidentId: string
  hash: string
  sealedAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

export function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available."))
  }
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORES.users)) {
        db.createObjectStore(STORES.users, { keyPath: "id" })
  }
  if (!db.objectStoreNames.contains(STORES.userProfile)) {
    db.createObjectStore(STORES.userProfile, { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains(STORES.categories)) {
        db.createObjectStore(STORES.categories, { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains(STORES.incidents)) {
        const store = db.createObjectStore(STORES.incidents, { keyPath: "id" })
        store.createIndex("createdAt", "createdAt")
      }
      if (!db.objectStoreNames.contains(STORES.evidenceFiles)) {
        const store = db.createObjectStore(STORES.evidenceFiles, {
          keyPath: "id",
        })
        store.createIndex("incidentId", "incidentId")
      }
      if (!db.objectStoreNames.contains(STORES.patternAlerts)) {
        db.createObjectStore(STORES.patternAlerts, { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains(STORES.evidenceSeals)) {
        const store = db.createObjectStore(STORES.evidenceSeals, {
          keyPath: "id",
        })
        store.createIndex("incidentId", "incidentId")
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  return dbPromise
}

function tx(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(store, mode).objectStore(store)
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function putRecord<T>(store: string, value: T): Promise<void> {
  const db = await openDatabase()
  await promisify(tx(db, store, "readwrite").put(value as object))
}

export async function getRecord<T>(
  store: string,
  key: IDBValidKey,
): Promise<T | undefined> {
  const db = await openDatabase()
  return promisify<T>(tx(db, store, "readonly").get(key) as IDBRequest<T>)
}

export async function getAll<T>(store: string): Promise<T[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const req = tx(db, store, "readonly").openCursor()
    const results: T[] = []
    req.onsuccess = () => { const c=req.result; if(c){ results.push(c.value as T); c.continue(); } else resolve(results)}
    req.onerror = () => reject(req.error)
  })
}

export async function getAllByIndex<T>(
  store: string,
  indexName: string,
  key: IDBValidKey,
): Promise<T[]> {
  const db = await openDatabase()
  const index = tx(db, store, "readonly").index(indexName)
  return promisify<T[]>(index.getAll(key) as IDBRequest<T[]>)
}

export async function deleteRecord(
  store: string,
  key: IDBValidKey,
): Promise<void> {
  const db = await openDatabase()
  await promisify(tx(db, store, "readwrite").delete(key))
}

export async function clearStore(store: string): Promise<void> {
  const db = await openDatabase()
  await promisify(tx(db, store, "readwrite").clear())
}

export function toCipherPayload(record: {
  iv: Uint8Array | any
  data: ArrayBuffer | any
}): CipherPayload {
  let iv: Uint8Array
  if (record.iv instanceof Uint8Array) {
    iv = record.iv
  } else if (Array.isArray(record.iv)) {
    iv = new Uint8Array(record.iv)
  } else {
    iv = new Uint8Array(Object.values(record.iv))
  }

  let data: ArrayBuffer
  if (record.data instanceof ArrayBuffer) {
    data = record.data
  } else if (record.data instanceof Uint8Array) {
    data = record.data.slice(0).buffer
  } else if (Array.isArray(record.data)) {
    data = new Uint8Array(record.data).buffer
  } else {
    data = new Uint8Array(Object.values(record.data)).buffer
  }

  return { iv, data }
}