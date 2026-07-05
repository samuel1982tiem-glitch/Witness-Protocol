// Local pattern analysis engine.
//
// Operates ONLY on the user's own decrypted records, entirely in-browser.
// Uses deterministic statistical methods (counting, bucketing, rolling windows,
// linear trend estimation). It surfaces observations and correlations only —
// it never makes claims about causes, perpetrators, or external intent.

import { CATEGORY_MAP } from "./categories"
import type { CategoryId, Incident, PatternAlert } from "./types"

const DAY_MS = 24 * 60 * 60 * 1000

function id(): string {
  return `alert_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
}

const SEVERITY_RANK = { high: 0, notable: 1, info: 2 } as const

function timeBucketLabel(hour: number): string {
  const start = hour % 12 === 0 ? 12 : hour % 12
  const period = hour < 12 ? "AM" : "PM"
  return `${start}:00 ${period}`
}

function timeBlockKey(hour: number): "night" | "morning" | "afternoon" | "evening" {
  if (hour < 6) return "night"
  if (hour < 12) return "morning"
  if (hour < 18) return "afternoon"
  return "evening"
}

function weekdayKey(dateMs: number): string {
  const d = new Date(dateMs).getDay() // 0-6
  return String(d)
}

function roundedLocationKey(inc: Incident, precision = 3): string | null {
  if (!inc.location) return null
  return `${inc.location.latitude.toFixed(precision)},${inc.location.longitude.toFixed(precision)}`
}

function createAlert(input: Omit<PatternAlert, "id" | "createdAt">): PatternAlert {
  return {
    id: id(),
    createdAt: Date.now(),
    ...input,
  }
}

/** Exact-hour recurrence */
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
    if (list.length < 3) continue
    const share = Math.round((list.length / incidents.length) * 100)

    alerts.push(
      createAlert({
        type: "repeated-time",
        severity: list.length >= 5 ? "high" : "notable",
        titleKey: "patterns.alerts.repeatedTime.title",
        observationKey: "patterns.alerts.repeatedTime.observation",
        detailKey: "patterns.alerts.repeatedTime.detail",
        params: {
          hourLabel: timeBucketLabel(hour),
          count: list.length,
          share,
        },
        relatedIncidentIds: list.map((i) => i.id),
      }),
    )
  }

  return alerts
}

/** Broader time-block recurrence: night / morning / afternoon / evening */
function repeatedTimeBlocks(incidents: Incident[]): PatternAlert[] {
  if (incidents.length < 4) return []

  const byBlock = new Map<string, Incident[]>()

  for (const inc of incidents) {
    const hour = new Date(inc.occurredAt).getHours()
    const block = timeBlockKey(hour)
    const list = byBlock.get(block) ?? []
    list.push(inc)
    byBlock.set(block, list)
  }

  const alerts: PatternAlert[] = []

  for (const [block, list] of byBlock) {
    const share = list.length / incidents.length
    if (list.length < 4 || share < 0.35) continue

    alerts.push(
      createAlert({
        type: "repeated-time-block",
        severity: share >= 0.5 ? "high" : "notable",
        titleKey: "patterns.alerts.repeatedTimeBlock.title",
        observationKey: "patterns.alerts.repeatedTimeBlock.observation",
        detailKey: "patterns.alerts.repeatedTimeBlock.detail",
        params: {
          block,
          count: list.length,
          share: Math.round(share * 100),
        },
        relatedIncidentIds: list.map((i) => i.id),
      }),
    )
  }

  return alerts
}

/** Repeated weekday */
function repeatedWeekdays(incidents: Incident[]): PatternAlert[] {
  if (incidents.length < 4) return []

  const byWeekday = new Map<string, Incident[]>()

  for (const inc of incidents) {
    const key = weekdayKey(inc.occurredAt)
    const list = byWeekday.get(key) ?? []
    list.push(inc)
    byWeekday.set(key, list)
  }

  const alerts: PatternAlert[] = []

  for (const [weekday, list] of byWeekday) {
    const share = list.length / incidents.length
    if (list.length < 3 || share < 0.3) continue

    alerts.push(
      createAlert({
        type: "repeated-weekday",
        severity: share >= 0.45 ? "high" : "notable",
        titleKey: "patterns.alerts.repeatedWeekday.title",
        observationKey: "patterns.alerts.repeatedWeekday.observation",
        detailKey: "patterns.alerts.repeatedWeekday.detail",
        params: {
          weekday,
          count: list.length,
          share: Math.round(share * 100),
        },
        relatedIncidentIds: list.map((i) => i.id),
      }),
    )
  }

  return alerts
}

/** Repeated rounded coordinates */
function repeatedLocations(incidents: Incident[]): PatternAlert[] {
  const located = incidents.filter((i) => i.location)
  if (located.length < 2) return []

  const byCell = new Map<string, Incident[]>()

  for (const inc of located) {
    const key = roundedLocationKey(inc)
    if (!key) continue
    const list = byCell.get(key) ?? []
    list.push(inc)
    byCell.set(key, list)
  }

  const alerts: PatternAlert[] = []

  for (const [key, list] of byCell) {
    if (list.length < 2) continue

    alerts.push(
      createAlert({
        type: "repeated-location",
        severity: list.length >= 4 ? "high" : "notable",
        titleKey: "patterns.alerts.repeatedLocation.title",
        observationKey: "patterns.alerts.repeatedLocation.observation",
        detailKey: "patterns.alerts.repeatedLocation.detail",
        params: {
          location: key,
          count: list.length,
        },
        relatedIncidentIds: list.map((i) => i.id),
      }),
    )
  }

  return alerts
}

/** Daily spike vs historical mean */
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
  const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length
  const std = Math.sqrt(variance)
  const threshold = mean + 2 * std

  const alerts: PatternAlert[] = []

  for (const [day, list] of byDay) {
    if (std > 0 && list.length > threshold && list.length >= 3) {
      alerts.push(
        createAlert({
          type: "frequency-spike",
          severity: "high",
          titleKey: "patterns.alerts.frequencySpike.title",
          observationKey: "patterns.alerts.frequencySpike.observation",
          detailKey: "patterns.alerts.frequencySpike.detail",
          params: {
            day,
            count: list.length,
            average: mean.toFixed(1),
            std: std.toFixed(1),
          },
          relatedIncidentIds: list.map((i) => i.id),
        }),
      )
    }
  }

  return alerts
}

/** Rolling 7-day burst */
function rollingSpikes(incidents: Incident[]): PatternAlert[] {
  if (incidents.length < 6) return []

  const sorted = [...incidents].sort((a, b) => a.occurredAt - b.occurredAt)
  const dayCounts = new Map<number, number>()

  for (const inc of sorted) {
    const dayIndex = Math.floor(inc.occurredAt / DAY_MS)
    dayCounts.set(dayIndex, (dayCounts.get(dayIndex) ?? 0) + 1)
  }

  const dayIndices = [...dayCounts.keys()].sort((a, b) => a - b)
  if (dayIndices.length < 4) return []

  const alerts: PatternAlert[] = []

  for (let i = 0; i < dayIndices.length; i++) {
    const startDay = dayIndices[i]
    let total = 0

    for (let d = startDay; d < startDay + 7; d++) {
      total += dayCounts.get(d) ?? 0
    }

    if (total < 5) continue

    // baseline: average daily count across the whole record set
    const averagePerDay =
      [...dayCounts.values()].reduce((a, b) => a + b, 0) / dayCounts.size

    if (total >= averagePerDay * 7 * 1.8) {
      const startDate = new Date(startDay * DAY_MS).toISOString().slice(0, 10)
      const endDate = new Date((startDay + 6) * DAY_MS).toISOString().slice(0, 10)

      const related = sorted
        .filter((inc) => {
          const di = Math.floor(inc.occurredAt / DAY_MS)
          return di >= startDay && di < startDay + 7
        })
        .map((inc) => inc.id)

      alerts.push(
        createAlert({
          type: "rolling-spike",
          severity: total >= averagePerDay * 7 * 2.5 ? "high" : "notable",
          titleKey: "patterns.alerts.rollingSpike.title",
          observationKey: "patterns.alerts.rollingSpike.observation",
          detailKey: "patterns.alerts.rollingSpike.detail",
          params: {
            startDate,
            endDate,
            count: total,
            averagePerDay: averagePerDay.toFixed(1),
          },
          relatedIncidentIds: related,
        }),
      )
    }
  }

  return alerts
}

/** Dominant category share */
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
    if (list.length >= 3 && share >= 0.35) {
      alerts.push(
        createAlert({
          type: "category-cluster",
          severity: share >= 0.55 ? "high" : "notable",
          titleKey: "patterns.alerts.categoryCluster.title",
          observationKey: "patterns.alerts.categoryCluster.observation",
          detailKey: "patterns.alerts.categoryCluster.detail",
          params: {
            categoryName: CATEGORY_MAP[category]?.name ?? category,
            count: list.length,
            total: incidents.length,
            share: Math.round(share * 100),
          },
          relatedIncidentIds: list.map((i) => i.id),
        }),
      )
    }
  }

  return alerts
}

/** Same category repeatedly occurring in the same time block */
function categoryTimeClusters(incidents: Incident[]): PatternAlert[] {
  if (incidents.length < 5) return []

  const byCombo = new Map<string, Incident[]>()

  for (const inc of incidents) {
    const hour = new Date(inc.occurredAt).getHours()
    const block = timeBlockKey(hour)
    const key = `${inc.category}::${block}`
    const list = byCombo.get(key) ?? []
    list.push(inc)
    byCombo.set(key, list)
  }

  const alerts: PatternAlert[] = []

  for (const [key, list] of byCombo) {
    if (list.length < 3) continue
    const [category, block] = key.split("::") as [CategoryId, string]

    alerts.push(
      createAlert({
        type: "category-time-cluster",
        severity: list.length >= 5 ? "high" : "notable",
        titleKey: "patterns.alerts.categoryTimeCluster.title",
        observationKey: "patterns.alerts.categoryTimeCluster.observation",
        detailKey: "patterns.alerts.categoryTimeCluster.detail",
        params: {
          categoryName: CATEGORY_MAP[category]?.name ?? category,
          block,
          count: list.length,
        },
        relatedIncidentIds: list.map((i) => i.id),
      }),
    )
  }

  return alerts
}

/** Same category repeatedly appearing in roughly the same place */
function categoryLocationClusters(incidents: Incident[]): PatternAlert[] {
  const withLocation = incidents.filter((i) => i.location)
  if (withLocation.length < 4) return []

  const byCombo = new Map<string, Incident[]>()

  for (const inc of withLocation) {
    const loc = roundedLocationKey(inc)
    if (!loc) continue
    const key = `${inc.category}::${loc}`
    const list = byCombo.get(key) ?? []
    list.push(inc)
    byCombo.set(key, list)
  }

  const alerts: PatternAlert[] = []

  for (const [key, list] of byCombo) {
    if (list.length < 2) continue
    const [category, location] = key.split("::") as [CategoryId, string]

    alerts.push(
      createAlert({
        type: "category-location-cluster",
        severity: list.length >= 4 ? "high" : "notable",
        titleKey: "patterns.alerts.categoryLocationCluster.title",
        observationKey: "patterns.alerts.categoryLocationCluster.observation",
        detailKey: "patterns.alerts.categoryLocationCluster.detail",
        params: {
          categoryName: CATEGORY_MAP[category]?.name ?? category,
          location,
          count: list.length,
        },
        relatedIncidentIds: list.map((i) => i.id),
      }),
    )
  }

  return alerts
}

/** Overall activity trend via linear regression */
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
      createAlert({
        type: "activity-trend",
        severity: "info",
        titleKey: "patterns.alerts.activityTrendStable.title",
        observationKey: "patterns.alerts.activityTrendStable.observation",
        detailKey: "patterns.alerts.activityTrendStable.detail",
        params: {
          perWeek: perWeek.toFixed(2),
        },
        relatedIncidentIds: [],
      }),
    ]
  }

  return [
    createAlert({
      type: "activity-trend",
      severity: slope > 0 ? "notable" : "info",
      titleKey:
        slope > 0
          ? "patterns.alerts.activityTrendIncreasing.title"
          : "patterns.alerts.activityTrendDecreasing.title",
      observationKey:
        slope > 0
          ? "patterns.alerts.activityTrendIncreasing.observation"
          : "patterns.alerts.activityTrendDecreasing.observation",
      detailKey:
        slope > 0
          ? "patterns.alerts.activityTrendIncreasing.detail"
          : "patterns.alerts.activityTrendDecreasing.detail",
      params: {
        perWeek: Math.abs(perWeek).toFixed(1),
        spanDays: Math.round(spanDays),
      },
      relatedIncidentIds: [],
    }),
  ]
}

/** Per-category trend */
function categoryTrends(incidents: Incident[]): PatternAlert[] {
  if (incidents.length < 6) return []

  const byCategory = new Map<CategoryId, Incident[]>()
  for (const inc of incidents) {
    const list = byCategory.get(inc.category) ?? []
    list.push(inc)
    byCategory.set(inc.category, list)
  }

  const alerts: PatternAlert[] = []

  for (const [category, list] of byCategory) {
    if (list.length < 4) continue

    const sorted = [...list].sort((a, b) => a.occurredAt - b.occurredAt)
    const start = sorted[0].occurredAt
    const end = sorted[sorted.length - 1].occurredAt
    const spanDays = Math.max(1, (end - start) / DAY_MS)
    if (spanDays < 5) continue

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
    if (denom === 0) continue

    const slope = (n * sumXY - sumX * sumY) / denom
    const perWeek = slope * 7
    if (Math.abs(perWeek) < 0.4) continue

    alerts.push(
      createAlert({
        type: "category-trend",
        severity: slope > 0 ? "notable" : "info",
        titleKey:
          slope > 0
            ? "patterns.alerts.categoryTrendIncreasing.title"
            : "patterns.alerts.categoryTrendDecreasing.title",
        observationKey:
          slope > 0
            ? "patterns.alerts.categoryTrendIncreasing.observation"
            : "patterns.alerts.categoryTrendDecreasing.observation",
        detailKey:
          slope > 0
            ? "patterns.alerts.categoryTrendIncreasing.detail"
            : "patterns.alerts.categoryTrendDecreasing.detail",
        params: {
          categoryName: CATEGORY_MAP[category]?.name ?? category,
          perWeek: Math.abs(perWeek).toFixed(1),
          spanDays: Math.round(spanDays),
        },
        relatedIncidentIds: list.map((i) => i.id),
      }),
    )
  }

  return alerts
}

/** Run the full deterministic analysis suite over the user's incidents. */
export function analyzeIncidents(incidents: Incident[]): PatternAlert[] {
  if (incidents.length === 0) return []

  const alerts = [
    ...frequencySpikes(incidents),
    ...rollingSpikes(incidents),
    ...repeatedTimes(incidents),
    ...repeatedTimeBlocks(incidents),
    ...repeatedWeekdays(incidents),
    ...repeatedLocations(incidents),
    ...categoryClustering(incidents),
    ...categoryTimeClusters(incidents),
    ...categoryLocationClusters(incidents),
    ...activityTrend(incidents),
    ...categoryTrends(incidents),
  ]

  // Deduplicate same-type same-related sets if any edge overlaps occur.
  const seen = new Set<string>()
  const deduped = alerts.filter((alert) => {
    const key = `${alert.type}|${alert.relatedIncidentIds.slice().sort().join(",")}|${JSON.stringify(alert.params ?? {})}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return deduped.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  )
}
