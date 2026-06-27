"use client"

import { Plus, Search, SlidersHorizontal, X } from "lucide-react"
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
import { CATEGORIES } from "@/lib/categories"
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
      <div className="flex items-start justify-between gap-3">
      <SectionTitle
        title="Records"
        description={`${incidents.length} encrypted ${
          incidents.length === 1 ? "incident" : "incidents"
        } on this device.`}
      />
      <button type="button" onClick={() => router.push("/log")} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><Plus className="size-4" />New</button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={filters.query}
            onChange={(e) => update("query", e.target.value)}
            placeholder="Search title or description"
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
          aria-label="Toggle filters"
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
            <Label htmlFor="f-category">Category</Label>
            <Select
              id="f-category"
              value={filters.category}
              onChange={(e) =>
                update("category", e.target.value as IncidentFilters["category"])
              }
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="f-from">From</Label>
              <Input
                id="f-from"
                type="date"
                value={filters.fromDate}
                onChange={(e) => update("fromDate", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="f-to">To</Label>
              <Input
                id="f-to"
                type="date"
                value={filters.toDate}
                onChange={(e) => update("toDate", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="f-sealed">Sealed status</Label>
            <Select
              id="f-sealed"
              value={filters.sealed}
              onChange={(e) =>
                update("sealed", e.target.value as IncidentFilters["sealed"])
              }
            >
              <option value="all">All</option>
              <option value="sealed">Sealed only</option>
              <option value="unsealed">Unsealed only</option>
            </Select>
          </div>
          <label className="flex items-center gap-2.5 text-sm font-medium">
            <input
              type="checkbox"
              checked={filters.hasLocation}
              onChange={(e) => update("hasLocation", e.target.checked)}
              className="size-4 rounded border-border accent-primary"
            />
            Only records with GPS location
          </label>
          {activeFilterCount > 0 ? (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary"
            >
              <X className="size-4" aria-hidden="true" />
              Clear filters
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
            ? "No incidents recorded yet."
            : "No records match the current filters."}
        </Card>
      )}
    </div>
  )
}
