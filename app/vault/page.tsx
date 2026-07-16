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

import {
  Lock,
  ScrollText,
  ShieldCheck,
  Timer,
  User,
  IdCard,
  Building2,
  Phone,
  Mail,
  Paperclip,
  FileText,
  Download,
  Trash2,
  ChevronDown,
  Moon,
} from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { PasscodeModal } from "@/components/passcode-modal"
import { Card, CardBody } from "@/components/ui/primitives"
import { useVault } from "@/components/vault-provider"
import { useI18n } from "@/components/i18n-provider"
import { SUPPORTED_LANGUAGES, type LanguagePreference } from "@/lib/i18n"
import { useTheme } from "@/components/theme-provider"
import type { ThemePreference } from "@/lib/theme"
import { Globe } from "lucide-react"
import { formatBytes } from "@/lib/media"
import { isShareCancelled } from "@/lib/share-utils"
import { useExportProgress } from "@/components/export-progress-provider"
import { QRCodeSVG } from "qrcode.react"

const GITHUB_REPO_URL = "https://github.com/samuel1982tiem-glitch/Witness-Protocol"

export default function VaultPage() {
  const { begin: beginExport, progress: reportExportProgress, end: endExport } = useExportProgress()
  const {
    status,
    incidents,
    autoLockMs,
    setAutoLockMs,
    lock,
    exportBackup,
    exportProgress,
    importBackup,
    mergeProgress,
    mergeResult,
    clearMergeResult,
    sealIncident,
    profile: vaultProfile,
    saveProfile,
    getAuditLog,
  } = useVault()

  const { t, language, preference, setLanguage } = useI18n()
  const { preference: themePreference, setTheme } = useTheme()

  const autoLockMin = Math.round(autoLockMs / 60000)

  // Local editable draft state (UI only)
  const [draft, setDraft] = React.useState<{
    name: string
    governmentId: string
    organization: string
    phone: string
    email: string
    idDocument: { name: string; mimeType: string; size: number; dataBase64: string } | null
  }>({
    name: "",
    governmentId: "",
    organization: "",
    phone: "",
    email: "",
    idDocument: null,
  })
  const [idDocDirty, setIdDocDirty] = React.useState(false)

  // Sync from vault → UI
  React.useEffect(() => {
    if (vaultProfile) {
      setDraft({ idDocument: null, ...vaultProfile })
      setIdDocDirty(false)
    }
  }, [vaultProfile])

  // Save button is disabled until the user actually changes a field.
  // Compares the live draft against the last-saved profile (or the
  // empty baseline if no profile exists yet).
  const savedBaseline = vaultProfile ?? {
    name: "",
    governmentId: "",
    organization: "",
    phone: "",
    email: "",
    idDocument: null,
  }
  const isDirty =
    draft.name !== savedBaseline.name ||
    draft.governmentId !== savedBaseline.governmentId ||
    draft.organization !== savedBaseline.organization ||
    draft.phone !== savedBaseline.phone ||
    draft.email !== savedBaseline.email ||
    idDocDirty

  function exportStageLabel(stage: string): string {
    switch (stage) {
      case "preparing":
        return t("backup.stagePreparing")
      case "metadata":
        return t("backup.stageMetadata")
      case "evidence":
        return t("backup.stageEvidence")
      case "finishing":
        return t("backup.stageFinishing")
      case "saving":
        return t("backup.stageSaving")
      default:
        return "Working…"
    }
  }

  function formatEta(seconds: number | null): string | null {
    if (seconds === null) return null
    if (seconds < 5) return "almost done"
    if (seconds < 60) return `~${seconds}s remaining`
    const mins = Math.round(seconds / 60)
    return `~${mins} minute${mins === 1 ? "" : "s"} remaining`
  }

  const MAX_ID_DOCUMENT_BYTES = 10 * 1024 * 1024 // 10 MB

  async function handleIdDocumentSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    if (file.size > MAX_ID_DOCUMENT_BYTES) {
      alert(t("vault.idDocumentTooLarge"))
      return
    }

    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ""
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode(...chunk)
    }
    const dataBase64 = btoa(binary)

    setDraft((p) => ({
      ...p,
      idDocument: {
        name: file.name || "government-id",
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        dataBase64,
      },
    }))
    setIdDocDirty(true)
  }

  function removeIdDocument() {
    setDraft((p) => ({ ...p, idDocument: null }))
    setIdDocDirty(true)
  }

  async function downloadIdDocument() {
    const doc = draft.idDocument
    if (!doc) return
    try {
      const { Filesystem, Directory } = await import("@capacitor/filesystem")
      const { Share } = await import("@capacitor/share")
      const extMap: Record<string, string> = {
        "application/pdf": "pdf",
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
      }
      const ext = extMap[doc.mimeType] || "bin"
      const safeName = doc.name && doc.name.includes(".") ? doc.name : `government-id.${ext}`
      await Filesystem.writeFile({
        path: safeName,
        data: doc.dataBase64,
        directory: Directory.Cache,
        recursive: true,
      })
      const uriResult = await Filesystem.getUri({ path: safeName, directory: Directory.Cache })
      await Share.share({ url: uriResult.uri, title: safeName })
    } catch (err) {
      if (isShareCancelled(err)) return
      console.error(err)
      alert(String(err))
    }
  }

  const [includeIdDocOnExport, setIncludeIdDocOnExport] = React.useState(false)
  const [includeIdDocOnRestore, setIncludeIdDocOnRestore] = React.useState(false)

  async function handleExport() {
    await beginExport(t("backup.exportBackup"), t("backup.exporting"))
    try {
      const fileName = await exportBackup(includeIdDocOnExport)
      alert(t("backup.backupSaved", { fileName }))
    } catch (err) {
      console.error(err)
      alert(String(err))
    } finally {
      await endExport()
    }
  }

  React.useEffect(() => {
    if (!exportProgress) return
    reportExportProgress(
      t("backup.exportBackup"),
      exportProgress.currentName || t("backup.exporting"),
      exportProgress.percent ?? 0,
      100,
    )
  }, [exportProgress, t, reportExportProgress])

  const unsealedCount = incidents.filter((i) => !i.sealed).length

  const [auditEntries, setAuditEntries] = React.useState<
    { action: string; detail: string; timestamp: number }[]
  >([])
  const [auditExpanded, setAuditExpanded] = React.useState(false)

  React.useEffect(() => {
    if (status !== "unlocked") return
    getAuditLog().then(setAuditEntries)
  }, [status, getAuditLog])

  function auditActionLabel(action: string): string {
    const keys: Record<string, string> = {
      incident_created: "auditLog.incidentCreated",
      incident_edited: "auditLog.incidentEdited",
      incident_sealed: "auditLog.incidentSealed",
      incident_deleted: "auditLog.incidentDeleted",
      evidence_downloaded: "auditLog.evidenceDownloaded",
      pdf_exported: "auditLog.pdfExported",
      backup_exported: "auditLog.backupExported",
      backup_restored: "auditLog.backupRestored",
      backup_merged: "auditLog.backupMerged",
      diary_entry_created: "auditLog.diaryEntryCreated",
    }
    const key = keys[action]
    return key ? t(key) : action
  }
  const [sealingAll, setSealingAll] = React.useState(false)
  const [sealAllProgress, setSealAllProgress] = React.useState<{
    processed: number
    total: number
  } | null>(null)

  async function handleSealAll() {
    const targets = incidents.filter((i) => !i.sealed)
    if (targets.length === 0) return

    setSealingAll(true)
    setSealAllProgress({ processed: 0, total: targets.length })
    let failed = 0

    for (let i = 0; i < targets.length; i++) {
      try {
        await sealIncident(targets[i].id)
      } catch (err) {
        console.error("Seal failed for", targets[i].id, err)
        failed++
      }
      setSealAllProgress({ processed: i + 1, total: targets.length })
    }

    setSealingAll(false)
    setSealAllProgress(null)

    if (failed > 0) {
      alert(
        `Sealed ${targets.length - failed} of ${targets.length} incidents. ${failed} failed.`,
      )
    } else {
      alert(`Sealed ${targets.length} incident${targets.length === 1 ? "" : "s"}.`)
    }
  }

const [pendingImportFile, setPendingImportFile] = React.useState<File | null>(null)

function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0]
  event.target.value = ""
  if (!file) return
  setPendingImportFile(file)
}

async function runImport(passcode: string) {
  const file = pendingImportFile
  setPendingImportFile(null)
  if (!file) return

  const isMerge = status === "unlocked"

  try {
    await importBackup(file, passcode, includeIdDocOnRestore)
    if (!isMerge) {
      alert(t("backup.backupRestored"))
    }
    // On merge, the result summary card renders inline instead of an alert.
  } catch (err) {
    console.error(err)
    alert(String(err))
  }
}

  return (
    <div className="space-y-5">

      <div className="grid gap-5 md:grid-cols-2 md:items-start">
        <Card className="h-full">
          <CardBody className="space-y-2">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-primary" />
              <p className="font-medium">{t("vault.language")}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <select
                  value={preference}
                  onChange={(e) => setLanguage(e.target.value as LanguagePreference)}
                  className="w-full appearance-none rounded-xl border border-border bg-background px-3 py-3 pr-10 text-sm outline-none"
                >
                  <option value="system">{t("vault.systemLanguage")}</option>
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.nativeName}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>

              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="flex shrink-0 flex-col items-center gap-1 rounded-xl border border-border p-2"
                aria-label="GitHub"
              >
                <QRCodeSVG value={GITHUB_REPO_URL} size={64} level="M" />
                <span className="text-[9px] leading-none text-muted-foreground">GitHub</span>
              </a>
            </div>
          </CardBody>
        </Card>

        <Card className="h-full">
          <CardBody className="space-y-2">
            <div className="flex items-center gap-2">
              <Moon className="size-4 text-primary" />
              <p className="font-medium">{t("vault.theme")}</p>
            </div>

            <div className="relative">
              <select
                value={themePreference}
                onChange={(e) => setTheme(e.target.value as ThemePreference)}
                className="w-full appearance-none rounded-xl border border-border bg-background px-3 py-3 pr-10 text-sm outline-none"
              >
                <option value="system">{t("vault.themeSystem")}</option>
                <option value="light">{t("vault.themeLight")}</option>
                <option value="dark">{t("vault.themeDark")}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </CardBody>
        </Card>

        <Card className="h-full">
          <CardBody className="space-y-4">
            <div className="flex items-start gap-3">
              <Timer className="mt-1 size-4 text-primary" />
              <div className="flex-1">
                <p className="font-medium">
                  {t("vault.autoLockTitle")}
                </p>

                <p className="text-sm text-muted-foreground">
                  {t("vault.autoLockDescription", {
                    minutes: autoLockMin,
                    plural: autoLockMin === 1 ? "" : "s",
                  })}
                </p>
              </div>
            </div>

            <div className="relative">
              <select
                value={String(autoLockMin)}
                onChange={(e) => setAutoLockMs(Number(e.target.value) * 60000)}
                className="w-full appearance-none rounded-xl border border-border bg-background px-3 py-3 pr-10 text-sm outline-none"
              >
                <option value="1">{`1 ${t("vault.minuteSingular")}`}</option>
                <option value="3">{`3 ${t("vault.minutesPlural")}`}</option>
                <option value="5">{`5 ${t("vault.minutesPlural")}`}</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>

            <Button
              variant="outline"
              className="w-full"
              disabled={status !== "unlocked"}
              onClick={lock}
            >
              <Lock className="size-4" />
              {t("vault.lockNow")}
            </Button>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="space-y-5">

          <div className="flex items-center gap-2">
            <User className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">
              {t("vault.investigatorIdentity")}
            </h2>
          </div>

          <Field
            icon={<User className="size-4" />}
            placeholder={t("vault.fullName")}
            value={draft.name}
            onChange={(v) =>
              setDraft((p) => ({ ...p, name: v }))
            }
          />

          <Field
            icon={<IdCard className="size-4" />}
            placeholder={t("vault.governmentId")}
            value={draft.governmentId}
            onChange={(v) =>
              setDraft((p) => ({ ...p, governmentId: v }))
            }
          />

          <Field
            icon={<Building2 className="size-4" />}
            placeholder={t("vault.organization")}
            value={draft.organization}
            onChange={(v) =>
              setDraft((p) => ({ ...p, organization: v }))
            }
          />

          <Field
            icon={<Phone className="size-4" />}
            placeholder={t("vault.phone")}
            value={draft.phone}
            onChange={(v) =>
              setDraft((p) => ({ ...p, phone: v }))
            }
          />

          <Field
            icon={<Mail className="size-4" />}
            placeholder={t("vault.email")}
            value={draft.email}
            onChange={(v) =>
              setDraft((p) => ({ ...p, email: v }))
            }
          />

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {t("vault.idDocument")}
            </p>

            {draft.idDocument ? (
              <div className="space-y-2 rounded-xl border px-3 py-3">
                <div className="flex items-center gap-3">
                  <FileText className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {draft.idDocument.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(draft.idDocument.size)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={downloadIdDocument}
                  >
                    <Download className="size-3.5" />
                    {t("vault.downloadIdDocument")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 text-destructive"
                    onClick={removeIdDocument}
                  >
                    <Trash2 className="size-3.5" />
                    {t("vault.removeIdDocument")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => document.getElementById("id-document-input")?.click()}
              >
                <Paperclip className="size-4" />
                {t("vault.attachIdDocument")}
              </Button>
            )}

            <input
              id="id-document-input"
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={handleIdDocumentSelected}
            />
          </div>

          <Button
            className="w-full"
            onClick={() => saveProfile(draft)}
            disabled={!isDirty}
          >
            {t("vault.saveIdentity")}
          </Button>

        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">

          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 size-4 text-primary" />
            <div>
              <p className="font-medium">{t("vault.sealAllTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {unsealedCount > 0
                  ? t("vault.sealAllDescription", {
                      count: unsealedCount,
                      plural: unsealedCount === 1 ? "" : "s",
                    })
                  : t("vault.sealAllNoneUnsealed")}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            disabled={status !== "unlocked" || unsealedCount === 0 || sealingAll}
            onClick={handleSealAll}
          >
            <ShieldCheck className="size-4" />
            {sealingAll ? t("common.saving") : t("vault.sealAllButton", { count: unsealedCount })}
          </Button>

          {sealAllProgress ? (
            <div className="space-y-1.5 rounded-xl border border-border p-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${Math.round(
                      (sealAllProgress.processed / sealAllProgress.total) * 100,
                    )}%`,
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("vault.sealingProgress", {
                  processed: sealAllProgress.processed,
                  total: sealAllProgress.total,
                })}
              </p>
            </div>
          ) : null}

        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">

          {vaultProfile?.idDocument ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-border"
                checked={includeIdDocOnExport}
                onChange={(e) => setIncludeIdDocOnExport(e.target.checked)}
              />
              {t("backup.includeIdDocumentExport")}
            </label>
          ) : null}

          <Button
            className="w-full"
            onClick={handleExport}
            disabled={exportProgress !== null || mergeProgress !== null}
          >
            {exportProgress !== null ? t("backup.exporting") : t("backup.exportBackup")}
          </Button>

          {exportProgress !== null ? (
            <div className="space-y-1.5 rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground">
                  {exportStageLabel(exportProgress.stage)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {exportProgress.percent}%
                </p>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${exportProgress.percent}%` }}
                />
              </div>
              {exportProgress.stage === "evidence" && exportProgress.total > 0 ? (
                <p className="truncate text-xs text-muted-foreground">
                  {exportProgress.processed} of {exportProgress.total} —{" "}
                  {exportProgress.currentName}
                  {formatEta(exportProgress.etaSeconds)
                    ? ` · ${formatEta(exportProgress.etaSeconds)}`
                    : ""}
                </p>
              ) : null}
            </div>
          ) : null}

          <input
            id="backup-import"
            type="file"
            accept=".wpb,.wpbz,application/octet-stream,*/*"
            className="hidden"
            onChange={handleFileSelected}
          />

          {status !== "unlocked" ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 rounded border-border"
                checked={includeIdDocOnRestore}
                onChange={(e) => setIncludeIdDocOnRestore(e.target.checked)}
              />
              {t("backup.includeIdDocumentRestore")}
            </label>
          ) : null}

          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              document.getElementById("backup-import")?.click()
            }
            disabled={mergeProgress !== null}
          >
            {mergeProgress !== null ? t("backup.merging") : t("backup.importBackup")}
          </Button>

          {mergeProgress !== null ? (
            <div className="space-y-1.5 rounded-xl border border-border p-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width:
                      mergeProgress.total > 0
                        ? `${Math.round(
                            (mergeProgress.processed / mergeProgress.total) * 100,
                          )}%`
                        : "8%",
                  }}
                />
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {mergeProgress.total > 0
                  ? `Processing ${mergeProgress.processed} of ${mergeProgress.total} — ${mergeProgress.currentTitle}`
                  : "Reading backup file…"}
              </p>
            </div>
          ) : null}

          {mergeResult !== null ? (
            <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
              <p className="text-sm font-medium text-emerald-900">
                {t("backup.mergeComplete")}
              </p>
              <ul className="space-y-0.5 text-xs text-emerald-800/90">
                <li>{t("backup.mergeAdded", { count: mergeResult.added, plural: mergeResult.added === 1 ? "" : "s" })}</li>
                <li>{t("backup.mergeDiverged", { count: mergeResult.diverged, plural: mergeResult.diverged === 1 ? "" : "s" })}</li>
                <li>{t("backup.mergeDuplicates", { count: mergeResult.duplicates, plural: mergeResult.duplicates === 1 ? "" : "s" })}</li>
                <li>{t("backup.mergeEvidenceAdded", { count: mergeResult.totalEvidenceAdded, plural: mergeResult.totalEvidenceAdded === 1 ? "" : "s" })}</li>
                {mergeResult.identityImported ? (
                  <li>{t("backup.mergeIdentityImported")}</li>
                ) : null}
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={clearMergeResult}
              >
                {t("backup.dismiss")}
              </Button>
            </div>
          ) : null}

        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScrollText className="size-4 text-primary" />
              <p className="font-medium">{t("auditLog.title")}</p>
            </div>
            {auditEntries.length > 5 ? (
              <button
                type="button"
                className="text-xs text-muted-foreground underline"
                onClick={() => setAuditExpanded((v) => !v)}
              >
                {auditExpanded
                  ? t("auditLog.showLess")
                  : t("auditLog.showAll", { count: auditEntries.length })}
              </button>
            ) : null}
          </div>

          {auditEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("auditLog.noActivity")}
            </p>
          ) : (
            <ul className="space-y-2">
              {(auditExpanded ? auditEntries : auditEntries.slice(0, 5)).map((entry, i) => (
                <li key={i} className="rounded-lg border px-3 py-2 text-xs">
                  <p className="font-medium">{auditActionLabel(entry.action)}</p>
                  {entry.detail ? (
                    <p className="truncate text-muted-foreground">{entry.detail}</p>
                  ) : null}
                  <p className="text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>


      <PasscodeModal
        open={pendingImportFile !== null}
        title={status === "unlocked" ? t("backup.mergeTitle") : t("backup.restoreTitle")}
        subtitle={
          status === "unlocked"
            ? t("backup.mergeSubtitle")
            : t("backup.restoreSubtitle")
        }
        onSubmit={runImport}
        onCancel={() => setPendingImportFile(null)}
      />

      <div className="pb-4 pt-2 text-center">
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary underline-offset-2 hover:underline"
        >
          Version 1.0.2
        </a>
      </div>
    </div>
  )
}

function Field({
  icon,
  placeholder,
  value,
  onChange,
}: {
  icon: React.ReactNode
  placeholder: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border px-3 py-2">
      <span className="text-muted-foreground">
        {icon}
      </span>

      <input
        className="w-full bg-transparent outline-none"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}