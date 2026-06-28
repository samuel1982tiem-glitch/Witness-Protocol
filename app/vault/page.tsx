"use client"

import {
  Database,
  FileLock2,
  Lock,
  LockKeyhole,
  ShieldCheck,
  Timer,
} from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Badge, Card, CardBody } from "@/components/ui/primitives"
import { useVault } from "@/components/vault-provider"

export default function VaultPage() {
  const {
    status,
    incidents,
    autoLockMs,
    lock,
    exportBackup,
  importBackup,
    busy,
  } = useVault()

  const sealedCount = incidents.filter((i) => i.sealed).length
  const evidenceCount = incidents.reduce((n, i) => n + i.evidence.length, 0)
  const autoLockMin = Math.round(autoLockMs / 60000)


  async function handleExport() {
    const blob = await exportBackup()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `witness-protocol-${Date.now()}.wpb`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    await importBackup(file)
    event.target.value = ""
  }

  return (
    <div className="space-y-5">
      <Card
        className={
          status === "unlocked"
            ? "border-emerald-200 bg-emerald-50/60"
            : "bg-muted"
        }
      >
        <CardBody className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={
                status === "unlocked"
                  ? "grid size-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"
                  : "grid size-11 place-items-center rounded-2xl bg-foreground/5 text-muted-foreground"
              }
            >
              {status === "unlocked" ? (
                <ShieldCheck className="size-5" aria-hidden="true" />
              ) : (
                <LockKeyhole className="size-5" aria-hidden="true" />
              )}
            </span>
            <div>
              <p className="font-medium text-foreground">
                Vault {status === "unlocked" ? "unlocked" : "locked"}
              </p>
              <p className="text-sm text-muted-foreground">
                {status === "unlocked"
                  ? "Records are decrypted in memory."
                  : "Enter your passcode to access records."}
              </p>
            </div>
          </div>
          <Badge tone={status === "unlocked" ? "green" : "gray"}>
            {status === "unlocked" ? "Active" : "Sealed"}
          </Badge>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Database className="size-4" />}
          label="Encrypted records"
          value={incidents.length}
        />
        <StatCard
          icon={<FileLock2 className="size-4" />}
          label="Evidence files"
          value={evidenceCount}
        />
        <StatCard
          icon={<ShieldCheck className="size-4" />}
          label="Sealed"
          value={sealedCount}
        />
        <StatCard
          icon={<Timer className="size-4" />}
          label="Auto-lock"
          value={`${autoLockMin}m`}
        />
      </div>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-start gap-3">
            <Timer className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                Inactivity auto-lock
              </p>
              <p className="text-muted-foreground">
                The vault automatically locks after {autoLockMin} minute
                {autoLockMin === 1 ? "" : "s"} of inactivity, clearing the
                encryption key from memory.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={lock}
            disabled={status !== "unlocked"}
          >
            <Lock className="size-4" aria-hidden="true" />
            Lock vault now
          </Button>
        </CardBody>
      </Card>

    

      
     
      <Card>
        <CardBody className="space-y-3">
          <Button className="w-full" onClick={handleExport}>Export Backup</Button>
          <input
            id="backup-import"
            type="file"
            accept=".wpb"
            className="hidden"
            onChange={handleImport}
          />
          <Button
            className="w-full"
            variant="outline"
            onClick={() =>
              document.getElementById("backup-import")?.click()
            }
          >
            Import Backup
          </Button>
        </CardBody>
      </Card>


    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <Card>
      <CardBody className="space-y-1 p-4">
        <span className="inline-flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <p className="text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardBody>
    </Card>
  )
}
