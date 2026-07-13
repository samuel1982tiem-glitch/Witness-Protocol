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
