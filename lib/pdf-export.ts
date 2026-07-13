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

import { jsPDF } from "jspdf"
import { categoryName } from "./categories"
import { formatDateTime, formatCoords, shortHash } from "./format"
import { translate, type LanguageCode } from "./i18n"
import type { Incident, EvidenceMeta } from "./types"
import type { EvidenceRecord } from "./db"

interface InvestigatorProfile {
  name?: string
  governmentId?: string
  organization?: string
  phone?: string
  email?: string
}

interface EvidenceWithData {
  meta: EvidenceMeta
  record?: EvidenceRecord
  data?: Uint8Array
  mimeType: string
}

type DecryptEvidenceFn = (
  evidenceId: string,
) => Promise<{ data: Uint8Array; mimeType: string } | null>

function hasProfileContent(profile: InvestigatorProfile | null): boolean {
  if (!profile) return false
  return Boolean(
    profile.name?.trim() ||
      profile.governmentId?.trim() ||
      profile.organization?.trim() ||
      profile.phone?.trim() ||
      profile.email?.trim(),
  )
}

function bytesToDataUrl(data: Uint8Array, mimeType: string): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  const base64 = btoa(binary)
  return `data:${mimeType};base64,${base64}`
}

function calculateImageDimensions(
  origWidth: number,
  origHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const widthRatio = maxWidth / origWidth
  const heightRatio = maxHeight / origHeight
  const ratio = Math.min(widthRatio, heightRatio, 1)
  return { width: origWidth * ratio, height: origHeight * ratio }
}

async function downscaleForPdf(
  data: Uint8Array,
  mimeType: string,
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  const maxDim = 1200
  try {
    const blob = new Blob([data], { type: mimeType })
    if (typeof createImageBitmap !== "function") {
      return null
    }
    const probe = await createImageBitmap(blob)
    const scale = Math.min(1, maxDim / Math.max(probe.width, probe.height))
    const width = Math.round(probe.width * scale)
    const height = Math.round(probe.height * scale)
    probe.close?.()

    const bitmap = await createImageBitmap(blob, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: "medium",
    })

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      bitmap.close?.()
      return null
    }
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close?.()

    const outBlob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.7),
    )
    if (!outBlob) return null

    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error("Could not read downscaled blob"))
      reader.readAsDataURL(outBlob)
    })

    return { dataUrl, width, height }
  } catch (err) {
    console.error("Failed to downscale image for PDF:", err)
    return null
  }
}

interface PdfLayout {
  doc: jsPDF
  pageWidth: number
  pageHeight: number
  margin: number
  usableHeight: number
  y: number
  line: (height?: number) => void
  checkPageBreak: (needed?: number) => void
  heading: (text: string, size?: number) => void
  body: (text: string, size?: number) => void
  labelValue: (label: string, value: string) => void
  resetY: () => void
}

function createPdfLayout(doc: jsPDF): PdfLayout {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 48
  const footerHeight = 30
  const usableHeight = pageHeight - footerHeight
  let y = margin

  function line(height = 16) { y += height }
  function checkPageBreak(needed = 40) {
    if (y > usableHeight - needed) { doc.addPage(); y = margin }
  }
  function heading(text: string, size = 13) {
    checkPageBreak()
    doc.setFont("helvetica", "bold")
    doc.setFontSize(size)
    doc.text(text, margin, y)
    line(size + 6)
    doc.setFont("helvetica", "normal")
  }
  function body(text: string, size = 10) {
    doc.setFontSize(size)
    const wrapped = doc.splitTextToSize(text, pageWidth - margin * 2)
    for (const wline of wrapped) { checkPageBreak(); doc.text(wline, margin, y); line(size + 4) }
  }
  function labelValue(label: string, value: string) {
    checkPageBreak()
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.text(label, margin, y)
    const labelWidth = doc.getTextWidth(label)
    const valueX = margin + Math.max(110, labelWidth + 10)
    doc.setFont("helvetica", "normal")
    doc.text(value, valueX, y)
    line(15)
  }
  function resetY() { y = margin }

  return {
    doc, pageWidth, pageHeight, margin, usableHeight,
    get y() { return y }, set y(v: number) { y = v },
    line, checkPageBreak, heading, body, labelValue, resetY,
  }
}

function renderInvestigatorHeader(
  layout: PdfLayout,
  profile: InvestigatorProfile | null,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (!hasProfileContent(profile)) return
  const { doc, margin, pageWidth } = layout

  layout.heading(t("pdfExport.investigatorIdentity"), 11)
  if (profile?.name?.trim()) layout.labelValue(t("pdfExport.name"), profile.name.trim())
  if (profile?.governmentId?.trim())
    layout.labelValue(t("pdfExport.governmentId"), profile.governmentId.trim())
  if (profile?.organization?.trim())
    layout.labelValue(t("pdfExport.organization"), profile.organization.trim())
  if (profile?.phone?.trim()) layout.labelValue(t("pdfExport.phone"), profile.phone.trim())
  if (profile?.email?.trim()) layout.labelValue(t("pdfExport.email"), profile.email.trim())
  layout.line(10)
  doc.setDrawColor(200)
  doc.line(margin, layout.y, pageWidth - margin, layout.y)
  layout.line(20)
}

async function renderIncidentBody(
  layout: PdfLayout,
  incident: Incident,
  t: (key: string, vars?: Record<string, string | number>) => string,
  options?: {
    evidenceWithData?: EvidenceWithData[]
    decryptEvidence?: DecryptEvidenceFn
  },
) {
  const { doc, margin, pageWidth, usableHeight } = layout

  layout.heading(incident.title || t("pdfExport.untitledIncident"), 16)

  layout.labelValue(t("pdfExport.category"), categoryName(incident.category, t))
  layout.labelValue(t("pdfExport.occurred"), formatDateTime(incident.occurredAt))
  layout.labelValue(t("pdfExport.logged"), formatDateTime(incident.createdAt))
  layout.labelValue(
    t("pdfExport.status"),
    incident.sealed ? t("pdfExport.sealed") : t("pdfExport.unsealed"),
  )
  if (incident.location) {
    layout.labelValue(
      t("pdfExport.gps"),
      formatCoords(incident.location.latitude, incident.location.longitude),
    )
  }
  layout.line(10)

  layout.heading(t("pdfExport.description"), 12)
  layout.body(incident.description?.trim() || t("pdfExport.noDescriptionProvided"))
  layout.line(10)

  layout.heading(t("pdfExport.evidenceCount", { count: incident.evidence.length }), 12)
  if (incident.evidence.length === 0) {
    layout.body(t("pdfExport.noAttachments"))
  } else {
    for (const ev of incident.evidence) {
      layout.checkPageBreak(40)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9.5)
      doc.text(`\u2022 ${ev.kind}`, margin, layout.y)
      layout.line(13)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8.5)
      doc.setTextColor(90)
      doc.text(
        `SHA-256: ${shortHash(ev.sha256, 16)}  \u00b7  ${ev.mimeType}  \u00b7  ${new Date(ev.createdAt).toLocaleString()}`,
        margin + 12,
        layout.y,
      )
      doc.setTextColor(0)
      layout.line(16)

      let data: Uint8Array | undefined
      let mimeType = ev.mimeType

      if (ev.kind === "photo" || ev.kind === "screenshot") {
        const preloaded = options?.evidenceWithData?.find((e) => e.meta.id === ev.id)
        if (preloaded?.data) {
          data = preloaded.data
          mimeType = preloaded.mimeType
        } else if (options?.decryptEvidence) {
          try {
            const decrypted = await options.decryptEvidence(ev.id)
            if (decrypted) { data = decrypted.data; mimeType = decrypted.mimeType }
          } catch (err) {
            console.error(`Failed to decrypt evidence ${ev.id}:`, err)
          }
        }
      }

      if (data) {
        try {
          const downscaled = await downscaleForPdf(data, mimeType)
          if (!downscaled) throw new Error("downscale failed")
          const { dataUrl, width, height } = downscaled

          const maxImgWidth = pageWidth - margin * 2
          const maxImgHeight = 150
          const { width: scaledWidth, height: scaledHeight } = calculateImageDimensions(
            width, height, maxImgWidth, maxImgHeight,
          )

          if (layout.y + scaledHeight > usableHeight - 20) {
            doc.addPage(); layout.resetY()
          }

          const imgX = margin + (pageWidth - margin * 2 - scaledWidth) / 2
          doc.addImage(dataUrl, "JPEG", imgX, layout.y, scaledWidth, scaledHeight, undefined, "NONE")
          layout.line(scaledHeight + 10)
        } catch (err) {
          console.error(`Failed to embed image for evidence ${ev.id}:`, err)
          doc.setFontSize(8); doc.setTextColor(200)
          doc.text(t("pdfExport.imageEmbedFailed"), margin, layout.y)
          doc.setTextColor(0); layout.line(15)
        } finally {
          data = undefined
        }
      } else if (ev.kind === "document") {
        doc.setFontSize(8); doc.setTextColor(150)
        doc.text(t("pdfExport.documentPlaceholder"), margin, layout.y)
        doc.setTextColor(0); layout.line(15)
      } else if (ev.kind === "voice") {
        doc.setFontSize(8); doc.setTextColor(150)
        doc.text(t("pdfExport.voicePlaceholder"), margin, layout.y)
        doc.setTextColor(0); layout.line(15)
      }
      layout.line(5)
    }
  }
  layout.line(10)

  if (incident.sealed && incident.seal) {
    layout.heading(t("pdfExport.evidenceSeal"), 12)
    layout.labelValue(
      t("pdfExport.sealedAt", { time: formatDateTime(incident.seal.sealedAt) }),
      "",
    )
    layout.body(`SHA-256: ${incident.seal.hash}`, 8.5)
  }
}

function addFooter(
  doc: jsPDF,
  layout: PdfLayout,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const pageCount = doc.internal.pages.length - 1
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFontSize(7.5)
    doc.setTextColor(150)
    doc.text(
      t("pdfExport.footer", {
        date: new Date().toLocaleString(),
        page: p,
        total: pageCount,
      }),
      layout.margin,
      layout.pageHeight - 20,
    )
    doc.setTextColor(0)
  }
}

export async function generateIncidentPdf(
  incident: Incident,
  profile: InvestigatorProfile | null,
  evidenceWithData?: EvidenceWithData[],
  language: LanguageCode = "en",
): Promise<Blob> {
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(language, key, vars)
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true })
  const layout = createPdfLayout(doc)

  renderInvestigatorHeader(layout, profile, t)
  await renderIncidentBody(layout, incident, t, { evidenceWithData })
  addFooter(doc, layout, t)

  return doc.output("blob")
}

export async function generateBulkIncidentsPdf(
  incidents: Incident[],
  profile: InvestigatorProfile | null,
  decryptEvidence: DecryptEvidenceFn,
  language: LanguageCode = "en",
): Promise<Blob> {
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(language, key, vars)
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true })
  const layout = createPdfLayout(doc)

  renderInvestigatorHeader(layout, profile, t)
  layout.heading(t("pdfExport.bulkReportTitle", { count: incidents.length }), 14)
  layout.body(t("pdfExport.generatedAt", { date: new Date().toLocaleString() }))

  for (const incident of incidents) {
    doc.addPage()
    layout.resetY()
    await renderIncidentBody(layout, incident, t, { decryptEvidence })
  }

  addFooter(doc, layout, t)
  return doc.output("blob")
}
