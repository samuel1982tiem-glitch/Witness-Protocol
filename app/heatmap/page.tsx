"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import "leaflet/dist/leaflet.css"

import { HeatMapView } from "@/components/HeatMapView"
import { SectionTitle } from "@/components/ui/primitives"
import { useI18n } from "@/components/i18n-provider"

export default function HeatMapPage() {
  const { t } = useI18n()

  return (
    <div className="space-y-5">
      <Link
        href="/incidents/"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("common.back")}
      </Link>

      <SectionTitle title={t("heatMap.title")} />

      <HeatMapView />
    </div>
  )
}
