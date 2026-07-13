"use client"

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

import * as React from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardBody, Label } from "@/components/ui/primitives"
import { useVault } from "@/components/vault-provider"
import { useI18n } from "@/components/i18n-provider"
import { CATEGORIES, categoryColor, categoryName } from "@/lib/categories"
import { fromDateTimeLocal, formatDateTime } from "@/lib/format"
import type { CategoryId, Incident } from "@/lib/types"

/**
 * Heat Map: plots incidents with GPS data on a Leaflet map with a heat
 * density overlay. Leaflet's default tile layer fetches map imagery from
 * OpenStreetMap over the network -- the ONLY place in this app that makes
 * external network calls. Gated behind an explicit consent screen shown
 * every visit (not persisted), since this app is otherwise fully offline
 * and on-device by design. No incident data itself is ever sent over the
 * network -- only generic tile image requests for the visible map area.
 */
export function HeatMapView() {
  const { incidents } = useVault()
  const { t } = useI18n()

  const [consented, setConsented] = React.useState(false)

  if (!consented) {
    return <ConsentGate onConsent={() => setConsented(true)} />
  }

  return <MapPanel incidents={incidents} t={t} />
}

function ConsentGate({ onConsent }: { onConsent: () => void }) {
  const { t } = useI18n()
  return (
    <Card className="border-amber-200 bg-amber-50/60">
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
          <AlertTriangle className="size-4" aria-hidden="true" />
          {t("heatMap.consentTitle")}
        </div>
        <p className="text-sm text-amber-800/90">{t("heatMap.consentBody")}</p>
        <Button type="button" className="w-full" onClick={onConsent}>
          {t("heatMap.consentProceed")}
        </Button>
      </CardBody>
    </Card>
  )
}

interface MapPanelProps {
  incidents: Incident[]
  t: (key: string, vars?: Record<string, string | number>) => string
}

function MapPanel({ incidents, t }: MapPanelProps) {
  const mapContainerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<any>(null)
  const markersLayerRef = React.useRef<any>(null)
  const heatLayerRef = React.useRef<any>(null)
  const leafletRef = React.useRef<any>(null)

  const [ready, setReady] = React.useState(false)
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [selectedCategories, setSelectedCategories] = React.useState<Set<CategoryId>>(
    () => new Set(CATEGORIES.map((c) => c.id)),
  )
  const [showHeat, setShowHeat] = React.useState(true)
  const [selectedIncident, setSelectedIncident] = React.useState<Incident | null>(null)
  const withLocation = React.useMemo(
    () => incidents.filter((i) => i.location !== null),
    [incidents],
  )

  const filtered = React.useMemo(() => {
    const from = dateFrom ? fromDateTimeLocal(dateFrom) : null
    const to = dateTo ? fromDateTimeLocal(dateTo) : null
    return withLocation.filter((i) => {
      if (from !== null && i.occurredAt < from) return false
      if (to !== null && i.occurredAt > to) return false
      if (!selectedCategories.has(i.category)) return false
      return true
    })
  }, [withLocation, dateFrom, dateTo, selectedCategories])

  function toggleCategory(id: CategoryId) {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allCategoriesSelected = selectedCategories.size === CATEGORIES.length

  // Initialize the map once.
  React.useEffect(() => {
    let cancelled = false
    try {
      sessionStorage.setItem("wp_heatmap_last_step", "effect_start")
      sessionStorage.removeItem("wp_heatmap_error")
    } catch {}
    ;(async () => {
      try {
        const leafletNamespace = await import("leaflet")
        // leaflet.heat does a bare `L.HeatLayer = ...` assignment with no
        // module wrapper. The object returned by dynamic import() is a
        // frozen ES module namespace object -- assigning a NEW property to
        // it is a silent no-op in sloppy mode (no throw, property just
        // never lands). Spreading it into a plain object makes it
        // genuinely extensible so leaflet.heat's patch actually sticks.
        const L: any = { ...leafletNamespace }
        try { sessionStorage.setItem("wp_heatmap_last_step", "leaflet_imported") } catch {}
        ;(window as any).L = L
        await import("leaflet.heat")
        try {
          const attached = typeof (window as any).L?.heatLayer === "function"
          sessionStorage.setItem("wp_heatmap_last_step", "heat_imported:" + attached)
          sessionStorage.setItem("wp_heatmap_heat_attached", String(attached))
          sessionStorage.setItem("wp_heatmap_windowL_keys", Object.keys((window as any).L ?? {}).slice(0, 30).join(","))
        } catch {}
        if (cancelled || !mapContainerRef.current || mapRef.current) return

        leafletRef.current = L

        const map = L.map(mapContainerRef.current).setView([0, 0], 2)
        try { sessionStorage.setItem("wp_heatmap_last_step", "map_created") } catch {}
        map.attributionControl.setPrefix(false)
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "\u00a9 OpenStreetMap contributors",
          maxZoom: 19,
        }).addTo(map)
        try { sessionStorage.setItem("wp_heatmap_last_step", "tilelayer_added") } catch {}

        mapRef.current = map
        markersLayerRef.current = L.layerGroup().addTo(map)
        try { sessionStorage.setItem("wp_heatmap_last_step", "ready") } catch {}
        setReady(true)
      } catch (err) {
        try {
          sessionStorage.setItem("wp_heatmap_error", (err as Error)?.message ?? String(err))
        } catch {}
        console.error("[HeatMap] init failed:", err)
      }
    })()
    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Redraw markers + heat layer whenever the filtered set changes.
  React.useEffect(() => {
    try {
      sessionStorage.setItem("wp_heatmap_last_step", "markers_effect_start")

    if (!ready || !mapRef.current || !leafletRef.current) return
    const L = leafletRef.current
    const map = mapRef.current

    markersLayerRef.current.clearLayers()
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current)
      heatLayerRef.current = null
    }

    const points: [number, number][] = []

    for (const incident of filtered) {
      if (!incident.location) continue
      const { latitude, longitude } = incident.location
      points.push([latitude, longitude])

      const marker = L.circleMarker([latitude, longitude], {
        radius: 8,
        color: categoryColor(incident.category),
        fillColor: categoryColor(incident.category),
        fillOpacity: 0.85,
        weight: 2,
      })
      marker.on("click", () => setSelectedIncident(incident))
      marker.addTo(markersLayerRef.current)
    }

    if (showHeat && points.length > 0) {
      const heatLayerFactory = (window as any).L?.heatLayer ?? (L as any).heatLayer
      if (typeof heatLayerFactory !== "function") {
        try {
          sessionStorage.setItem(
            "wp_heatmap_error",
            "MARKERS: heatLayer factory unavailable on both window.L and component L",
          )
        } catch {}
      } else {
        heatLayerRef.current = heatLayerFactory(points, { radius: 30, blur: 20 }).addTo(map)
      }
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(points as any)
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 })
    }
        sessionStorage.setItem("wp_heatmap_last_step", "markers_effect_done")
    } catch (err) {
      try {
        sessionStorage.setItem("wp_heatmap_last_step", "markers_effect_error")
        sessionStorage.setItem("wp_heatmap_error", "MARKERS: " + ((err as Error)?.message ?? String(err)))
      } catch {}
      console.error("[HeatMap] markers effect failed:", err)
    }
  }, [ready, filtered, showHeat])

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("report.dateFrom")}</Label>
              <input
                type="datetime-local"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <Label>{t("report.dateTo")}</Label>
              <input
                type="datetime-local"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

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
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2">
            {CATEGORIES.map((cat) => (
              <label key={cat.id} className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={selectedCategories.has(cat.id)}
                  onChange={() => toggleCategory(cat.id)}
                />
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: categoryColor(cat.id) }}
                />
                {categoryName(cat.id, t)}
              </label>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showHeat} onChange={(e) => setShowHeat(e.target.checked)} />
            {t("heatMap.showHeatOverlay")}
          </label>
        </CardBody>
      </Card>

      {withLocation.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("heatMap.noGpsIncidents")}</p>
      ) : (
        <div
          ref={mapContainerRef}
          className="h-[420px] w-full overflow-hidden rounded-xl border border-border"
        />
      )}

      {selectedIncident ? (
        <Card>
          <CardBody className="space-y-2">
            <p className="font-medium text-foreground">
              {selectedIncident.title || t("pdfExport.untitledIncident")}
            </p>
            <p className="text-xs text-muted-foreground">
              {categoryName(selectedIncident.category, t)} · {formatDateTime(selectedIncident.occurredAt)}
            </p>
            <Link href={`/incident/?id=${selectedIncident.id}`}>
              <Button type="button" variant="outline" size="sm" className="w-full">
                {t("heatMap.viewIncident")}
              </Button>
            </Link>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
