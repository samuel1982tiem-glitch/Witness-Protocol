"use client"

import {
  Lock,
  ShieldCheck,
  Timer,
  User,
  IdCard,
  Building2,
  Phone,
  Mail,
} from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { PasscodeModal } from "@/components/passcode-modal"
import { Card, CardBody } from "@/components/ui/primitives"
import { useVault } from "@/components/vault-provider"

export default function VaultPage() {
  const {
    status,
    incidents,
    autoLockMs,
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
  } = useVault()

  const autoLockMin = Math.round(autoLockMs / 60000)

  // Local editable draft state (UI only)
  const [draft, setDraft] = React.useState({
    name: "",
    governmentId: "",
    organization: "",
    phone: "",
    email: "",
  })

  // Sync from vault → UI
  React.useEffect(() => {
    if (vaultProfile) {
      setDraft(vaultProfile)
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
  }
  const isDirty =
    draft.name !== savedBaseline.name ||
    draft.governmentId !== savedBaseline.governmentId ||
    draft.organization !== savedBaseline.organization ||
    draft.phone !== savedBaseline.phone ||
    draft.email !== savedBaseline.email

  function exportStageLabel(stage: string): string {
    switch (stage) {
      case "preparing":
        return "Preparing…"
      case "metadata":
        return "Exporting metadata…"
      case "evidence":
        return "Encrypting evidence…"
      case "finishing":
        return "Building ZIP…"
      case "saving":
        return "Saving file…"
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

  async function handleExport() {
    try {
      const fileName = await exportBackup()
      alert(`Backup saved:\n${fileName}`)
    } catch (err) {
      console.error(err)
      alert(String(err))
    }
  }

  const unsealedCount = incidents.filter((i) => !i.sealed).length
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
    await importBackup(file, passcode)
    if (!isMerge) {
      alert("Backup restored successfully.")
    }
    // On merge, the result summary card renders inline instead of an alert.
  } catch (err) {
    console.error(err)
    alert(String(err))
  }
}

  return (
    <div className="space-y-5">

      <Card>
        <CardBody className="space-y-5">

          <div className="flex items-center gap-2">
            <User className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">
              Investigator Identity
            </h2>
          </div>

          <Field
            icon={<User className="size-4" />}
            placeholder="Full name"
            value={draft.name}
            onChange={(v) =>
              setDraft((p) => ({ ...p, name: v }))
            }
          />

          <Field
            icon={<IdCard className="size-4" />}
            placeholder="Government ID"
            value={draft.governmentId}
            onChange={(v) =>
              setDraft((p) => ({ ...p, governmentId: v }))
            }
          />

          <Field
            icon={<Building2 className="size-4" />}
            placeholder="Organization"
            value={draft.organization}
            onChange={(v) =>
              setDraft((p) => ({ ...p, organization: v }))
            }
          />

          <Field
            icon={<Phone className="size-4" />}
            placeholder="Phone"
            value={draft.phone}
            onChange={(v) =>
              setDraft((p) => ({ ...p, phone: v }))
            }
          />

          <Field
            icon={<Mail className="size-4" />}
            placeholder="Email"
            value={draft.email}
            onChange={(v) =>
              setDraft((p) => ({ ...p, email: v }))
            }
          />

          <Button
            className="w-full"
            onClick={() => saveProfile(draft)}
            disabled={!isDirty}
          >
            Save Identity
          </Button>

        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">

          <div className="flex items-start gap-3">
            <Timer className="mt-1 size-4 text-primary" />
            <div>
              <p className="font-medium">
                Inactivity auto-lock
              </p>

              <p className="text-sm text-muted-foreground">
                Vault locks automatically after {autoLockMin} minute
                {autoLockMin === 1 ? "" : "s"}.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            disabled={status !== "unlocked"}
            onClick={lock}
          >
            <Lock className="size-4" />
            Lock vault now
          </Button>

        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">

          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 size-4 text-primary" />
            <div>
              <p className="font-medium">Seal all unsealed records</p>
              <p className="text-sm text-muted-foreground">
                {unsealedCount > 0
                  ? `${unsealedCount} incident${unsealedCount === 1 ? "" : "s"} not yet sealed.`
                  : "All incidents are sealed."}
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
            {sealingAll ? "Sealing…" : `Seal all (${unsealedCount})`}
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
                Sealing {sealAllProgress.processed} of {sealAllProgress.total}
              </p>
            </div>
          ) : null}

        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">

          <Button
            className="w-full"
            onClick={handleExport}
            disabled={exportProgress !== null || mergeProgress !== null}
          >
            {exportProgress !== null ? "Exporting…" : "Export Backup"}
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

          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              document.getElementById("backup-import")?.click()
            }
            disabled={mergeProgress !== null}
          >
            {mergeProgress !== null ? "Merging…" : "Import Backup"}
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
                Merge complete
              </p>
              <ul className="space-y-0.5 text-xs text-emerald-800/90">
                <li>{mergeResult.added} new record{mergeResult.added === 1 ? "" : "s"} added</li>
                <li>{mergeResult.diverged} record{mergeResult.diverged === 1 ? "" : "s"} added as new (matching ID but different content)</li>
                <li>{mergeResult.duplicates} duplicate{mergeResult.duplicates === 1 ? "" : "s"} skipped</li>
                <li>{mergeResult.totalEvidenceAdded} evidence file{mergeResult.totalEvidenceAdded === 1 ? "" : "s"} imported</li>
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={clearMergeResult}
              >
                Dismiss
              </Button>
            </div>
          ) : null}

        </CardBody>
      </Card>

      <PasscodeModal
        open={pendingImportFile !== null}
        title={status === "unlocked" ? "Merge backup" : "Restore backup"}
        subtitle={
          status === "unlocked"
            ? "Enter the PIN used to create the backup you're merging in."
            : "Enter the vault PIN used to create this backup."
        }
        onSubmit={runImport}
        onCancel={() => setPendingImportFile(null)}
      />
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