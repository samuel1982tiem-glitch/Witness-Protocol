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

import { ArrowLeft, Trash2 } from "lucide-react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardBody, Label, SectionTitle, Textarea } from "@/components/ui/primitives"
import { useI18n } from "@/components/i18n-provider"
import { useVault } from "@/components/vault-provider"
import { formatDateTime } from "@/lib/format"

export default function DiaryEntryPage() {
  const searchParams = useSearchParams()
  const entryId = searchParams.get("id")
  const router = useRouter()
  const { diaryEntries, loadDiaryAudio, updateDiaryEntryText, removeDiaryEntry } = useVault()
  const { t } = useI18n()

  const entry = diaryEntries.find((e) => e.id === entryId)

  const [audioUrl, setAudioUrl] = React.useState<string | null>(null)
  const [audioError, setAudioError] = React.useState<string | null>(null)
  const [draftText, setDraftText] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  React.useEffect(() => {
    setDraftText(entry?.text ?? "")
  }, [entry?.id, entry?.text])

  React.useEffect(() => {
    let objectUrl: string | null = null
    let active = true
    if (entry?.hasAudio && entry.id) {
      loadDiaryAudio(entry.id)
        .then((url) => {
          if (!active) return
          objectUrl = url
          setAudioUrl(url)
        })
        .catch((err) => {
          if (active) setAudioError((err as Error).message)
        })
    }
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [entry?.id, entry?.hasAudio, loadDiaryAudio])

  async function handleSaveText() {
    if (!entry) return
    setSaving(true)
    try {
      await updateDiaryEntryText(entry.id, draftText.trim() || null)
    } catch (err) {
      setAudioError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!entry) return
    setDeleting(true)
    try {
      await removeDiaryEntry(entry.id)
      router.push("/diary/")
    } catch (err) {
      setAudioError((err as Error).message)
      setDeleting(false)
    }
  }

  if (!entry) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardBody className="text-sm text-muted-foreground">
            {t("diaryEntry.notFound")}
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <BackLink />

      <header className="space-y-1">
        <h1 className="text-balance text-2xl font-semibold tracking-tight">
          {t("diaryEntry.recordedAt", { time: formatDateTime(entry.createdAt) })}
        </h1>
      </header>

      {entry.hasAudio ? (
        <section className="space-y-2">
          <SectionTitle title={t("diaryEntry.audioLabel")} />
          <Card className="p-3">
            {audioUrl ? (
              <audio controls src={audioUrl} className="w-full" />
            ) : audioError ? (
              <p className="text-sm text-destructive">{audioError}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            )}
          </Card>
        </section>
      ) : null}

      <section className="space-y-2">
        <Label htmlFor="diary-text">{t("diaryEntry.textLabel")}</Label>
        <Textarea
          id="diary-text"
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder={t("diaryEntry.textPlaceholder")}
          rows={5}
        />
        <Button
          className="w-full"
          onClick={handleSaveText}
          disabled={saving || draftText === (entry.text ?? "")}
        >
          {saving ? t("common.saving") : t("diaryEntry.saveText")}
        </Button>
      </section>

      <div className="pt-1">
        {confirmDelete ? (
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {t("diaryEntry.confirmDelete")}
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="flex-1"
            >
              {t("common.cancel")}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => setConfirmDelete(true)}
            className="w-full text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {t("diaryEntry.deleteEntry")}
          </Button>
        )}
      </div>
    </div>
  )
}

function BackLink() {
  const { t } = useI18n()
  return (
    <Link
      href="/diary"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t("diaryEntry.allEntries")}
    </Link>
  )
}
