"use client"

import { Activity, Database, FileLock2 } from "lucide-react"
import Link from "next/link"
import * as React from "react"

import { IncidentCard } from "@/components/incident-card"
import { Badge, Card } from "@/components/ui/primitives"
import { useVault } from "@/components/vault-provider"

function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "primary"
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tracking-tight ${
          tone === "primary" ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </Card>
  )
}

export default function DashboardPage() {
  const { incidents, alerts, loadSampleData, busy } = useVault()
  const [seeding, setSeeding] = React.useState(false)

  const sealedCount = incidents.filter((i) => i.sealed).length
  const recent = incidents.slice(0, 4)

  async function onSeed() {
    setSeeding(true)
    try {
      await loadSampleData()
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-balance text-2xl font-semibold tracking-tight">
          Your private record
        </h1>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <StatTile label="Total incidents" value={String(incidents.length)} />
        <StatTile
          label="Pattern alerts"
          value={String(alerts.length)}
          tone="primary"
        />
        <StatTile label="Sealed evidence" value={String(sealedCount)} />
        <StatTile label="Vault" value="Unlocked" />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            Recent incidents
          </h2>
          {incidents.length > 0 ? (
            <Link
              href="/incidents"
              className="text-sm font-medium text-primary"
            >
              View all
            </Link>
          ) : null}
        </div>

        {recent.length > 0 ? (
          <div className="space-y-3">
            {recent.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} />
            ))}
          </div>
        ) : (
          <Card className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <FileLock2 className="size-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium">No incidents yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tap the + button to document your first event, or load a sample
                log to explore the app.
              </p>
            </div>
            <button
              type="button"
              onClick={onSeed}
              disabled={seeding || busy}
              className="inline-flex items-center gap-2 rounded-xl bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-border disabled:opacity-50"
            >
              <Database className="size-4" aria-hidden="true" />
              {seeding ? "Loading sample data…" : "Load sample data"}
            </button>
          </Card>
        )}
      </section>

      {alerts.length > 0 ? (
        <Link href="/patterns">
          <Card className="flex items-center gap-3 border-primary/30 bg-accent p-4">
            <Activity
              className="size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p className="flex-1 text-sm text-accent-foreground">
              {alerts.length} pattern{" "}
              {alerts.length === 1 ? "observation" : "observations"} from your
              records
            </p>
            <Badge tone="blue">Review</Badge>
          </Card>
        </Link>
      ) : null}
    </div>
  )
}
