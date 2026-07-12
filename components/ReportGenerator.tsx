"use client"

import * as React from "react"
import { FileText } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardBody, Input, Label, SectionTitle } from "@/components/ui/primitives"
import { useVault } from "@/components/vault-provider"
import { useI18n } from "@/components/i18n-provider"
import { CATEGORIES, categoryName } from "@/lib/categories"
import { buildReportData, generateReportText, generateReportHtml } from "@/lib/report"
import { startExportProgress, stopExportProgress } from "@/lib/background-export"
import { fromDateTimeLocal } from "@/lib/format"
import type { CategoryId } from "@/lib/types"

type ReportFormat = "text" | "html"

export function ReportGenerator({ onClose }: { onClose?: () => void }) {
  const { incidents, profile, logAudit } = useVault()
  const { t } = useI18n()

  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [selectedCategories, setSelectedCategories] = React.useState<Set<CategoryId>>(
    () => new Set(CATEGORIES.map((c) => c.id)),
  )
  const [includeEvidence, setIncludeEvidence] = React.useState(true)
  const [format, setFormat] = React.useState<ReportFormat>("text")
  const [generating, setGenerating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function toggleCategory(id: CategoryId) {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allCategoriesSelected = selectedCategories.size === CATEGORIES.length

  async function handleGenerate() {
    setError(null)
    setGenerating(true)
    await startExportProgress(t("report.generate"), t("report.generating"))
    try {
      const categories = allCategoriesSelected ? null : Array.from(selectedCategories)

      const data = buildReportData(
        incidents,
        profile,
        {
          dateFrom: dateFrom ? fromDateTimeLocal(dateFrom) : null,
          dateTo: dateTo ? fromDateTimeLocal(dateTo) : null,
          categories,
          includeEvidence,
        },
        t,
      )

      if (data.incidents.length === 0) {
        setError(t("report.noIncidentsToReport"))
        setGenerating(false)
        return
      }

      const content =
        format === "text" ? generateReportText(data, t) : generateReportHtml(data, t)

      const mimeType =
        format === "text"
          ? "text/plain;charset=utf-8"
          : "text/html;charset=utf-8"

      const ext = format === "text" ? "txt" : "html"
      const fileName = `WP-Report-${new Date().toISOString().replace(/[:.]/g, "-")}.${ext}`

      // Add UTF-8 BOM for plain-text exports so Android viewers/editors
      // reliably detect accented characters (Relatório, Organização, etc).
      const textPayload =
        format === "text" ? "\uFEFF" + content : content

      const blob = new Blob([textPayload], { type: mimeType })
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1]
          const { Filesystem, Directory } = await import("@capacitor/filesystem")
          await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: Directory.Cache,
            recursive: true,
          })
          const { Share } = await import("@capacitor/share")
          const uriResult = await Filesystem.getUri({ path: fileName, directory: Directory.Cache })
          const { isShareCancelled } = await import("@/lib/share-utils")
          try {
            await Share.share({ url: uriResult.uri, title: fileName })
          } catch (shareErr) {
            if (!isShareCancelled(shareErr)) throw shareErr
          }
          await logAudit("pdf_exported", `Report (${data.incidents.length} incidents)`)
          onClose?.()
        } catch (err) {
          setError(t("report.generateFailed", { error: (err as Error).message }))
        } finally {
          setGenerating(false)
          await stopExportProgress()
        }
      }
      reader.onerror = async () => {
        setError(t("report.generateFailed", { error: "Could not read report blob" }))
        setGenerating(false)
        await stopExportProgress()
      }
      reader.readAsDataURL(blob)
    } catch (err) {
      setError(t("report.generateFailed", { error: (err as Error).message }))
      setGenerating(false)
      await stopExportProgress()
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle title={t("report.optionsTitle")} />

      <Card>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("report.dateFrom")}</Label>
              <Input
                type="datetime-local"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("report.dateTo")}</Label>
              <Input
                type="datetime-local"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-2">
          <Label>{t("report.categoriesLabel")}</Label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allCategoriesSelected}
              onChange={() =>
                setSelectedCategories(
                  allCategoriesSelected ? new Set() : new Set(CATEGORIES.map((c) => c.id)),
                )
              }
            />
            {t("report.allCategories")}
          </label>
          <div className="space-y-1 border-t border-border pt-2">
            {CATEGORIES.map((cat) => (
              <label key={cat.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedCategories.has(cat.id)}
                  onChange={() => toggleCategory(cat.id)}
                />
                {categoryName(cat.id, t)}
              </label>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeEvidence}
              onChange={(e) => setIncludeEvidence(e.target.checked)}
            />
            {t("report.includeEvidence")}
          </label>

          <div>
            <Label>{t("report.formatLabel")}</Label>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setFormat("text")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                  format === "text" ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                {t("report.formatPlainText")}
              </button>
              <button
                type="button"
                onClick={() => setFormat("html")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                  format === "html" ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                {t("report.formatRichText")}
              </button>
            </div>
          </div>
        </CardBody>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button
        type="button"
        className="w-full"
        disabled={generating}
        onClick={handleGenerate}
      >
        <FileText className="size-4" aria-hidden="true" />
        {generating ? t("report.generating") : t("report.generate")}
      </Button>
    </div>
  )
}
