// Witness Protocol
// Copyright (C) 2026 Samuel Matias Tiem
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

// Streams a "WP-INCIDENTS/<date> - <title>/" folder per incident into a
// single .zip, each folder containing that incident's PDF plus its
// original evidence files (photos, videos, voice notes, documents).
//
// Follows the same memory-safe pattern as lib/backup.ts's .wpbz export:
// fflate's streaming Zip API + Capacitor Filesystem writeFile/appendFile,
// processing one incident (and within it, one evidence file) at a time,
// so peak memory never holds more than a single decrypted file plus one
// zip chunk -- regardless of total incident/evidence count.

import { Zip, ZipPassThrough } from "fflate"
import { generateIncidentPdf } from "./pdf-export"
import type { LanguageCode } from "./i18n"
import type { Incident, EvidenceMeta } from "./types"
import type { EvidenceRecord } from "./db"

interface InvestigatorProfile {
  name?: string
  governmentId?: string
  organization?: string
  phone?: string
  email?: string
}

export interface PackageProgress {
  processed: number
  total: number
  currentTitle: string
  percent: number
}

const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}

function guessExt(mimeType: string): string {
  return EXT_MAP[mimeType] || mimeType.split("/")[1] || "bin"
}

function safeFileName(name: string | undefined, kind: string, id: string, mimeType: string): string {
  const ext = guessExt(mimeType)
  let safeName = name && name.trim().length > 0 ? name.trim() : `${kind}-${id}.${ext}`
  if (!/\.[a-zA-Z0-9]{2,5}$/.test(safeName)) {
    safeName = `${safeName}.${ext}`
  }
  // Strip characters that are unsafe in zip paths / most filesystems.
  return safeName.replace(/[\\/:*?"<>|]/g, "_")
}

function safeFolderName(incident: Incident): string {
  const d = new Date(incident.occurredAt)
  const pad = (n: number) => String(n).padStart(2, "0")
  const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}`
  const title = (incident.title || "untitled")
    .replace(/[\\/:*?"<>|]/g, "_")
    .slice(0, 60)
    .trim()
  return `${dateStr} - ${title || "untitled"}`
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
 * Streams a full "WP-INCIDENTS" package to disk as a .zip and returns its
 * file:// URI (via Capacitor Filesystem), ready to be shared once by the
 * caller. Does not call Share itself -- keeps this module focused on
 * building the archive.
 */
export async function generateIncidentsPackage(
  incidents: Incident[],
  profile: InvestigatorProfile | null,
  getEvidenceRecords: (incidentId: string) => Promise<EvidenceRecord[]>,
  decryptEvidenceRaw: (record: EvidenceRecord) => Promise<{ name: string; raw: Uint8Array }>,
  onProgress?: (p: PackageProgress) => void,
  language: LanguageCode = "en",
  diaryRecords: any[] = [],
  decryptDiaryRaw?: (record: any) => Promise<{ text: string | null; audioBytes: Uint8Array; mimeType: string }>,
): Promise<string> {
  const { Filesystem, Directory } = await import("@capacitor/filesystem")

  const fileName = "WP-INCIDENTS-" + new Date().toISOString().replace(/[:.]/g, "-") + ".zip"

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

  const total = incidents.length

  for (let i = 0; i < incidents.length; i++) {
    if (zipError) throw zipError
    const incident = incidents[i]
    const folder = `WP-INCIDENTS/${safeFolderName(incident)}`

    onProgress?.({
      processed: i,
      total,
      currentTitle: incident.title || "Untitled incident",
      percent: total > 0 ? Math.round((i / total) * 100) : 0,
    })

    // One incident's evidence, fetched and decrypted for the PDF preview
    // step (photos only, same as bulk PDF export) -- reuses the existing
    // per-incident PDF generator, which already downscales photos.
    const evidenceRecords = await getEvidenceRecords(incident.id)
    const embeddable = evidenceRecords.filter(
      (r) => r.kind === "photo" || r.kind === "screenshot",
    )
    const evidenceWithData: any[] = []
    for (const record of embeddable) {
      try {
        const { name, raw } = await decryptEvidenceRaw(record)
        evidenceWithData.push({
          meta: {
            id: record.id,
            incidentId: record.incidentId,
            kind: record.kind,
            name: name || "",
            mimeType: record.mimeType,
            size: record.size,
            sha256: record.sha256,
            createdAt: record.createdAt,
          },
          record,
          data: raw,
          mimeType: record.mimeType,
        })
      } catch (err) {
        console.error(`Failed to decrypt evidence ${record.id} for PDF:`, err)
      }
    }

    const pdfBlob = await generateIncidentPdf(incident, profile, evidenceWithData, language)
    const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer())
    evidenceWithData.length = 0 // release photo bytes now that the PDF is built

    const pdfEntry = new ZipPassThrough(`${folder}/incident.pdf`)
    zip.add(pdfEntry)
    pdfEntry.push(pdfBytes, true)

    // Now stream every evidence file (all kinds -- photos, videos, voice,
    // documents) into the incident's folder, one at a time, decrypting
    // and releasing each before moving to the next.
    for (const record of evidenceRecords) {
      if (zipError) throw zipError
      try {
        const { name, raw } = await decryptEvidenceRaw(record)
        const fname = safeFileName(name, record.kind, record.id, record.mimeType)
        const entry = new ZipPassThrough(`${folder}/${fname}`)
        zip.add(entry)
        entry.push(raw, true)
      } catch (err) {
        console.error(`Failed to package evidence ${record.id}:`, err)
      }
    }
  }

  onProgress?.({ processed: total, total, currentTitle: "", percent: 100 })

  // Stream diary entries into a separate WP-DIARY folder, one subfolder
  // per entry (audio file + optional notes.txt), same one-at-a-time
  // decrypt-then-release pattern as evidence above.
  if (diaryRecords.length > 0 && decryptDiaryRaw) {
    for (const record of diaryRecords) {
      if (zipError) throw zipError
      try {
        const { text, audioBytes, mimeType } = await decryptDiaryRaw(record)
        const d = new Date(record.createdAt)
        const pad = (n: number) => String(n).padStart(2, "0")
        const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}`
        const entryFolder = `WP-DIARY/${dateStr}`

        const ext = guessExt(mimeType)
        const audioEntry = new ZipPassThrough(`${entryFolder}/audio.${ext}`)
        zip.add(audioEntry)
        audioEntry.push(audioBytes, true)

        if (text && text.trim().length > 0) {
          const notesBytes = new TextEncoder().encode(text)
          const notesEntry = new ZipPassThrough(`${entryFolder}/notes.txt`)
          zip.add(notesEntry)
          notesEntry.push(notesBytes, true)
        }
      } catch (err) {
        console.error(`Failed to package diary entry ${record.id}:`, err)
      }
    }
  }

  zip.end()
  await pendingWrites
  if (zipError) throw zipError

  const uriResult = await Filesystem.getUri({ path: fileName, directory: Directory.Cache })
  return uriResult.uri
}
