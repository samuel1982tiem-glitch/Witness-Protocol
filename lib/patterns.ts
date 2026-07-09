// Local pattern analysis engine.
//
// Operates ONLY on the user's own decrypted records, entirely in-browser.
// Uses deterministic statistical methods (counting, bucketing, linear trend
// estimation). It surfaces observations and correlations only — it never makes
// claims about causes, perpetrators, or external intent.

import { CATEGORY_MAP } from "./categories"
import type { CategoryId, Incident, PatternAlert } from "./types"

const DAY_MS = 24 * 60 * 60 * 1000

function id(): string {
  return `alert_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
}

function timeBucketLabel(hour: number): string {
  const start = hour % 12 === 0 ? 12 : hour % 12
  const period = hour < 12 ? "AM" : "PM"
  return `${start}:00 ${period}`
}

function timeBlockFromHour(
  hour: number,
): "earlyMorning" | "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 0 && hour < 6) return "earlyMorning"
  if (hour >= 6 && hour < 12) return "morning"
  if (hour >= 12 && hour < 18) return "afternoon"
  if (hour >= 18 && hour < 22) return "evening"
  return "night"
}

/** Group incidents by hour-of-day and flag recurring times. */
function repeatedTimes(incidents: Incident[]): PatternAlert[] {
  const byHour = new Map<number, Incident[]>()
  for (const inc of incidents) {
    const hour = new Date(inc.occurredAt).getHours()
    const list = byHour.get(hour) ?? []
    list.push(inc)
    byHour.set(hour, list)
  }

  const alerts: PatternAlert[] = []
  for (const [hour, list] of byHour) {
    if (list.length >= 3) {
      const share = Math.round((list.length / incidents.length) * 100)
      alerts.push({
        id: id(),
        type: "repeated-time",
        severity: list.length >= 5 ? "high" : "notable",
        title: `Recurring activity around ${timeBucketLabel(hour)}`,
        observation: `${list.length} incidents cluster near ${timeBucketLabel(hour)}.`,
        detail: `${share}% of incidents fall in this hour window.`,
        relatedIncidentIds: list.map((i) => i.id),
        createdAt: Date.now(),
        data: {
          hour,
          block: timeBlockFromHour(hour),
          count: list.length,
          total: incidents.length,
          percentage: share,
        },
      })
    }
  }
  return alerts
}

/** Cluster incidents by weekday. */
function repeatedWeekdays(incidents: Incident[]): PatternAlert[] {
  const byWeekday = new Map<number, Incident[]>()
  for (const inc of incidents) {
    const weekday = new Date(inc.occurredAt).getDay()
    const list = byWeekday.get(weekday) ?? []
    list.push(inc)
    byWeekday.set(weekday, list)
  }

  const alerts: PatternAlert[] = []
  for (const [weekday, list] of byWeekday) {
    if (list.length >= 3) {
      const share = Math.round((list.length / incidents.length) * 100)
      alerts.push({
        id: id(),
        type: "weekday-cluster",
        severity: list.length >= 5 ? "high" : "notable",
        title: "Weekday concentration",
        observation: `${list.length} incidents cluster on the same weekday.`,
        detail: `${share}% of incidents fall on the same weekday.`,
        relatedIncidentIds: list.map((i) => i.id),
        createdAt: Date.now(),
        data: {
          weekday,
          count: list.length,
          total: incidents.length,
          percentage: share,
        },
      })
    }
  }
  return alerts
}

/** Cluster incidents by weekday + time block. */
function weekdayTimeClusters(incidents: Incident[]): PatternAlert[] {
  const byKey = new Map<string, Incident[]>()

  for (const inc of incidents) {
    const date = new Date(inc.occurredAt)
    const weekday = date.getDay()
    const block = timeBlockFromHour(date.getHours())
    const key = `${weekday}:${block}`
    const list = byKey.get(key) ?? []
    list.push(inc)
    byKey.set(key, list)
  }

  const alerts: PatternAlert[] = []
  for (const [key, list] of byKey) {
    if (list.length >= 3) {
      const [weekdayRaw, block] = key.split(":")
      const weekday = Number(weekdayRaw)
      const share = Math.round((list.length / incidents.length) * 100)

      alerts.push({
        id: id(),
        type: "weekday-time-cluster",
        severity: list.length >= 5 ? "high" : "notable",
        title: "Repeated weekday + time pattern",
        observation: `${list.length} incidents cluster on the same weekday and time block.`,
        detail: `${list.length} incidents (${share}% of the log) share this weekday/time block.`,
        relatedIncidentIds: list.map((i) => i.id),
        createdAt: Date.now(),
        data: {
          weekday,
          block: block as
            | "earlyMorning"
            | "morning"
            | "afternoon"
            | "evening"
            | "night",
          count: list.length,
          total: incidents.length,
          percentage: share,
        },
      })
    }
  }
  return alerts
}

/** Cluster incidents by rounded location and flag repeated places. */
function repeatedLocations(incidents: Incident[]): PatternAlert[] {
  const located = incidents.filter((i) => i.location)
  const byCell = new Map<string, Incident[]>()

  for (const inc of located) {
    const lat = inc.location!.latitude.toFixed(3)
    const lng = inc.location!.longitude.toFixed(3)
    const key = `${lat},${lng}`
    const list = byCell.get(key) ?? []
    list.push(inc)
    byCell.set(key, list)
  }

  const alerts: PatternAlert[] = []
  for (const [key, list] of byCell) {
    if (list.length >= 2) {
      alerts.push({
        id: id(),
        type: "repeated-location",
        severity: list.length >= 4 ? "high" : "notable",
        title: "Repeated location",
        observation: `${list.length} incidents share approximately the same coordinates (${key}).`,
        detail: `Coordinates rounded to ~110m precision.`,
        relatedIncidentIds: list.map((i) => i.id),
        createdAt: Date.now(),
        data: {
          coordinates: key,
          cell: key,
          count: list.length,
        },
      })
    }
  }
  return alerts
}

/** Detect daily counts that exceed the historical mean by >2 std deviations. */
function frequencySpikes(incidents: Incident[]): PatternAlert[] {
  if (incidents.length < 4) return []

  const byDay = new Map<string, Incident[]>()
  for (const inc of incidents) {
    const key = new Date(inc.occurredAt).toISOString().slice(0, 10)
    const list = byDay.get(key) ?? []
    list.push(inc)
    byDay.set(key, list)
  }

  const counts = [...byDay.values()].map((l) => l.length)
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length
  const variance =
    counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length
  const std = Math.sqrt(variance)
  const threshold = mean + 2 * std

  const alerts: PatternAlert[] = []
  for (const [day, list] of byDay) {
    if (std > 0 && list.length > threshold && list.length >= 3) {
      alerts.push({
        id: id(),
        type: "frequency-spike",
        severity: "high",
        title: "Frequency spike",
        observation: `A daily spike was detected on ${day}.`,
        detail: `Daily average is ${mean.toFixed(1)} (±${std.toFixed(1)}).`,
        relatedIncidentIds: list.map((i) => i.id),
        createdAt: Date.now(),
        data: {
          day,
          count: list.length,
          average: Number(mean.toFixed(1)),
          std: Number(std.toFixed(1)),
        },
      })
    }
  }
  return alerts
}

/** Identify categories that dominate the log. */
function categoryClustering(incidents: Incident[]): PatternAlert[] {
  const byCategory = new Map<CategoryId, Incident[]>()
  for (const inc of incidents) {
    const list = byCategory.get(inc.category) ?? []
    list.push(inc)
    byCategory.set(inc.category, list)
  }

  const alerts: PatternAlert[] = []
  for (const [category, list] of byCategory) {
    const share = list.length / incidents.length
    if (list.length >= 3 && share >= 0.4) {
      alerts.push({
        id: id(),
        type: "category-cluster",
        severity: share >= 0.6 ? "high" : "notable",
        title: `Clustering in ${CATEGORY_MAP[category]?.name ?? "Unknown"}`,
        observation: `${Math.round(share * 100)}% of incidents fall in one category.`,
        detail: `${list.length} of ${incidents.length} total incidents.`,
        relatedIncidentIds: list.map((i) => i.id),
        createdAt: Date.now(),
        data: {
          category,
          categoryLabel: CATEGORY_MAP[category]?.name ?? "Unknown",
          categoryName: CATEGORY_MAP[category]?.name ?? "Unknown",
          count: list.length,
          total: incidents.length,
          percentage: Math.round(share * 100),
          share: Math.round(share * 100),
        },
      })
    }
  }
  return alerts
}

/** Estimate an activity trend via linear regression over the timeline. */
function activityTrend(incidents: Incident[]): PatternAlert[] {
  if (incidents.length < 5) return []

  const sorted = [...incidents].sort((a, b) => a.occurredAt - b.occurredAt)
  const start = sorted[0].occurredAt
  const end = sorted[sorted.length - 1].occurredAt
  const spanDays = Math.max(1, (end - start) / DAY_MS)
  if (spanDays < 3) return []

  const buckets = new Map<number, number>()
  for (const inc of sorted) {
    const dayIndex = Math.floor((inc.occurredAt - start) / DAY_MS)
    buckets.set(dayIndex, (buckets.get(dayIndex) ?? 0) + 1)
  }

  const totalDays = Math.ceil(spanDays) + 1
  const xs: number[] = []
  const ys: number[] = []
  for (let d = 0; d < totalDays; d++) {
    xs.push(d)
    ys.push(buckets.get(d) ?? 0)
  }

  const n = xs.length
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0)
  const sumXX = xs.reduce((a, x) => a + x * x, 0)
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return []

  const slope = (n * sumXY - sumX * sumY) / denom
  const perWeek = slope * 7

  if (Math.abs(perWeek) < 0.5) {
    return [
      {
        id: id(),
        type: "activity-trend",
        severity: "info",
        title: "Stable activity trend",
        observation: "Logging frequency appears stable over the recorded period.",
        detail: `Change of ${perWeek.toFixed(2)} incidents/week.`,
        relatedIncidentIds: [],
        createdAt: Date.now(),
        data: {
          direction: "stable",
          perWeek: Number(perWeek.toFixed(2)),
          spanDays: Math.round(spanDays),
        },
      },
    ]
  }

  const direction = slope > 0 ? "increasing" : "decreasing"
  return [
    {
      id: id(),
      type: "activity-trend",
      severity: slope > 0 ? "notable" : "info",
      title: `Activity trend ${direction}`,
      observation: `Logging frequency appears ${direction} over time.`,
      detail: `Estimated change of ${Math.abs(perWeek).toFixed(
        1,
      )} incidents/week across ${Math.round(spanDays)} days.`,
      relatedIncidentIds: [],
      createdAt: Date.now(),
      data: {
        direction,
        perWeek: Number(Math.abs(perWeek).toFixed(1)),
        spanDays: Math.round(spanDays),
      },
    },
  ]
}

const SEVERITY_RANK = { high: 0, notable: 1, info: 2 } as const

/** Run the full deterministic analysis suite over the user's incidents. */
export function analyzeIncidents(incidents: Incident[]): PatternAlert[] {
  if (incidents.length === 0) return []

  const alerts = [
    ...frequencySpikes(incidents),
    ...repeatedTimes(incidents),
    ...repeatedWeekdays(incidents),
    ...weekdayTimeClusters(incidents),
    ...repeatedLocations(incidents),
    ...categoryClustering(incidents),
    ...activityTrend(incidents),
  ]

  return alerts.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  )
}


/**
 * Translates a PatternAlert's title/observation/detail for display,
 * mirroring the logic in app/patterns/page.tsx's AlertItem component.
 * Extracted here (additive, no change to the page) so other consumers
 * (e.g. lib/report.ts) can reuse it without duplicating the switch-cases.
 */
export function translatePatternAlert(
  alert: PatternAlert,
  t: (key: string, vars?: Record<string, string | number>) => string,
): { title: string; observation: string; detail: string } {
  const data = alert.data ?? {}

  const translatedBlock = (() => {
    const block = String(data.block ?? "")
    switch (block) {
      case "earlyMorning": return t("patterns.timeBlocks.dawn")
      case "dawn": return t("patterns.timeBlocks.dawn")
      case "morning": return t("patterns.timeBlocks.morning")
      case "afternoon": return t("patterns.timeBlocks.afternoon")
      case "evening": return t("patterns.timeBlocks.evening")
      case "night": return t("patterns.timeBlocks.night")
      default: return block
    }
  })()

  const translatedWeekday = (() => {
    const weekday = data.weekday
    if (weekday === undefined || weekday === null) return ""
    return t(`patterns.weekdays.${String(weekday)}`)
  })()

  const title = (() => {
    switch (alert.type) {
      case "repeated-time": return t("patterns.alertTitles.repeatedTime")
      case "weekday-cluster": return t("patterns.alertTitles.repeatedTime")
      case "weekday-time-cluster": return t("patterns.alertTitles.repeatedTime")
      case "repeated-location": return t("patterns.alertTitles.repeatedLocation")
      case "frequency-spike": return t("patterns.alertTitles.frequencySpike")
      case "category-cluster": return t("patterns.alertTitles.categoryCluster")
      case "activity-trend": {
        const direction = String(data.direction ?? "")
        if (direction === "increasing") return t("patterns.alertTitles.activityTrendIncreasing")
        if (direction === "decreasing") return t("patterns.alertTitles.activityTrendDecreasing")
        return t("patterns.alertTitles.activityTrendStable")
      }
      default: return alert.title
    }
  })()

  const observation = (() => {
    switch (alert.type) {
      case "repeated-time":
        return t("patterns.alertText.repeatedTime", { count: Number(data.count ?? 0), block: translatedBlock })
      case "weekday-cluster":
        return `${Number(data.count ?? 0)} ${translatedWeekday}`
      case "weekday-time-cluster":
        return `${Number(data.count ?? 0)} ${translatedWeekday} ${translatedBlock}`
      case "repeated-location":
        return t("patterns.alertText.repeatedLocation", {
          count: Number(data.count ?? 0),
          cell: String(data.cell ?? data.coordinates ?? ""),
        })
      case "frequency-spike": {
        const rawDay = String(data.day ?? "")
        const formattedDay = rawDay ? new Date(`${rawDay}T00:00:00`).toLocaleDateString() : rawDay
        return t("patterns.alertText.frequencySpike", { day: formattedDay, count: Number(data.count ?? 0) })
      }
      case "category-cluster":
        return t("patterns.alertText.categoryCluster", {
          share: Number(data.share ?? data.percentage ?? 0),
          category: String(data.categoryName ?? data.category ?? ""),
        })
      case "activity-trend": {
        const direction = String(data.direction ?? "")
        if (direction === "increasing") return t("patterns.alertText.activityTrendIncreasing")
        if (direction === "decreasing") return t("patterns.alertText.activityTrendDecreasing")
        return t("patterns.alertText.activityTrendStable")
      }
      default: return alert.observation
    }
  })()

  const detail = (() => {
    switch (alert.type) {
      case "repeated-time": return t("patterns.alertDetail.repeatedTime", { share: Number(data.percentage ?? 0) })
      case "repeated-location": return t("patterns.alertDetail.repeatedLocation")
      case "frequency-spike": return t("patterns.alertDetail.frequencySpike", { average: Number(data.average ?? 0), std: Number(data.std ?? 0) })
      case "category-cluster": return t("patterns.alertDetail.categoryCluster", { count: Number(data.count ?? 0), total: Number(data.total ?? 0) })
      case "weekday-cluster": return t("patterns.alertDetail.weekdayCluster", { share: Number(data.percentage ?? 0) })
      case "weekday-time-cluster": return t("patterns.alertDetail.weekdayTimeCluster", { count: Number(data.count ?? 0), share: Number(data.percentage ?? 0) })
      case "activity-trend": {
        const direction = String(data.direction ?? "")
        if (direction === "increasing") return t("patterns.alertDetail.activityTrendIncreasing", { perWeek: Number(data.perWeek ?? 0), spanDays: Number(data.spanDays ?? 0) })
        if (direction === "decreasing") return t("patterns.alertDetail.activityTrendDecreasing", { perWeek: Number(data.perWeek ?? 0), spanDays: Number(data.spanDays ?? 0) })
        return t("patterns.alertDetail.activityTrendStable", { perWeek: Number(data.perWeek ?? 0) })
      }
      default: return alert.detail
    }
  })()

  return { title, observation, detail }
}
