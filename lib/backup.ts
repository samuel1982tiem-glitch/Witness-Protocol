import { exportAllRecords, importAllRecords } from "./repo"

export async function exportVaultBackup() {
  return await exportAllRecords()
}

export async function importVaultBackup(data: string) {
  return await importAllRecords(data)
}
