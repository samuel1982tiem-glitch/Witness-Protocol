"use client"

import { ImageIcon, Lock, MapPin, Mic, Paperclip } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/primitives"
import { categoryName } from "@/lib/categories"
import { formatDateTime, relativeTime } from "@/lib/format"
import type { Incident } from "@/lib/types"

export function IncidentCard({ incident }: { incident: Incident }) {
  const photoCount = incident.evidence.filter(
    (e) => e.kind === "photo" || e.kind === "screenshot",
  ).length
  const voiceCount = incident.evidence.filter((e) => e.kind === "voice").length

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
                Sealed
              </Badge>
            ) : null}
          </div>
          <h3 className="mt-2 truncate text-sm font-semibold text-foreground">
            {incident.title}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {incident.description || "No description."}
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {relativeTime(incident.occurredAt)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{formatDateTime(incident.occurredAt)}</span>
        {incident.location ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden="true" />
            GPS tagged
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
        {incident.evidence.length === 0 ? (
          <span className="inline-flex items-center gap-1">
            <Paperclip className="size-3.5" aria-hidden="true" />
            No attachments
          </span>
        ) : null}
      </div>
    </Link>
  )
}
