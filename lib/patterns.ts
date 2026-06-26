// Local pattern analysis engine.
//
// Operates ONLY on the user's own decrypted records, entirely in-browser.
// Uses deterministic statistical methods (counting, bucketing, linear trend
// estimation). It surfaces observations and correlations only — it never makes
// claims about causes, perpetrators, or external intent.

import { categoryName } from "./categories"
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
        observation: `${list.length} of your logged incidents occurred near the ${timeBucketLabel(
          hour,
        )} hour. This is a timing correlation only.`,
        detail: `${share}% of all incidents fall in this hour window.`,
        relatedIncidentIds: list.map((i) => i.id),
        createdAt: Date.now(),
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
        observation: `${list.length} incidents share approximately the same coordinates (${key}). This is a spatial correlation only.`,
        detail: `Coordinates rounded to ~110m precision.`,
        relatedIncidentIds: list.map((i) => i.id),
        createdAt: Date.now(),
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
        observation: `On ${day}, you logged ${list.length} incidents — above your typical daily activity. This is a frequency observation only.`,
        detail: `Daily average is ${mean.toFixed(1)} (±${std.toFixed(1)}).`,
        relatedIncidentIds: list.map((i) => i.id),
        createdAt: Date.now(),
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
        title: `Clustering in ${categoryName(category)}`,
        observation: `${Math.round(
          share * 100,
        )}% of your incidents are categorized as ${categoryName(
          category,
        )}. This is a categorical correlation only.`,
        detail: `${list.length} of ${incidents.length} total incidents.`,
        relatedIncidentIds: list.map((i) => i.id),
        createdAt: Date.now(),
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

  // Bucket counts per day index, then fit y = a + b*x.
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
        observation:
          "Your logging frequency has remained roughly steady over the recorded period. This is a trend observation only.",
        detail: `Change of ${perWeek.toFixed(2)} incidents/week.`,
        relatedIncidentIds: [],
        createdAt: Date.now(),
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
      observation: `Your logging frequency appears to be ${direction} over time. This is a trend observation only.`,
      detail: `Estimated change of ${Math.abs(perWeek).toFixed(
        1,
      )} incidents/week across ${Math.round(spanDays)} days.`,
      relatedIncidentIds: [],
      createdAt: Date.now(),
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
    ...repeatedLocations(incidents),
    ...categoryClustering(incidents),
    ...activityTrend(incidents),
  ]
  return alerts.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  )
}
