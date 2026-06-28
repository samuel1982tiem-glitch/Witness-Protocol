import { Filesystem, Directory } from "@capacitor/filesystem"
import {
  exportAllRecords,
  importAllRecords,
  type VaultBackup,
} from "./repo"

export async function exportVaultBackup() {
  const backup = await exportAllRecords()

  const json = JSON.stringify(backup, null, 2)

  const fileName =
    "WitnessProtocolBackup-" +
    new Date().toISOString().replace(/[:.]/g, "-") +
    ".wpb"

  await Filesystem.writeFile({
    path: fileName,
    data: json,
    directory: Directory.Documents,
    recursive: true,
  })

  return fileName
}

export async function importVaultBackup(file: File) {
  const text = await file.text()

  const backup: VaultBackup = JSON.parse(text)

  await importAllRecords(backup)
}