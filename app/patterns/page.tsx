"use client"

import {
  Activity,
  CalendarDays,
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
    "weekday-cluster": CalendarDays,
    "weekday-time-cluster": CalendarDays,
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

type AlertData = Record<string, string | number | boolean | null | undefined>

function parseAlertData(alert: PatternAlert): AlertData {
  if (alert.data && typeof alert.data === "object") {
    return alert.data as AlertData
  }

  try {
    const parsed = JSON.parse(alert.detail)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

export default function PatternsPage() {
  const { t } = useI18n()
  const { alerts, incidents, runAnalysis, busy } = useVault()
  const [running, setRunning] = React.useState(false)
  const [lastRun, setLastRun] = React.useState<number | null>(null)

  async function handleRun() {
    if (incidents.length === 0) return
    setRunning(true)
    try {
      await runAnalysis()
      setLastRun(Date.now())
    } finally {
      setRunning(false)
    }
  }

  const analyzedLabel = React.useMemo(() => {
    const plural = incidents.length === 1 ? "" : "s"
    return t("patterns.recordsAnalyzed", {
      count: incidents.length,
      plural,
    })
  }, [incidents.length, t])

  const lastRunLabel = React.useMemo(() => {
    if (!lastRun) return t("patterns.neverRun")
    return t("patterns.lastRun", { time: relativeTime(lastRun, t) })
  }, [lastRun, t])

  return (
    <div className="space-y-5">
      <SectionTitle
        title={t("patterns.title")}
        description={t("patterns.description")}
      />

      <Card className="bg-primary/5">
        <CardBody className="flex items-center justify-between gap-4">
          <div className="text-sm">
            <p className="font-medium text-foreground">{analyzedLabel}</p>
            <p className="text-muted-foreground">{lastRunLabel}</p>
          </div>
          <Button
            type="button"
            onClick={handleRun}
            disabled={running || busy || incidents.length === 0}
          >
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
            <p className="text-pretty leading-relaxed">{t("patterns.empty")}</p>
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
        {t("patterns.caution")}
      </p>
    </div>
  )
}

function AlertItem({ alert }: { alert: PatternAlert }) {
  const { t } = useI18n()
  const Icon = TYPE_ICON[alert.type]
  const data = React.useMemo(() => parseAlertData(alert), [alert])

  const translatedBlock = React.useMemo(() => {
    const block = String(data.block ?? "")
    switch (block) {
      case "earlyMorning":
      case "dawn":
        return t("patterns.timeBlocks.dawn")
      case "morning":
        return t("patterns.timeBlocks.morning")
      case "afternoon":
        return t("patterns.timeBlocks.afternoon")
      case "evening":
        return t("patterns.timeBlocks.evening")
      case "night":
        return t("patterns.timeBlocks.night")
      default:
        return block
    }
  }, [data.block, t])

  const translatedWeekday = React.useMemo(() => {
    const weekday = data.weekday
    if (weekday === undefined || weekday === null) return ""
    return t(`patterns.weekdays.${String(weekday)}`)
  }, [data.weekday, t])

  const translatedTitle = React.useMemo(() => {
    switch (alert.type) {
      case "repeated-time":
        return t("patterns.alertTitles.repeatedTime")
      case "weekday-cluster":
        return t("patterns.alertTitles.weekdayCluster")
      case "weekday-time-cluster":
        return t("patterns.alertTitles.weekdayTimeCluster")
      case "repeated-location":
        return t("patterns.alertTitles.repeatedLocation")
      case "frequency-spike":
        return t("patterns.alertTitles.frequencySpike")
      case "category-cluster":
        return t("patterns.alertTitles.categoryCluster")
      case "activity-trend": {
        const direction = String(data.direction ?? "")
        if (direction === "increasing") {
          return t("patterns.alertTitles.activityTrendIncreasing")
        }
        if (direction === "decreasing") {
          return t("patterns.alertTitles.activityTrendDecreasing")
        }
        return t("patterns.alertTitles.activityTrendStable")
      }
      default:
        return alert.title
    }
  }, [alert.type, alert.title, data.direction, t])

  const translatedObservation = React.useMemo(() => {
    switch (alert.type) {
      case "repeated-time":
        return t("patterns.alertText.repeatedTime", {
          count: Number(data.count ?? 0),
          block: translatedBlock,
        })

      case "weekday-cluster":
        return t("patterns.alertText.weekdayCluster", {
          count: Number(data.count ?? 0),
          day: translatedWeekday,
        })

      case "weekday-time-cluster":
        return t("patterns.alertText.weekdayTimeCluster", {
          count: Number(data.count ?? 0),
          day: translatedWeekday,
          block: translatedBlock,
        })

      case "repeated-location":
        return t("patterns.alertText.repeatedLocation", {
          count: Number(data.count ?? 0),
          cell: String(data.cell ?? data.coordinates ?? ""),
        })

      case "frequency-spike":
        return t("patterns.alertText.frequencySpike", {
          day: String(data.day ?? ""),
          count: Number(data.count ?? 0),
        })

      case "category-cluster":
        return t("patterns.alertText.categoryCluster", {
          share: Number(data.share ?? data.percentage ?? 0),
          category: String(data.categoryLabel ?? data.categoryName ?? data.category ?? ""),
        })

      case "activity-trend": {
        const direction = String(data.direction ?? "")
        if (direction === "increasing") {
          return t("patterns.alertText.activityTrendIncreasing")
        }
        if (direction === "decreasing") {
          return t("patterns.alertText.activityTrendDecreasing")
        }
        return t("patterns.alertText.activityTrendStable")
      }

      default:
        return alert.observation
    }
  }, [alert.type, alert.observation, data, translatedBlock, translatedWeekday, t])

  const translatedDetail = React.useMemo(() => {
    switch (alert.type) {
      case "repeated-time":
        return t("patterns.alertDetail.repeatedTime", {
          share: Number(data.percentage ?? 0),
        })

      case "weekday-cluster":
        return t("patterns.alertDetail.weekdayCluster", {
          share: Number(data.percentage ?? 0),
        })

      case "weekday-time-cluster":
        return t("patterns.alertDetail.weekdayTimeCluster", {
          count: Number(data.count ?? 0),
          share: Number(data.percentage ?? 0),
        })

      case "repeated-location":
        return t("patterns.alertDetail.repeatedLocation")

      case "frequency-spike":
        return t("patterns.alertDetail.frequencySpike", {
          average: String(data.average ?? "0"),
          std: String(data.std ?? "0"),
        })

      case "category-cluster":
        return t("patterns.alertDetail.categoryCluster", {
          count: Number(data.count ?? 0),
          total: Number(data.total ?? 0),
        })

      case "activity-trend": {
        const direction = String(data.direction ?? "")
        const payload = {
          perWeek: String(data.perWeek ?? "0"),
          spanDays: String(data.spanDays ?? "0"),
        }

        if (direction === "increasing") {
          return t("patterns.alertDetail.activityTrendIncreasing", payload)
        }
        if (direction === "decreasing") {
          return t("patterns.alertDetail.activityTrendDecreasing", payload)
        }
        return t("patterns.alertDetail.activityTrendStable", {
          perWeek: String(data.perWeek ?? "0"),
        })
      }

      default:
        return alert.detail
    }
  }, [alert.type, alert.detail, data, t])

  const severityLabel =
    alert.severity === "high"
      ? t("patterns.severity.high")
      : alert.severity === "notable"
      ? t("patterns.severity.notable")
      : t("patterns.severity.info")

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
            <Badge tone={SEVERITY_TONE[alert.severity]}>{severityLabel}</Badge>
          </div>

          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            {translatedObservation}
          </p>

          <p className="text-xs font-medium text-foreground/70">
            {translatedDetail}
          </p>
        </CardBody>
      </Card>
    </li>
  )
}
