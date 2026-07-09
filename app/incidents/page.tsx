"use client"

import { FileDown, FileText, MapPin as MapPinIcon, Package as PackageIcon, Search, SlidersHorizontal, X } from "lucide-react"
import * as React from "react"
import { useRouter } from "next/navigation"

import { IncidentCard } from "@/components/incident-card"
import { Button } from "@/components/ui/button"
import {
  Card,
  Input,
  Label,
  SectionTitle,
  Select,
} from "@/components/ui/primitives"
import { useVault } from "@/components/vault-provider"
import { useI18n } from "@/components/i18n-provider"
import { CATEGORIES, categoryDescription, categoryName } from "@/lib/categories"
import { generateBulkIncidentsPdf } from "@/lib/pdf-export"
import { generateIncidentsPackage } from "@/lib/package-export"
import Link from "next/link"
import { isShareCancelled } from "@/lib/share-utils"
import type { IncidentFilters } from "@/lib/types"

const EMPTY_FILTERS: IncidentFilters = {
  query: "",
  category: "all",
  fromDate: "",
  toDate: "",
  hasLocation: false,
  sealed: "all",
}

export default function IncidentsPage() {
  const router = useRouter()
  const {
    incidents,
    getEvidenceRecords,
    decryptEvidenceRaw,
    profile,
    logAudit,
  } = useVault()
  const { t, language } = useI18n()
  const [filters, setFilters] = React.useState<IncidentFilters>(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = React.useState(false)
  const [exportingAll, setExportingAll] = React.useState(false)
  const [exportBatchProgress, setExportBatchProgress] = React.useState<{
    current: number
    total: number
  } | null>(null)
  const [packaging, setPackaging] = React.useState(false)
  const [packageProgress, setPackageProgress] = React.useState<{
    current: number
    total: number
  } | null>(null)

  function update<K extends keyof IncidentFilters>(
    key: K,
    value: IncidentFilters[K],
  ) {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  const filtered = React.useMemo(() => {
    const from = filters.fromDate ? new Date(filters.fromDate).getTime() : null
    const to = filters.toDate
      ? new Date(filters.toDate).getTime() + 24 * 60 * 60 * 1000
      : null
    const q = filters.query.trim().toLowerCase()

    return incidents.filter((inc) => {
      if (q) {
        const hay = `${inc.title} ${inc.description}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (filters.category !== "all" && inc.category !== filters.category) {
        return false
      }
      if (from !== null && inc.occurredAt < from) return false
      if (to !== null && inc.occurredAt >= to) return false
      if (filters.hasLocation && !inc.location) return false
      if (filters.sealed === "sealed" && !inc.sealed) return false
      if (filters.sealed === "unsealed" && inc.sealed) return false
      return true
    })
  }, [incidents, filters])

  const activeFilterCount =
    (filters.category !== "all" ? 1 : 0) +
    (filters.fromDate ? 1 : 0) +
    (filters.toDate ? 1 : 0) +
    (filters.hasLocation ? 1 : 0) +
    (filters.sealed !== "all" ? 1 : 0)

  const EXPORT_BATCH_SIZE = 15

  // Decrypts exactly ONE evidence file on demand, given only its id.
  // Passed into generateBulkIncidentsPdf so it can fetch+decrypt+embed
  // photos one at a time instead of pre-loading an entire incident's
  // evidence into memory up front -- an incident with many photos was
  // crashing the export before this change.
  async function decryptSinglePhoto(
    evidenceId: string,
  ): Promise<{ data: Uint8Array; mimeType: string } | null> {
    try {
      const { getRecord, STORES } = await import("@/lib/db")
      const record = await getRecord<import("@/lib/db").EvidenceRecord>(
        STORES.evidenceFiles,
        evidenceId,
      )
      if (!record) return null
      if (record.kind !== "photo" && record.kind !== "screenshot") return null
      const { raw } = await decryptEvidenceRaw(record)
      return { data: raw, mimeType: record.mimeType }
    } catch (err) {
      console.error(`Failed to decrypt evidence ${evidenceId}:`, err)
      return null
    }
  }

  // Writes a batch PDF to disk and returns its file:// URI, WITHOUT
  // sharing it yet. Explicitly drops the base64 string reference before
  // returning so it can't linger in memory across batches -- sharing
  // once per batch (backgrounding the app repeatedly) was suspected of
  // contributing to a crash while preparing a later batch.
  async function writeBlobToDisk(blob: Blob, safeName: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          let base64: string | null = (reader.result as string).split(",")[1]
          const { Filesystem, Directory } = await import("@capacitor/filesystem")
          await Filesystem.writeFile({
            path: safeName,
            data: base64,
            directory: Directory.Cache,
            recursive: true,
          })
          base64 = null // drop the largest reference immediately after writing
          const uriResult = await Filesystem.getUri({ path: safeName, directory: Directory.Cache })
          resolve(uriResult.uri)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = () => reject(new Error("Could not read blob"))
      reader.readAsDataURL(blob)
    })
  }

  async function handleExportAllPdf() {
    setExportingAll(true)
    // Split into batches so each jsPDF document (and its embedded images)
    // is generated, written, shared, and discarded before the next batch
    // starts. A single 100+ incident PDF held everything in memory at
    // once and crashed the app; this bounds peak memory to one batch.
    const batches: (typeof incidents)[] = []
    for (let i = 0; i < incidents.length; i += EXPORT_BATCH_SIZE) {
      batches.push(incidents.slice(i, i + EXPORT_BATCH_SIZE))
    }
    const totalBatches = batches.length
    const exportRunId = Date.now()

    const fileUris: string[] = []

    try {
      for (let i = 0; i < batches.length; i++) {
        setExportBatchProgress({ current: i + 1, total: totalBatches })
        const batch = batches[i]
        let blob: Blob | null = await generateBulkIncidentsPdf(
          batch,
          profile,
          decryptSinglePhoto,
          language,
        )
        const safeName =
          totalBatches > 1
            ? `witness-protocol-export-${exportRunId}-part${i + 1}-of-${totalBatches}.pdf`
            : `witness-protocol-export-${incidents.length}-incidents-${exportRunId}.pdf`
        const uri = await writeBlobToDisk(blob, safeName)
        blob = null // release this batch's PDF bytes before starting the next batch
        fileUris.push(uri)
      }

      // Single share action for all batches, so the app only backgrounds
      // once instead of once per batch.
      const { Share } = await import("@capacitor/share")
      try {
        await Share.share({
          files: fileUris,
          title:
            totalBatches > 1
              ? `${incidents.length} incidents (${totalBatches} files)`
              : `${incidents.length} incidents`,
        })
      } catch (shareErr) {
        if (!isShareCancelled(shareErr)) throw shareErr
      }

      await logAudit(
        "bulk_pdf_exported",
        `${incidents.length} incidents (${totalBatches} file${totalBatches === 1 ? "" : "s"})`,
      )
    } catch (err) {
      alert(t("recordsPage.exportAllPdfFailed", { error: (err as Error).message }))
    } finally {
      setExportingAll(false)
      setExportBatchProgress(null)
    }
  }

  async function handlePackageAll() {
    setPackaging(true)
    setPackageProgress({ current: 0, total: incidents.length })
    try {
      const uri = await generateIncidentsPackage(
        incidents,
        profile,
        getEvidenceRecords,
        decryptEvidenceRaw,
        (p) => setPackageProgress({ current: p.processed, total: p.total }),
        language,
      )
      const { Share } = await import("@capacitor/share")
      try {
        await Share.share({
          url: uri,
          title: `WP-INCIDENTS (${incidents.length} incidents)`,
        })
      } catch (shareErr) {
        if (!isShareCancelled(shareErr)) throw shareErr
      }
      await logAudit("package_exported", `${incidents.length} incidents`)
    } catch (err) {
      alert(t("recordsPage.packageAllFailed", { error: (err as Error).message }))
    } finally {
      setPackaging(false)
      setPackageProgress(null)
    }
  }

  return (
    <div className="space-y-5">
      <SectionTitle
        title={t("recordsPage.title")}
        description={`${incidents.length} encrypted ${
          incidents.length === 1 ? "incident" : "incidents"
        } on this device.`}
      />

      {incidents.length > 0 ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={exportingAll || packaging}
            onClick={handleExportAllPdf}
          >
            <FileDown className="size-4" aria-hidden="true" />
            {exportingAll
              ? exportBatchProgress
                ? t("recordsPage.exportingAllPdfProgress", {
                    current: exportBatchProgress.current,
                    total: exportBatchProgress.total,
                  })
                : t("recordsPage.exportingAllPdf")
              : t("recordsPage.exportAllPdf")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={exportingAll || packaging}
            onClick={handlePackageAll}
          >
            <PackageIcon className="size-4" aria-hidden="true" />
            {packaging
              ? packageProgress
                ? t("recordsPage.packagingAllProgress", {
                    current: packageProgress.current,
                    total: packageProgress.total,
                  })
                : t("recordsPage.packagingAll")
              : t("recordsPage.packageAll")}
          </Button>
        </div>
      ) : null}

      {incidents.length > 0 ? (
        <div className="flex gap-2">
          <Link href="/report/" className="block flex-1">
            <Button type="button" variant="outline" size="sm" className="w-full">
              <FileText className="size-4" aria-hidden="true" />
              {t("report.generate")}
            </Button>
          </Link>
          <Link href="/heatmap/" className="block flex-1">
            <Button type="button" variant="outline" size="sm" className="w-full">
              <MapPinIcon className="size-4" aria-hidden="true" />
              {t("heatMap.title")}
            </Button>
          </Link>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={filters.query}
            onChange={(e) => update("query", e.target.value)}
            placeholder={t("recordsPage.searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          className={`relative flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors ${
            showFilters || activeFilterCount > 0
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground hover:bg-muted"
          }`}
          aria-label={t("recordsPage.toggleFilters")}
        >
          <SlidersHorizontal className="size-4.5" aria-hidden="true" />
          {activeFilterCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      {showFilters ? (
        <Card className="space-y-4 p-4">
          <div>
            <Label htmlFor="f-category">{t("recordsPage.category")}</Label>
            <Select
              id="f-category"
              value={filters.category}
              onChange={(e) =>
                update("category", e.target.value as IncidentFilters["category"])
              }
            >
              <option value="all">{t("recordsPage.allCategories")}</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryName(c.id, t)}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="f-from">{t("recordsPage.from")}</Label>
              <Input
                id="f-from"
                type="date"
                value={filters.fromDate}
                onChange={(e) => update("fromDate", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="f-to">{t("recordsPage.to")}</Label>
              <Input
                id="f-to"
                type="date"
                value={filters.toDate}
                onChange={(e) => update("toDate", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="f-sealed">{t("recordsPage.sealedStatus")}</Label>
            <Select
              id="f-sealed"
              value={filters.sealed}
              onChange={(e) =>
                update("sealed", e.target.value as IncidentFilters["sealed"])
              }
            >
              <option value="all">{t("recordsPage.all")}</option>
              <option value="sealed">{t("recordsPage.sealedOnly")}</option>
              <option value="unsealed">{t("recordsPage.unsealedOnly")}</option>
            </Select>
          </div>
          <label className="flex items-center gap-2.5 text-sm font-medium">
            <input
              type="checkbox"
              checked={filters.hasLocation}
              onChange={(e) => update("hasLocation", e.target.checked)}
              className="size-4 rounded border-border accent-primary"
            />
            {t("recordsPage.onlyGpsRecords")}
          </label>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
            >
              <X className="size-4" aria-hidden="true" />
              {t("recordsPage.clearFilters")}
            </button>
          ) : null}
        </Card>
      ) : null}

      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} />
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {incidents.length === 0
            ? t("recordsPage.noIncidentsYet")
            : t("recordsPage.noRecordsMatchFilters")}
        </Card>
      )}
    </div>
  )
}
