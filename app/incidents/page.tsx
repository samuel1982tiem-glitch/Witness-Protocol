"use client"

import { Search, SlidersHorizontal, X } from "lucide-react"
import * as React from "react"
import { useRouter } from "next/navigation"

import { IncidentCard } from "@/components/incident-card"
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
  const { incidents } = useVault()
  const { t } = useI18n()
  const [filters, setFilters] = React.useState<IncidentFilters>(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = React.useState(false)

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

  return (
    <div className="space-y-5">
      <SectionTitle
        title={t("recordsPage.title")}
        description={`${incidents.length} encrypted ${
          incidents.length === 1 ? "incident" : "incidents"
        } on this device.`}
      />

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
