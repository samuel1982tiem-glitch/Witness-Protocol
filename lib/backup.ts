78import { encryptJSON, decryptJSON } from "./crypto"
import { Filesystem, Directory } from "@capacitor/filesystem"
import {
  exportAllRecords,
  importAllRecords,
  type VaultBackup,
} from "./repo"

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

  for (const user of backup.users ?? []) {
    if ("salt" in user) {
      user.salt = new Uint8Array(user.salt as any)
    }

    if ("verifierIv" in user) {
      user.verifierIv = new Uint8Array(user.verifierIv as any)
    }

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

  const payload = {
    version: 3,
    exportedAt: Date.now(),
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

export async function importVaultBackup(
  file: File,
  key: CryptoKey,
) {
  const text = await file.text()

  const payload = JSON.parse(text)

  const iv = Uint8Array.from(payload.iv)

  const data = Uint8Array.from(payload.data)

  const backup = await decryptJSON<VaultBackup>(
    key,
    {
      iv,
      data: data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength,
      ),
    },
  )

  await importAllRecords(reviveBuffers(backup))
}