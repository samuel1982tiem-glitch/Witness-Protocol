import { encryptJSON, decryptJSON, deriveKey, checkVerifier } from "./crypto"
import { Filesystem, Directory } from "@capacitor/filesystem"
import {
  exportAllRecords,
  importAllRecords,
  type VaultBackup,
} from "./repo"
import { getRecord, putRecord, STORES, type VaultRecord } from "./db"

function reviveBuffers(backup: VaultBackup): VaultBackup {
  for (const incident of backup.incidents ?? []) {
    incident.iv = new Uint8Array(incident.iv as any)
    incident.data =
      incident.data instanceof ArrayBuffer
        ? incident.data
        : new Uint8Array(incident.data as any).buffer
  }

  for (const evidence of backup.evidence ?? []) {
    evidence.iv = new Uint8Array(evidence.iv as any)
    evidence.data =
      evidence.data instanceof ArrayBuffer
        ? evidence.data
        : new Uint8Array(evidence.data as any).buffer
  }

  for (const alert of backup.alerts ?? []) {
    if (alert.iv) alert.iv = new Uint8Array(alert.iv as any)
    if (alert.data != null) {
      alert.data =
        alert.data instanceof ArrayBuffer
          ? alert.data
          : new Uint8Array(alert.data as any).buffer
    }
  }

  for (const user of backup.users ?? []) {
    if ("salt" in user) user.salt = new Uint8Array(user.salt as any)
    if ("verifierIv" in user) user.verifierIv = new Uint8Array(user.verifierIv as any)
    if ("verifierData" in user) {
      user.verifierData =
        user.verifierData instanceof ArrayBuffer
          ? user.verifierData
          : new Uint8Array(user.verifierData as any).buffer
    }
  }

  return backup
}

export async function exportVaultBackup(key: CryptoKey) {
  const backup = await exportAllRecords()
  const encrypted = await encryptJSON(key, backup)

  // Embed the salt in the outer (unencrypted) payload so a fresh device
  // can re-derive the key from PIN + salt without a chicken-and-egg problem.
  // The salt is not secret — it is a PBKDF2 parameter, not the key itself.
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
 * Normal import (vault already exists and is unlocked).
 * The caller passes the current in-memory key.
 * We preserve the current device's vault record after import so
 * the PIN keeps working.
 */
export async function importVaultBackup(
  file: File,
  key: CryptoKey,
) {
  const text = await file.text()
  const payload = JSON.parse(text)

  const iv = Uint8Array.from(payload.iv)
  const data = Uint8Array.from(payload.data)

  const backup = await decryptJSON<VaultBackup>(key, {
    iv,
    data: data.buffer,
  })

  // Snapshot current vault record before import overwrites the users store
  const currentVault = await getRecord<VaultRecord>(STORES.users, "vault")

  await importAllRecords(reviveBuffers(backup))

  // Restore this device's own vault record so the PIN keeps working
  if (currentVault) {
    await putRecord(STORES.users, currentVault)
  }
}

/**
 * Fresh-install import — vault doesn't exist yet, or was just set up
 * with a new random salt that doesn't match the backup.
 *
 * Flow:
 * 1. Read the salt from the outer payload (written at export time)
 * 2. Re-derive the key from PIN + backup salt
 * 3. Decrypt and restore all records (including the backup's vault record)
 *
 * After this the vault record in DB is the one from the backup,
 * keyed to the same salt+PIN as the original device — so PIN works.
 */
export async function importVaultBackupFresh(
  file: File,
  passcode: string,
): Promise<{ key: CryptoKey; autoLockMs: number }> {
  const text = await file.text()
  const raw = JSON.parse(text)

  if (!raw.salt) {
    throw new Error(
      "This backup was exported with an older version of the app. " +
      "Please export a new backup from your previous device, then try again.",
    )
  }

  // Re-derive the key the backup was originally encrypted with
  const salt = Uint8Array.from(raw.salt)
  const key = await deriveKey(passcode, salt)

  // Decrypt the backup envelope
  const iv = Uint8Array.from(raw.iv)
  const data = Uint8Array.from(raw.data)

  let backup: VaultBackup
  try {
    backup = await decryptJSON<VaultBackup>(key, { iv, data: data.buffer })
  } catch {
    throw new Error("Incorrect passcode or corrupted backup file.")
  }

  const revived = reviveBuffers(backup)

  // Verify PIN using the verifier stored inside the backup
  const vaultUser = revived.users?.find((u: any) => u.id === "vault")
  if (!vaultUser) throw new Error("Backup does not contain a vault record.")

  const ok = await checkVerifier(key, {
    iv: vaultUser.verifierIv,
    data: vaultUser.verifierData,
  })
  if (!ok) throw new Error("Incorrect passcode for this backup.")

  // Restore everything — the backup's vault record becomes this device's vault
  await importAllRecords(revived)

  return {
    key,
    autoLockMs: vaultUser.autoLockMs ?? 3 * 60 * 1000,
  }
}
