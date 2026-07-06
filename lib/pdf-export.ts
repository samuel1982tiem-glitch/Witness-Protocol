import { jsPDF } from "jspdf"
import { CATEGORY_MAP } from "./categories"
import { formatCoords, formatDateTime, shortHash } from "./format"
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

/**
 * Converts raw image bytes to a data URL for embedding in PDF.
 */
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

/**
 * Calculate image dimensions that preserve aspect ratio while fitting in max width/height.
 */
function calculateImageDimensions(
  origWidth: number,
  origHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const widthRatio = maxWidth / origWidth
  const heightRatio = maxHeight / origHeight
  const ratio = Math.min(widthRatio, heightRatio, 1) // don't upscale

  return {
    width: origWidth * ratio,
    height: origHeight * ratio,
  }
}

/**
 * Get image dimensions from a Blob/data URL by decoding the image.
 */
async function getImageDimensions(
  dataUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      reject(new Error("Failed to load image"))
    }
    img.src = dataUrl
  })
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

/**
 * Creates the shared layout/drawing helpers used by both the single-incident
 * and bulk exports, so both stay pixel-identical for the parts they share.
 */
function createPdfLayout(doc: jsPDF): PdfLayout {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 48
  const footerHeight = 30
  const usableHeight = pageHeight - footerHeight
  let y = margin

  function line(height = 16) {
    y += height
  }

  function checkPageBreak(needed = 40) {
    if (y > usableHeight - needed) {
      doc.addPage()
      y = margin
    }
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
    for (const wline of wrapped) {
      checkPageBreak()
      doc.text(wline, margin, y)
      line(size + 4)
    }
  }

  function labelValue(label: string, value: string) {
    checkPageBreak()
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.text(label, margin, y)
    doc.setFont("helvetica", "normal")
    doc.text(value, margin + 110, y)
    line(15)
  }

  function resetY() {
    y = margin
  }

  return {
    doc,
    pageWidth,
    pageHeight,
    margin,
    usableHeight,
    get y() {
      return y
    },
    set y(value: number) {
      y = value
    },
    line,
    checkPageBreak,
    heading,
    body,
    labelValue,
    resetY,
  }
}

function renderInvestigatorHeader(
  layout: PdfLayout,
  profile: InvestigatorProfile | null,
) {
  if (!hasProfileContent(profile)) return
  const { doc, margin, pageWidth } = layout

  layout.heading("Investigator Identity", 11)
  if (profile?.name?.trim()) layout.labelValue("Name:", profile.name.trim())
  if (profile?.governmentId?.trim())
    layout.labelValue("Government ID:", profile.governmentId.trim())
  if (profile?.organization?.trim())
    layout.labelValue("Organization:", profile.organization.trim())
  if (profile?.phone?.trim()) layout.labelValue("Phone:", profile.phone.trim())
  if (profile?.email?.trim()) layout.labelValue("Email:", profile.email.trim())
  layout.line(10)
  doc.setDrawColor(200)
  doc.line(margin, layout.y, pageWidth - margin, layout.y)
  layout.line(20)
}

/**
 * Renders one incident's content (header, description, evidence w/ embedded
 * images, seal info) onto the current page of an already-created layout.
 * Shared by both the single-incident and bulk exporters.
 */
async function renderIncidentBody(
  layout: PdfLayout,
  incident: Incident,
  evidenceWithData?: EvidenceWithData[],
) {
  const { doc, margin, pageWidth, usableHeight } = layout

  // --- Incident header ---
  layout.heading(incident.title || "Untitled incident", 16)

  layout.labelValue("Category:", CATEGORY_MAP[incident.category]?.name ?? "Unknown")
  layout.labelValue("Occurred:", formatDateTime(incident.occurredAt))
  layout.labelValue("Logged:", formatDateTime(incident.createdAt))
  layout.labelValue("Status:", incident.sealed ? "Sealed" : "Unsealed")
  if (incident.location) {
    layout.labelValue(
      "GPS:",
      formatCoords(incident.location.latitude, incident.location.longitude),
    )
  }
  layout.line(10)

  // --- Description ---
  layout.heading("Description", 12)
  layout.body(incident.description?.trim() || "No description provided.")
  layout.line(10)

  // --- Evidence with images ---
  layout.heading(`Evidence (${incident.evidence.length})`, 12)
  if (incident.evidence.length === 0) {
    layout.body("No attachments on this record.")
  } else {
    for (const ev of incident.evidence) {
      layout.checkPageBreak(40)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9.5)
      doc.text(`• ${ev.kind}`, margin, layout.y)
      layout.line(13)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8.5)
      doc.setTextColor(90)
      doc.text(
        `SHA-256: ${shortHash(ev.sha256, 16)}  ·  ${ev.mimeType}  ·  ${new Date(ev.createdAt).toLocaleString()}`,
        margin + 12,
        layout.y,
      )
      doc.setTextColor(0)
      layout.line(16)

      const evidenceData = evidenceWithData?.find((e) => e.meta.id === ev.id)
      if (
        evidenceData &&
        evidenceData.data &&
        (ev.kind === "photo" || ev.kind === "screenshot")
      ) {
        try {
          const dataUrl = bytesToDataUrl(evidenceData.data, ev.mimeType)
          const imgDims = await getImageDimensions(dataUrl)

          const maxImgWidth = pageWidth - margin * 2
          const maxImgHeight = 150
          const { width: scaledWidth, height: scaledHeight } = calculateImageDimensions(
            imgDims.width,
            imgDims.height,
            maxImgWidth,
            maxImgHeight,
          )

          if (layout.y + scaledHeight > usableHeight - 20) {
            doc.addPage()
            layout.resetY()
          }

          const imgX = margin + (pageWidth - margin * 2 - scaledWidth) / 2

          doc.addImage(
            dataUrl,
            "JPEG",
            imgX,
            layout.y,
            scaledWidth,
            scaledHeight,
            undefined,
            "NONE",
          )
          layout.line(scaledHeight + 10)
        } catch (err) {
          console.error(`Failed to embed image for evidence ${ev.id}:`, err)
          doc.setFontSize(8)
          doc.setTextColor(200)
          doc.text("[Image could not be embedded]", margin, layout.y)
          doc.setTextColor(0)
          layout.line(15)
        }
      } else if (ev.kind === "document") {
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text("[Document - see separate file export]", margin, layout.y)
        doc.setTextColor(0)
        layout.line(15)
      } else if (ev.kind === "voice") {
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text("[Voice recording - see separate file export]", margin, layout.y)
        doc.setTextColor(0)
        layout.line(15)
      }

      layout.line(5)
    }
  }
  layout.line(10)

  // --- Seal info ---
  if (incident.sealed && incident.seal) {
    layout.heading("Evidence Seal", 12)
    layout.labelValue("Sealed at:", formatDateTime(incident.seal.sealedAt))
    layout.body(`SHA-256 (canonical hash): ${incident.seal.hash}`, 8.5)
  }
}

function addFooter(doc: jsPDF, layout: PdfLayout) {
  const pageCount = doc.internal.pages.length - 1
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFontSize(7.5)
    doc.setTextColor(150)
    doc.text(
      `Generated by Witness Protocol · ${new Date().toLocaleString()} · Page ${p} of ${pageCount}`,
      layout.margin,
      layout.pageHeight - 20,
    )
    doc.setTextColor(0)
  }
}

/**
 * Generates a single-incident PDF report with:
 * - Investigator identity header (if filled out)
 * - Incident details, GPS, category
 * - Full evidence list with images embedded (properly scaled, centered, and not cut off)
 * - Evidence hashes and metadata
 * - Seal info if sealed
 *
 * Returns the PDF as a Blob for saving or sharing.
 */
export async function generateIncidentPdf(
  incident: Incident,
  profile: InvestigatorProfile | null,
  evidenceWithData?: EvidenceWithData[],
): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const layout = createPdfLayout(doc)

  renderInvestigatorHeader(layout, profile)
  await renderIncidentBody(layout, incident, evidenceWithData)
  addFooter(doc, layout)

  return doc.output("blob")
}

/**
 * Generates a single PDF containing every incident passed in, one per page,
 * with one shared investigator identity header and a combined page-numbered
 * footer across the whole document. Evidence for each incident is fetched
 * lazily via `getEvidenceForIncident` and processed one incident at a time
 * (not all up front) to keep peak memory bounded on large exports.
 */
export async function generateBulkIncidentsPdf(
  incidents: Incident[],
  profile: InvestigatorProfile | null,
  getEvidenceForIncident: (incident: Incident) => Promise<EvidenceWithData[]>,
): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const layout = createPdfLayout(doc)

  renderInvestigatorHeader(layout, profile)
  layout.heading(`Incident Report — ${incidents.length} record(s)`, 14)
  layout.body(`Generated ${new Date().toLocaleString()}`)

  for (const incident of incidents) {
    doc.addPage()
    layout.resetY()
    const evidenceWithData = await getEvidenceForIncident(incident)
    await renderIncidentBody(layout, incident, evidenceWithData)
  }

  addFooter(doc, layout)

  return doc.output("blob")
}
