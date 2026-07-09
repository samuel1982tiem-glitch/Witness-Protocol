// Report Generator: assembles a structured report from incident data,
// with optional date-range/category filtering, an optional evidence
// list, and a pattern-analysis summary (reusing lib/patterns.ts). Two
// renderers are provided: plain text (for copy/paste into legal
// documents) and rich HTML (for direct printing / saving as a file).
//
// Deliberately does NOT touch lib/pdf-export.ts or lib/patterns.ts's
// existing exports -- purely additive, built on top of what's already
// public (Incident[], PatternAlert[], analyzeIncidents, translatePatternAlert,
// categoryName, formatDateTime).

import { analyzeIncidents, translatePatternAlert } from "./patterns"
import { categoryName } from "./categories"
import { formatDateTime, formatCoords, shortHash } from "./format"
import type { Incident, CategoryId, PatternAlert } from "./types"

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string

export interface InvestigatorProfile {
  name?: string
  governmentId?: string
  organization?: string
  phone?: string
  email?: string
}

export interface ReportOptions {
  /** Inclusive lower bound (epoch ms), or null for no lower bound. */
  dateFrom: number | null
  /** Inclusive upper bound (epoch ms), or null for no upper bound. */
  dateTo: number | null
  /** Category ids to include, or null to include all categories. */
  categories: CategoryId[] | null
  /** Whether to list each incident's evidence (kind/name/timestamp). Never includes decrypted file bytes. */
  includeEvidence: boolean
}

export interface ReportPatternSummary {
  title: string
  observation: string
  detail: string
}

export interface ReportData {
  generatedAt: number
  profile: InvestigatorProfile | null
  options: ReportOptions
  /** Filtered + chronologically sorted (oldest first). */
  incidents: Incident[]
  patterns: ReportPatternSummary[]
}

/**
 * Filters incidents by the report options' date range and categories,
 * then sorts them chronologically (oldest occurredAt first, matching a
 * timeline read top-to-bottom).
 */
function filterAndSortIncidents(
  incidents: Incident[],
  options: ReportOptions,
): Incident[] {
  const filtered = incidents.filter((inc) => {
    if (options.dateFrom !== null && inc.occurredAt < options.dateFrom) return false
    if (options.dateTo !== null && inc.occurredAt > options.dateTo) return false
    if (options.categories !== null && !options.categories.includes(inc.category)) return false
    return true
  })
  return filtered.sort((a, b) => a.occurredAt - b.occurredAt)
}

/**
 * Assembles the full ReportData: filters/sorts incidents per options,
 * and runs pattern analysis over the FILTERED set (so pattern findings
 * reflect the same scope the report is actually covering, not the whole
 * vault) translated via the current language's t().
 */
export function buildReportData(
  incidents: Incident[],
  profile: InvestigatorProfile | null,
  options: ReportOptions,
  t: TranslateFn,
): ReportData {
  const scopedIncidents = filterAndSortIncidents(incidents, options)

  const alerts: PatternAlert[] = analyzeIncidents(scopedIncidents)
  const patterns: ReportPatternSummary[] = alerts.map((alert) =>
    translatePatternAlert(alert, t),
  )

  return {
    generatedAt: Date.now(),
    profile,
    options,
    incidents: scopedIncidents,
    patterns,
  }
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

// ---------------------------------------------------------------------------
// Plain text renderer
// ---------------------------------------------------------------------------

/**
 * Renders the report as plain text, suitable for copy/paste into legal
 * documents or other word processors. No markup of any kind.
 */
export function generateReportText(data: ReportData, t: TranslateFn): string {
  const lines: string[] = []
  const rule = "─".repeat(48)

  // --- Header ---
  lines.push(t("report.title"))
  lines.push(rule)
  if (hasProfileContent(data.profile)) {
    if (data.profile?.name?.trim()) lines.push(`${t("pdfExport.name")} ${data.profile.name.trim()}`)
    if (data.profile?.governmentId?.trim())
      lines.push(`${t("pdfExport.governmentId")} ${data.profile.governmentId.trim()}`)
    if (data.profile?.organization?.trim())
      lines.push(`${t("pdfExport.organization")} ${data.profile.organization.trim()}`)
    if (data.profile?.phone?.trim()) lines.push(`${t("pdfExport.phone")} ${data.profile.phone.trim()}`)
    if (data.profile?.email?.trim()) lines.push(`${t("pdfExport.email")} ${data.profile.email.trim()}`)
  }
  lines.push(`${t("report.generatedOn")} ${formatDateTime(data.generatedAt)}`)
  lines.push("")

  // --- Timeline ---
  lines.push(t("report.timelineHeading"))
  lines.push(rule)
  if (data.incidents.length === 0) {
    lines.push(t("report.noIncidents"))
  } else {
    for (const incident of data.incidents) {
      lines.push("")
      lines.push(`${formatDateTime(incident.occurredAt)} — ${incident.title || t("pdfExport.untitledIncident")}`)
      lines.push(`${t("pdfExport.category")} ${categoryName(incident.category, t)}`)
      lines.push(
        `${t("pdfExport.status")} ${incident.sealed ? t("pdfExport.sealed") : t("pdfExport.unsealed")}`,
      )
      if (incident.location) {
        lines.push(`${t("pdfExport.gps")} ${formatCoords(incident.location.latitude, incident.location.longitude)}`)
      }
      if (incident.description?.trim()) {
        lines.push(incident.description.trim())
      }
      if (data.options.includeEvidence && incident.evidence.length > 0) {
        lines.push(t("pdfExport.evidenceCount", { count: incident.evidence.length }))
        for (const ev of incident.evidence) {
          lines.push(
            `  • ${ev.kind} — ${ev.name || ev.id} (${new Date(ev.createdAt).toLocaleString()}, SHA-256 ${shortHash(ev.sha256, 12)})`,
          )
        }
      }
    }
  }
  lines.push("")

  // --- Pattern summary ---
  lines.push(t("report.patternsHeading"))
  lines.push(rule)
  if (data.patterns.length === 0) {
    lines.push(t("report.noPatterns"))
  } else {
    for (const p of data.patterns) {
      lines.push(`- ${p.title}: ${p.observation} ${p.detail}`)
    }
  }
  lines.push("")

  // --- Footer ---
  lines.push(rule)
  lines.push(t("report.footer"))
  lines.push("")
  lines.push(t("report.signatureLine"))

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Rich text (HTML) renderer -- for direct printing
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Renders the report as a standalone, print-ready HTML document (system
 * fonts only, no external assets). Intended to be opened directly (e.g.
 * via the browser's Print dialog) rather than embedded elsewhere.
 */
export function generateReportHtml(data: ReportData, t: TranslateFn): string {
  const esc = escapeHtml

  const profileRows: string[] = []
  if (hasProfileContent(data.profile)) {
    if (data.profile?.name?.trim())
      profileRows.push(`<tr><th>${esc(t("pdfExport.name"))}</th><td>${esc(data.profile.name.trim())}</td></tr>`)
    if (data.profile?.governmentId?.trim())
      profileRows.push(`<tr><th>${esc(t("pdfExport.governmentId"))}</th><td>${esc(data.profile.governmentId.trim())}</td></tr>`)
    if (data.profile?.organization?.trim())
      profileRows.push(`<tr><th>${esc(t("pdfExport.organization"))}</th><td>${esc(data.profile.organization.trim())}</td></tr>`)
    if (data.profile?.phone?.trim())
      profileRows.push(`<tr><th>${esc(t("pdfExport.phone"))}</th><td>${esc(data.profile.phone.trim())}</td></tr>`)
    if (data.profile?.email?.trim())
      profileRows.push(`<tr><th>${esc(t("pdfExport.email"))}</th><td>${esc(data.profile.email.trim())}</td></tr>`)
  }

  const incidentBlocks = data.incidents.length === 0
    ? `<p class="muted">${esc(t("report.noIncidents"))}</p>`
    : data.incidents
        .map((incident) => {
          const evidenceBlock =
            data.options.includeEvidence && incident.evidence.length > 0
              ? `<p class="evidence-heading">${esc(t("pdfExport.evidenceCount", { count: incident.evidence.length }))}</p>
                 <ul class="evidence-list">
                   ${incident.evidence
                     .map(
                       (ev) =>
                         `<li>${esc(ev.kind)} — ${esc(ev.name || ev.id)} (${esc(new Date(ev.createdAt).toLocaleString())}, SHA-256 ${esc(shortHash(ev.sha256, 12))})</li>`,
                     )
                     .join("")}
                 </ul>`
              : ""

          return `
            <div class="incident">
              <h3>${esc(formatDateTime(incident.occurredAt))} — ${esc(incident.title || t("pdfExport.untitledIncident"))}</h3>
              <table class="meta">
                <tr><th>${esc(t("pdfExport.category"))}</th><td>${esc(categoryName(incident.category, t))}</td></tr>
                <tr><th>${esc(t("pdfExport.status"))}</th><td>${esc(incident.sealed ? t("pdfExport.sealed") : t("pdfExport.unsealed"))}</td></tr>
                ${
                  incident.location
                    ? `<tr><th>${esc(t("pdfExport.gps"))}</th><td>${esc(formatCoords(incident.location.latitude, incident.location.longitude))}</td></tr>`
                    : ""
                }
              </table>
              ${incident.description?.trim() ? `<p class="description">${esc(incident.description.trim())}</p>` : ""}
              ${evidenceBlock}
            </div>`
        })
        .join("")

  const patternBlocks =
    data.patterns.length === 0
      ? `<p class="muted">${esc(t("report.noPatterns"))}</p>`
      : `<ul class="patterns">${data.patterns
          .map((p) => `<li><strong>${esc(p.title)}</strong>: ${esc(p.observation)} ${esc(p.detail)}</li>`)
          .join("")}</ul>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${esc(t("report.title"))}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
  h1 { font-size: 1.6rem; border-bottom: 2px solid #1a1a1a; padding-bottom: 0.5rem; }
  h2 { font-size: 1.2rem; margin-top: 2rem; border-bottom: 1px solid #999; padding-bottom: 0.25rem; }
  h3 { font-size: 1rem; margin-bottom: 0.25rem; }
  table.meta, table.identity { border-collapse: collapse; margin: 0.5rem 0; font-size: 0.9rem; }
  table.meta th, table.meta td, table.identity th, table.identity td { text-align: left; padding: 2px 8px 2px 0; vertical-align: top; }
  table.meta th, table.identity th { font-weight: 600; white-space: nowrap; }
  .incident { margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px dashed #ccc; }
  .description { white-space: pre-wrap; }
  .evidence-heading { font-weight: 600; font-size: 0.9rem; margin-bottom: 0.25rem; }
  .evidence-list { font-size: 0.85rem; margin-top: 0; }
  .patterns li { margin-bottom: 0.5rem; }
  .muted { color: #666; font-style: italic; }
  .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #999; font-size: 0.85rem; color: #444; }
  .signature-line { margin-top: 3rem; }
  .signature-line .line { display: inline-block; width: 300px; border-bottom: 1px solid #1a1a1a; margin-right: 1rem; }
  @media print { body { margin: 0; max-width: none; } }
</style>
</head>
<body>
  <h1>${esc(t("report.title"))}</h1>
  ${profileRows.length > 0 ? `<table class="identity">${profileRows.join("")}</table>` : ""}
  <p class="muted">${esc(t("report.generatedOn"))} ${esc(formatDateTime(data.generatedAt))}</p>

  <h2>${esc(t("report.timelineHeading"))}</h2>
  ${incidentBlocks}

  <h2>${esc(t("report.patternsHeading"))}</h2>
  ${patternBlocks}

  <div class="footer">${esc(t("report.footer"))}</div>
  <div class="signature-line">
    <span class="line">&nbsp;</span>${esc(t("report.signatureLine"))}
  </div>
</body>
</html>`
}
