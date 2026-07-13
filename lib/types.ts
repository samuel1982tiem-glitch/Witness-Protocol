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

// Core domain types for Witness Protocol

export type CategoryId =
  | "surveillance"
  | "personal-tracking"
  | "gaslighting"
  | "device-anomaly"
  | "poisoning"
  | "legal"

export interface Category {
  id: CategoryId
  name: string
  description: string
}

export type EvidenceKind = "photo" | "screenshot" | "voice" | "document" | "video"

/** Decrypted, in-memory representation of an evidence file. */
export interface EvidenceMeta {
  id: string
  incidentId: string
  kind: EvidenceKind
  name: string
  mimeType: string
  size: number
  /** SHA-256 hex digest of the original (decrypted) file bytes. */
  sha256: string
  createdAt: number
}

/** Decrypted, in-memory representation of an incident. */
export interface Incident {
  id: string
  title: string
  description: string
  category: CategoryId
  /** When the incident occurred (epoch ms). */
  occurredAt: number
  /** When the record was created (epoch ms). */
  createdAt: number
  location: GeoLocation | null
  sealed: boolean
  seal: EvidenceSeal | null
  evidence: EvidenceMeta[]
}

export interface GeoLocation {
  latitude: number
  longitude: number
  accuracy: number | null
}

export interface EvidenceSeal {
  id: string
  incidentId: string
  /** SHA-256 hex digest over the canonical incident + evidence payload. */
  hash: string
  sealedAt: number
}

export type AlertType =
  | "repeated-time"
  | "repeated-location"
  | "frequency-spike"
  | "category-cluster"
  | "activity-trend"
  | "weekday-cluster"
  | "weekday-time-cluster"

export type AlertSeverity = "info" | "notable" | "high"

export interface PatternAlertData {
  hour?: number
  weekday?: number
  block?: "earlyMorning" | "morning" | "afternoon" | "evening" | "night"
  category?: CategoryId
  categoryName?: string
  categoryLabel?: string
  count?: number
  total?: number
  percentage?: number
  share?: number
  coordinates?: string
  cell?: string
  day?: string
  average?: number
  std?: number
  direction?: "increasing" | "decreasing" | "stable"
  perWeek?: number
  spanDays?: number
}

export interface PatternAlert {
  id: string
  type: AlertType
  severity: AlertSeverity
  title: string
  /** Neutral, observation-only description. No causal claims. */
  observation: string
  /** Supporting metric/correlation detail. */
  detail: string
  /** Incident ids that contributed to this observation. */
  relatedIncidentIds: string[]
  createdAt: number
  /** Structured payload for translated rendering on the Patterns page. */
  data?: PatternAlertData
}

export type VaultStatus =
  | "loading"
  | "uninitialized"
  | "locked"
  | "unlocked"

export interface IncidentFilters {
  query: string
  category: CategoryId | "all"
  fromDate: string // yyyy-mm-dd
  toDate: string // yyyy-mm-dd
  hasLocation: boolean
  sealed: "all" | "sealed" | "unsealed"
}
