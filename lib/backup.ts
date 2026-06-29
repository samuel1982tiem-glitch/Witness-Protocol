import { encryptJSON, decryptJSON, deriveKey, checkVerifier } from "./crypto"
import { Filesystem, Directory } from "@capacitor/filesystem"
import {
  exportAllRecords,
  importAllRecords,
  type VaultBackup,
} from "./repo"
import { getRecord, putRecord, STORES, type VaultRecord } from "./db"

// Converts any array-like or plain-object representation back to the
// correct typed array. Handles: real typed array, JS Array, and plain
// object {0: x, 1: y} which some JSON parsers or IDB engines produce.
function toUint8Array(val: any): Uint8Array {
  if (val instanceof Uint8Array) return val
  if (Array.isArray(val)) return new Uint8Array(val)
  if (val && typeof val === "object") return new Uint8Array(Object.values(val))
  return new Uint8Array(0)
}

function toArrayBuffer(val: any): ArrayBuffer {
  if (val instanceof ArrayBuffer) return val
  if (val instanceof Uint8Array) return val.slice(0).buffer
  if (Array.isArray(val)) return new Uint8Array(val).buffer
  if (val && typeof val === "object") return new Uint8Array(Object.values(val)).buffer
  return new ArrayBuffer(0)
}

function reviveBuffers(backup: VaultBackup): VaultBackup {
  for (const incident of backup.incidents ?? []) {
    incident.iv = toUint8Array(incident.iv)
    incident.data = toArrayBuffer(incident.data)
  }

  for (const evidence of backup.evidence ?? []) {
    evidence.iv = toUint8Array(evidence.iv)
    evidence.data = toArrayBuffer(evidence.data)
  }

  for (const alert of backup.alerts ?? []) {
    if (alert.iv != null) alert.iv = toUint8Array(alert.iv)
    if (alert.data != null) alert.data = toArrayBuffer(alert.data)
  }

  for (const user of backup.users ?? []) {
    if ("salt" in user) user.salt = toUint8Array(user.salt)
    if ("verifierIv" in user) user.verifierIv = toUint8Array(user.verifierIv)
    if ("verifierData" in user) user.verifierData = toArrayBuffer(user.verifierData)
  }

  for (const profile of backup.userProfile ?? []) {
    if (profile.iv != null) profile.iv = toUint8Array(profile.iv)
    if (profile.data != null) profile.data = toArrayBuffer(profile.data)
  }

  return backup
}

export async function exportVaultBackup(key: CryptoKey) {
  const backup = await exportAllRecords()
  const encrypted = await encryptJSON(key, backup)

  // Salt stored unencrypted so a fresh device can re-derive the key
  // from PIN + salt before decrypting. Salt is not secret (PBKDF2 param).
  const vault = await getRecord<VaultRecord>(STORES.users, "vault")

  const payload = {
    version: 3,
    exportedAt: Date.now(),
    salt: vault ? Array.from(vault.salt) : undefined,
    iv: Array.from(encrypted.iv),
    data: Array.from(new Uint8Array(encrypted.data)),
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
 * Single import path — works for both normal and fresh-install restore.
 *
 * Always re-derives the key from the salt embedded in the backup file
 * + the user's passcode. This is the only approach that works in all cases:
 *
 *   - Normal (vault already exists): backup salt = current salt → same key
 *   - Fresh install (new random salt): backup salt differs but same PIN
 *     → correct original key derived from backup salt + PIN
 *
 * Never uses keyRef / the current device key for decryption.
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

  // Step 1: re-derive the key the backup was originally encrypted with
  const salt = Uint8Array.from(raw.salt as number[])
  const key = await deriveKey(passcode, salt)

  // Step 2: decrypt the outer envelope
  const iv = Uint8Array.from(raw.iv as number[])
  const dataBytes = Uint8Array.from(raw.data as number[])

  let backup: VaultBackup
  try {
    backup = await decryptJSON<VaultBackup>(key, {
      iv,
      data: dataBytes,
    })
  } catch (err) {
    // OperationError here = wrong passcode or corrupted file
    const msg = [
      "Decrypt failed:",
      String(err),
      "iv length:", iv.length,
      "data length:", dataBytes.length,
      "salt length:", salt.length,
    ].join(" | ")
    throw new Error(msg)
  }

  const revived = reviveBuffers(backup)

  // Step 4: restore all records — backup vault record replaces current one
  // so salt + verifier + PIN are consistent on this device going forward
  // Snapshot the current vault record before import.
  // If import fails halfway, we restore it so the PIN keeps working.
  const currentVault = await getRecord<VaultRecord>(STORES.users, "vault")

  try {
    await importAllRecords(revived)
  } catch (err) {
    // Restore the vault record so the PIN is not broken
    if (currentVault) await putRecord(STORES.users, currentVault)
    throw err
  }

  // Replace the vault record with the backup's own record so that
  // the backup's salt+PIN combination is now this device's vault.
  // (importAllRecords already wrote it, so this is a no-op if it succeeded)

  return {
    key,
    autoLockMs: 3 * 60 * 1000,
  }
}