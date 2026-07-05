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
import { useI18n } from "@/components/i18n-provider"
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
  const { t } = useI18n()
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
        title={t("patterns.title")}
        description={t("patterns.description")}
      />

      <Card className="bg-primary/5">
        <CardBody className="flex items-center justify-between gap-4">
          <div className="text-sm">
            <p className="font-medium text-foreground">
              {t("patterns.recordsAnalyzed", {
                count: incidents.length,
              })}
            </p>
            <p className="text-muted-foreground">
              {lastRun
                ? t("patterns.lastRun", {
                    time: relativeTime(lastRun, t),
                  })
                : t("patterns.runToRefresh")}
            </p>
          </div>
          <Button onClick={handleRun} disabled={running || busy}>
            <RefreshCw
              className={running ? "size-4 animate-spin" : "size-4"}
              aria-hidden="true"
            />
            {t("patterns.run")}
          </Button>
        </CardBody>
      </Card>

      {alerts.length === 0 ? (
        <Card>
          <CardBody className="flex items-start gap-3 text-sm text-muted-foreground">
            <Info
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p className="text-pretty leading-relaxed">
              {t("patterns.empty")}
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
        {t("patterns.disclaimer")}
      </p>
    </div>
  )
}

function AlertItem({ alert }: { alert: PatternAlert }) {
  const { t } = useI18n()
  const Icon = TYPE_ICON[alert.type]

  const translatedTitle = React.useMemo(() => {
    const data = alert.data ?? {}

    switch (alert.type) {
      case "repeated-time": {
        const weekday =
          typeof data.weekday === "number"
            ? t(`patterns.weekdays.${data.weekday}`)
            : String(data.weekday ?? "")
        const block =
          typeof data.block === "string"
            ? t(`patterns.timeBlocks.${data.block}`)
            : String(data.block ?? "")
        return t("patterns.alerts.repeatedTime.title", { weekday, block })
      }

      case "repeated-location":
        return t("patterns.alerts.repeatedLocation.title")

      case "frequency-spike": {
        const date = String(data.date ?? "")
        return t("patterns.alerts.frequencySpike.title", { date })
      }

      case "category-cluster": {
        const category = String(data.categoryLabel ?? alert.title ?? "")
        return t("patterns.alerts.categoryCluster.title", { category })
      }

      case "activity-trend": {
        const direction =
          data.direction === "down"
            ? t("patterns.trendDirection.down")
            : t("patterns.trendDirection.up")
        return t("patterns.alerts.activityTrend.title", { direction })
      }

      default:
        return alert.title
    }
  }, [alert, t])

  const translatedObservation = React.useMemo(() => {
    const data = alert.data ?? {}

    switch (alert.type) {
      case "repeated-time": {
        const count = Number(data.count ?? 0)
        const weekday =
          typeof data.weekday === "number"
            ? t(`patterns.weekdays.${data.weekday}`)
            : String(data.weekday ?? "")
        const block =
          typeof data.block === "string"
            ? t(`patterns.timeBlocks.${data.block}`)
            : String(data.block ?? "")
        return t("patterns.alerts.repeatedTime.observation", {
          count,
          weekday,
          block,
        })
      }

      case "repeated-location": {
        const count = Number(data.count ?? 0)
        return t("patterns.alerts.repeatedLocation.observation", { count })
      }

      case "frequency-spike": {
        const count = Number(data.count ?? 0)
        const date = String(data.date ?? "")
        return t("patterns.alerts.frequencySpike.observation", {
          count,
          date,
        })
      }

      case "category-cluster": {
        const count = Number(data.count ?? 0)
        const category = String(data.categoryLabel ?? "")
        return t("patterns.alerts.categoryCluster.observation", {
          count,
          category,
        })
      }

      case "activity-trend": {
        const direction =
          data.direction === "down"
            ? t("patterns.trendDirection.down")
            : t("patterns.trendDirection.up")
        const percent = Number(data.percent ?? 0)
        return t("patterns.alerts.activityTrend.observation", {
          direction,
          percent,
        })
      }

      default:
        return alert.observation
    }
  }, [alert, t])

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
                {translatedTitle}
              </h3>
            </div>
            <Badge tone={SEVERITY_TONE[alert.severity]}>
              {t(`patterns.severity.${alert.severity}`)}
            </Badge>
          </div>

          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            {translatedObservation}
          </p>

          <p className="text-xs font-medium text-foreground/70">
            {alert.detail}
          </p>
        </CardBody>
      </Card>
    </li>
  )
}
