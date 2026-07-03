"use client"

import { FileText, ImageIcon, Lock, MapPin, Mic, Paperclip } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/primitives"
import { useI18n } from "@/components/i18n-provider"
import { categoryName } from "@/lib/categories"
import { formatDateTime, relativeTime } from "@/lib/format"
import type { Incident } from "@/lib/types"

export function IncidentCard({ incident }: { incident: Incident }) {
  const { t } = useI18n()
  const photoCount = incident.evidence.filter(
    (e) => e.kind === "photo" || e.kind === "screenshot",
  ).length
  const voiceCount = incident.evidence.filter((e) => e.kind === "voice").length
  const documentCount = incident.evidence.filter((e) => e.kind === "document").length

  return (
    <Link
      href={`/incident?id=${incident.id}`}
      className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge tone="blue">{categoryName(incident.category)}</Badge>
            {incident.sealed ? (
              <Badge tone="green">
                <Lock className="size-3" aria-hidden="true" />
                {t("miscUi.sealed")}
              </Badge>
            ) : null}
          </div>
          <h3 className="mt-2 truncate text-sm font-semibold text-foreground">
            {incident.title}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {incident.description || t("miscUi.noDescriptionShort")}
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {relativeTime(incident.occurredAt, t)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{formatDateTime(incident.occurredAt)}</span>
        {incident.location ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden="true" />
            {t("miscUi.gpsTagged")}
          </span>
        ) : null}
        {photoCount > 0 ? (
          <span className="inline-flex items-center gap-1">
            <ImageIcon className="size-3.5" aria-hidden="true" />
            {photoCount}
          </span>
        ) : null}
        {voiceCount > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Mic className="size-3.5" aria-hidden="true" />
            {voiceCount}
          </span>
        ) : null}
        {documentCount > 0 ? (
          <span className="inline-flex items-center gap-1">
            <FileText className="size-3.5" aria-hidden="true" />
            {documentCount}
          </span>
        ) : null}
        {incident.evidence.length === 0 ? (
          <span className="inline-flex items-center gap-1">
            <Paperclip className="size-3.5" aria-hidden="true" />
            {t("miscUi.noAttachments")}
          </span>
        ) : null}
      </div>
    </Link>
  )
}
