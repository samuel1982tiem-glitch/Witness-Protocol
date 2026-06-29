import { encryptJSON, decryptJSON, deriveKey } from "./crypto"
import { Filesystem, Directory } from "@capacitor/filesystem"
import {
  exportAllRecords,
  importAllRecords,
  type VaultBackup,
} from "./repo"
import { getRecord, putRecord, STORES, type VaultRecord } from "./db"

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

export async function exportVaultBackup(key: CryptoKey) {
  const backup = await exportAllRecords()
  const encrypted = await encryptJSON(key, backup)

  // Salt stored unencrypted in outer payload so a fresh device can
  // re-derive the key from PIN + salt. Salt is not secret (PBKDF2 param).
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

/**
 * Single import path for both normal and fresh-install restore.
 *
 * Always re-derives the key from the salt in the backup's outer payload
 * + the user's passcode — never uses the current device key.
 *
 *   Normal import:    backup salt = current salt → same key derived ✓
 *   Fresh install:    different salt, same PIN → correct old key derived ✓
 */
export async function importVaultBackupFresh(
  file: File,
  passcode: string,
): Promise<{ key: CryptoKey; autoLockMs: number }> {
  const text = await file.text()
  const raw = JSON.parse(text)

  if (!raw.salt) {
    throw new Error(
      "This backup was created with an older version of the app. " +
        "Please export a new backup from your previous device first.",
    )
  }

  // Re-derive the exact key the backup was encrypted with
  const salt = new Uint8Array(raw.salt as number[])
  const key = await deriveKey(passcode, salt)

  // Decrypt the outer envelope
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

  // Protect the current vault record — restore it if import fails
  // so the PIN keeps working even after a partial write
  const currentVault = await getRecord<VaultRecord>(STORES.users, "vault")
  try {
    await importAllRecords(revived)
  } catch (err) {
    if (currentVault) await putRecord(STORES.users, currentVault)
    throw err
  }

  return {
    key,
    autoLockMs: 3 * 60 * 1000,
  }
}
