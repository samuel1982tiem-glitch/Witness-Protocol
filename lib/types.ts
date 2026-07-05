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
  | "repeated-time-block"
  | "repeated-weekday"
  | "repeated-location"
  | "frequency-spike"
  | "rolling-spike"
  | "category-cluster"
  | "category-time-cluster"
  | "category-location-cluster"
  | "activity-trend"
  | "category-trend"

export type AlertSeverity = "info" | "notable" | "high"

export interface PatternAlert {
  id: string
  type: AlertType
  severity: AlertSeverity
  /** i18n key for the alert title */
  titleKey: string
  /** i18n key for the neutral observation text */
  observationKey: string
  /** i18n key for supporting detail / metric line */
  detailKey: string
  /** Optional interpolation params for translated strings */
  params?: Record<string, string | number>
  /** Incident ids that contributed to this observation. */
  relatedIncidentIds: string[]
  createdAt: number
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
