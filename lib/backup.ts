import { Filesystem, Directory, Encoding } from "@capacitor/filesystem"
import { exportAllRecords, importAllRecords } from "./repo"

export async function exportVaultBackup() {
  const json = await exportAllRecords()

  const fileName =
    "WitnessProtocolBackup-" +
    new Date().toISOString().replace(/[:.]/g, "-") +
    ".json"

  await Filesystem.writeFile({
    path: fileName,
    data: json,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  })

  return fileName
}

export async function importVaultBackup(contents: string) {
  return importAllRecords(contents)
}

