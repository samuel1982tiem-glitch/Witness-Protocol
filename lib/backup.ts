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
  data: String(json),
  directory: Directory.Documents,
  recursive: true,
})

  return fileName
}

export async function importVaultBackup(contents: string) {
  return importAllRecords(contents)
}

