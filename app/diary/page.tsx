"use client"

import { Mic, MicOff } from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { Card, SectionTitle } from "@/components/ui/primitives"
import { useI18n } from "@/components/i18n-provider"
import { useVault } from "@/components/vault-provider"
import { formatDateTime } from "@/lib/format"

export default function DiaryPage() {
  const { diaryEntries, includeDiaryInPackage, setIncludeDiaryInPackage } = useVault()
  const { t } = useI18n()

  return (
    <div className="space-y-5">
      <SectionTitle title={t("diaryPage.title")} />

      <label className="flex items-center gap-2.5 text-sm font-medium">
        <input
          type="checkbox"
          checked={includeDiaryInPackage}
          onChange={(e) => setIncludeDiaryInPackage(e.target.checked)}
          className="size-4 rounded border-border accent-primary"
        />
        {t("diaryPage.includeInPackage")}
      </label>

      {diaryEntries.length > 0 ? (
        <div className="space-y-3">
          {diaryEntries.map((entry) => (
            <Link
              key={entry.id}
              href={`/diary-entry?id=${entry.id}`}
              className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-foreground">
                    {entry.text || (
                      <span className="text-muted-foreground">
                        {t("miscUi.noDescriptionShort")}
                      </span>
                    )}
                  </p>
                </div>
                <span className="shrink-0 text-muted-foreground">
                  {entry.hasAudio ? (
                    <Mic className="size-4" aria-hidden="true" />
                  ) : (
                    <MicOff className="size-4" aria-hidden="true" />
                  )}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t("diaryPage.noEntriesYet")}
        </Card>
      )}
    </div>
  )
}
