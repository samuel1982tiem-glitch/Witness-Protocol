import { exportAllRecords, importAllRecords } from "./repo"

export async function exportVaultBackup() {
  const data = await exportAllRecords()

  console.log("[BACKUP] exportAllRecords returned:", data)

  if (!data) {
    throw new Error("exportAllRecords returned undefined")
  }

  return data
}


export async function importVaultBackup(data: string) {
  return await importAllRecords(data)
}
