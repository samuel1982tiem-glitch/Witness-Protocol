export async function mergeVaultBackup(
  file: File,
  passcode: string,
  currentKey: CryptoKey,
  onProgress?: (progress: MergeProgress) => void,
): Promise<MergeResult> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const format = detectFileFormat(bytes, file.name)

  if (format === "png") {
    throw new Error(
      "This file is an image (PNG), not a valid backup file. Please select a .wpb or .wpbz file.",
    )
  }

  if (format === "unknown") {
    throw new Error(
      "This file format is not recognized. Please select a valid backup file (.wpb or .wpbz).",
    )
  }

  let parsed: ParsedBackup

  if (format === "zip") {
    parsed = await parseVaultBackupV4(bytes, passcode)
  } else if (format === "json") {
    try {
      const text = new TextDecoder().decode(bytes)
      const raw = JSON.parse(text)
      parsed = await parseVaultBackupV3(raw, passcode)
    } catch {
      throw new Error(
        "The file is not a valid JSON backup. Please ensure you selected the correct file.",
      )
    }
  } else {
    throw new Error(
      "Unable to determine file format. Please select a valid backup file (.wpb or .wpbz).",
    )
  }

  const result = await mergeIncidentRecords(
    parsed.sourceKey,
    currentKey,
    parsed.incidents,
    parsed.evidence,
    parsed.seals,
    onProgress,
  );

  // Import investigator identity from the backup
  let identityImported = false;
  if (parsed.userProfile && parsed.userProfile.length > 0) {
    try {
      const profileRecord = parsed.userProfile.find((p: any) => p.id === "profile") ||
        parsed.userProfile[parsed.userProfile.length - 1];

      const plaintext = await decryptJSON<any>(
        parsed.sourceKey,
        { iv: profileRecord.iv, data: profileRecord.data }
      );

      if (plaintext) {
        await saveUserProfile(currentKey, plaintext);
        identityImported = true;
        console.log('✅ Investigator identity imported during merge');
      }
    } catch (err) {
      console.error("Failed to import investigator identity during merge:", err);
    }
  }

  return { ...result, identityImported };
}
// ---------------------------------------------------------------------------
// Streaming export — processes evidence one file at a time and writes
// ZIP chunks to disk incrementally, instead of building the entire
// backup in memory before writing. This fixes out-of-memory crashes on
// exports with many/large media attachments.
// ---------------------------------------------------------------------------

export type ExportStage =
  | "preparing"
  | "metadata"
  | "evidence"
  | "finishing"
  | "saving"

export interface ExportProgress {
  stage: ExportStage
  processed: number
  total: number
  currentName: string
  percent: number
  etaSeconds: number | null
}

function uint8ToBase64Chunk(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

/**
 * Export the vault as a Version 4 (.wpbz) backup, processing evidence
 * one file at a time and writing to disk incrementally via fflate's
 * streaming Zip API + Capacitor Filesystem writeFile/appendFile.
 *
 * Peak memory is roughly "one decrypted evidence file + one ZIP chunk"
 * rather than "every evidence file decrypted simultaneously plus the
 * entire ZIP buffered in memory", which is what exportVaultBackupV4
 * (non-streaming, kept for reference) does.
 */
export async function exportVaultBackupV4Streaming(
  key: CryptoKey,
  onProgress?: (progress: ExportProgress) => void,
): Promise<string> {
  const vault = await getRecord<VaultRecord>(STORES.users, "vault")
  if (!vault) throw new Error("Vault is not set up.")

  onProgress?.({
    stage: "preparing",
    processed: 0,
    total: 0,
    currentName: "",
    percent: 0,
    etaSeconds: null,
  })

  const evidenceRecords = await listEvidenceRecords()
  const total = evidenceRecords.length
  const startTime = Date.now()

  const fileName =
    "WitnessProtocolBackup-" +
    new Date().toISOString().replace(/[:.]/g, "-") +
    ".wpbz"

  let wroteFirstChunk = false
  let pendingWrites: Promise<any> = Promise.resolve()
  let zipError: unknown = null

  const zip = new Zip((err, chunk, _final) => {
    if (err) {
      zipError = err
      return
    }
    pendingWrites = pendingWrites.then(async () => {
      const b64 = uint8ToBase64Chunk(chunk)
      if (!wroteFirstChunk) {
        wroteFirstChunk = true
        await Filesystem.writeFile({
          path: fileName,
          data: b64,
          directory: Directory.Cache,
          recursive: true,
        })
      } else {
        await Filesystem.appendFile({
          path: fileName,
          data: b64,
          directory: Directory.Cache,
        })
      }
    })
  })

  // --- Metadata section (excludes evidence — that's streamed separately) ---
  onProgress?.({
    stage: "metadata",
    processed: 0,
    total,
    currentName: "",
    percent: 2,
    etaSeconds: null,
  })

  const metadata = await exportMetadataOnly()
  const metaPlain = new TextEncoder().encode(JSON.stringify(metadata))
  const metaCompressed = await compress(metaPlain)
  const metaEncrypted = await encryptRaw(key, metaCompressed)

  const manifestEntry = new ZipPassThrough("manifest.json")
  zip.add(manifestEntry)
  manifestEntry.push(
    new TextEncoder().encode(
      JSON.stringify({
        version: 4,
        exportedAt: Date.now(),
        salt: Array.from(vault.salt),
        evidenceCount: total,
      } satisfies ManifestV4),
    ),
    true,
  )

  const metaEntry = new ZipPassThrough("meta.json.enc")
  zip.add(metaEntry)
  metaEntry.push(metaEncrypted, true)

  // --- Evidence section: one file at a time ---
  for (let i = 0; i < evidenceRecords.length; i++) {
    if (zipError) throw zipError

    const record = evidenceRecords[i]

    const { name, raw } = await decryptEvidenceRaw(key, record)
    const encrypted = await encryptRaw(key, raw)

    const evEntry = new ZipPassThrough(`evidence/${record.id}.enc`)
    zip.add(evEntry)
    evEntry.push(encrypted, true)

    const sidecarEntry = new ZipPassThrough(`evidence/${record.id}.json`)
    zip.add(sidecarEntry)
    sidecarEntry.push(
      new TextEncoder().encode(
        JSON.stringify({
          id: record.id,
          incidentId: record.incidentId,
          kind: record.kind,
          mimeType: record.mimeType,
          size: record.size,
          sha256: record.sha256,
          createdAt: record.createdAt,
          name,
        }),
      ),
      true,
    )

    const processed = i + 1
    const elapsed = (Date.now() - startTime) / 1000
    const avgPerFile = elapsed / processed
    const remaining = total - processed
    const etaSeconds = processed >= 2 ? Math.round(avgPerFile * remaining) : null

    onProgress?.({
      stage: "evidence",
      processed,
      total,
      currentName: name,
      percent: total > 0 ? Math.round(5 + (processed / total) * 85) : 90,
      etaSeconds,
    })
  }

  onProgress?.({
    stage: "finishing",
    processed: total,
    total,
    currentName: "",
    percent: 95,
    etaSeconds: null,
  })

  zip.end()
  await pendingWrites

  if (zipError) throw zipError

  onProgress?.({
    stage: "saving",
    processed: total,
    total,
    currentName: "",
    percent: 100,
    etaSeconds: 0,
  })

  // Directory.Cache is app-private sandboxed storage — not browsable
  // from a file manager or visible outside the app. Immediately share
  // it so the user can save to Downloads, Drive, etc. via the share sheet.
  try {
    const { Share } = await import("@capacitor/share")
    const uriResult = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Cache,
    })
    await Share.share({ url: uriResult.uri, title: fileName })
  } catch (err) {
    console.log("[backup] share step failed:", err)
    // The file still exists in app cache even if sharing failed —
    // don't throw, since the export itself succeeded.
  }

  return fileName
}
