import { jsPDF } from "jspdf"
import { categoryName } from "./categories"
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

  // --- Investigator identity header (only if any field is filled) ---
  if (hasProfileContent(profile)) {
    heading("Investigator Identity", 11)
    if (profile?.name?.trim()) labelValue("Name:", profile.name.trim())
    if (profile?.governmentId?.trim())
      labelValue("Government ID:", profile.governmentId.trim())
    if (profile?.organization?.trim())
      labelValue("Organization:", profile.organization.trim())
    if (profile?.phone?.trim()) labelValue("Phone:", profile.phone.trim())
    if (profile?.email?.trim()) labelValue("Email:", profile.email.trim())
    line(10)
    doc.setDrawColor(200)
    doc.line(margin, y, pageWidth - margin, y)
    line(20)
  }

  // --- Incident header ---
  heading(incident.title || "Untitled incident", 16)

  labelValue("Category:", categoryName(incident.category))
  labelValue("Occurred:", formatDateTime(incident.occurredAt))
  labelValue("Logged:", formatDateTime(incident.createdAt))
  labelValue("Status:", incident.sealed ? "Sealed" : "Unsealed")
  if (incident.location) {
    labelValue(
      "GPS:",
      formatCoords(incident.location.latitude, incident.location.longitude),
    )
  }
  line(10)

  // --- Description ---
  heading("Description", 12)
  body(incident.description?.trim() || "No description provided.")
  line(10)

  // --- Evidence with images ---
  heading(`Evidence (${incident.evidence.length})`, 12)
  if (incident.evidence.length === 0) {
    body("No attachments on this record.")
  } else {
    for (const ev of incident.evidence) {
      // Evidence header with metadata
      checkPageBreak(40)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9.5)
      doc.text(`• ${ev.kind}`, margin, y)
      line(13)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8.5)
      doc.setTextColor(90)
      doc.text(
        `SHA-256: ${shortHash(ev.sha256, 16)}  ·  ${ev.mimeType}  ·  ${new Date(ev.createdAt).toLocaleString()}`,
        margin + 12,
        y,
      )
      doc.setTextColor(0)
      line(16)

      // Embed image if available and is an image type
      const evidenceData = evidenceWithData?.find((e) => e.meta.id === ev.id)
      if (
        evidenceData &&
        evidenceData.data &&
        (ev.kind === "photo" || ev.kind === "screenshot")
      ) {
        try {
          const dataUrl = bytesToDataUrl(evidenceData.data, ev.mimeType)

          // Get actual image dimensions
          const imgDims = await getImageDimensions(dataUrl)

          // Calculate scaled dimensions (max 280pt wide, 150pt tall to fit on page)
          const maxImgWidth = pageWidth - margin * 2
          const maxImgHeight = 150
          const { width: scaledWidth, height: scaledHeight } = calculateImageDimensions(
            imgDims.width,
            imgDims.height,
            maxImgWidth,
            maxImgHeight,
          )

          // Check if image will fit on current page; if not, move to next page
          if (y + scaledHeight > usableHeight - 20) {
            doc.addPage()
            y = margin
          }

          // Center the image horizontally
          const imgX = margin + (pageWidth - margin * 2 - scaledWidth) / 2

          doc.addImage(
            dataUrl,
            "JPEG",
            imgX,
            y,
            scaledWidth,
            scaledHeight,
            undefined,
            "NONE",
          )
          line(scaledHeight + 10)
        } catch (err) {
          console.error(`Failed to embed image for evidence ${ev.id}:`, err)
          doc.setFontSize(8)
          doc.setTextColor(200)
          doc.text("[Image could not be embedded]", margin, y)
          doc.setTextColor(0)
          line(15)
        }
      } else if (ev.kind === "document") {
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text("[Document - see separate file export]", margin, y)
        doc.setTextColor(0)
        line(15)
      } else if (ev.kind === "voice") {
        doc.setFontSize(8)
        doc.setTextColor(150)
        doc.text("[Voice recording - see separate file export]", margin, y)
        doc.setTextColor(0)
        line(15)
      }

      line(5)
    }
  }
  line(10)

  // --- Seal info ---
  if (incident.sealed && incident.seal) {
    heading("Evidence Seal", 12)
    labelValue("Sealed at:", formatDateTime(incident.seal.sealedAt))
    body(`SHA-256 (canonical hash): ${incident.seal.hash}`, 8.5)
  }

  // --- Footer with generation timestamp ---
  const pageCount = doc.internal.pages.length - 1
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFontSize(7.5)
    doc.setTextColor(150)
    doc.text(
      `Generated by Witness Protocol · ${new Date().toLocaleString()} · Page ${p} of ${pageCount}`,
      margin,
      pageHeight - 20,
    )
    doc.setTextColor(0)
  }

  return doc.output("blob")
}
