"use client"

import {
  Activity,
  Clock,
  Info,
  Layers,
  MapPin,
  RefreshCw,
  TrendingUp,
} from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Badge,
  Card,
  CardBody,
  SectionTitle,
} from "@/components/ui/primitives"
import { useVault } from "@/components/vault-provider"
import { relativeTime } from "@/lib/format"
import type { AlertType, PatternAlert } from "@/lib/types"

const TYPE_ICON: Record<AlertType, React.ComponentType<{ className?: string }>> =
  {
    "repeated-time": Clock,
    "repeated-location": MapPin,
    "frequency-spike": Activity,
    "category-cluster": Layers,
    "activity-trend": TrendingUp,
  }

const SEVERITY_TONE = {
  high: "red",
  notable: "amber",
  info: "blue",
} as const

export default function PatternsPage() {
  const { alerts, incidents, runAnalysis, busy } = useVault()
  const [running, setRunning] = React.useState(false)
  const [lastRun, setLastRun] = React.useState<number | null>(null)

  async function handleRun() {
    setRunning(true)
    try {
      await runAnalysis()
      setLastRun(Date.now())
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-5">
      <SectionTitle
        title="Pattern review"
        description="Local, on-device analysis of your own records. Observations and correlations only — never claims about cause or intent."
      />

      <Card className="bg-primary/5">
        <CardBody className="flex items-center justify-between gap-4">
          <div className="text-sm">
            <p className="font-medium text-foreground">
              {incidents.length} record{incidents.length === 1 ? "" : "s"}{" "}
              analyzed
            </p>
            <p className="text-muted-foreground">
              {lastRun
                ? `Last run ${relativeTime(lastRun)}`
                : "Run analysis to refresh observations."}
            </p>
          </div>
          <Button onClick={handleRun} disabled={running || busy}>
            <RefreshCw
              className={running ? "size-4 animate-spin" : "size-4"}
              aria-hidden="true"
            />
            Run
          </Button>
        </CardBody>
      </Card>

      {alerts.length === 0 ? (
        <Card>
          <CardBody className="flex items-start gap-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-pretty leading-relaxed">
              No observations yet. Log a few incidents, then run the analysis.
              Findings will appear here as neutral statistical correlations.
            </p>
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-3">
          {alerts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} />
          ))}
        </ul>
      )}

      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        This tool reports correlations within your own log. It does not identify
        people, assign blame, or infer external intent. Interpret findings with
        care.
      </p>
    </div>
  )
}

function AlertItem({ alert }: { alert: PatternAlert }) {
  const Icon = TYPE_ICON[alert.type]
  return (
    <li>
      <Card>
        <CardBody className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <h3 className="text-balance font-medium text-foreground">
                {alert.title}
              </h3>
            </div>
            <Badge tone={SEVERITY_TONE[alert.severity]}>{alert.severity}</Badge>
          </div>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            {alert.observation}
          </p>
          <p className="text-xs font-medium text-foreground/70">{alert.detail}</p>
        </CardBody>
      </Card>
    </li>
  )
}
