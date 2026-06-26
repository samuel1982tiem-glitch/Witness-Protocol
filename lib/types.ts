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

export type EvidenceKind = "photo" | "screenshot" | "voice"

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

export type AlertSeverity = "info" | "notable" | "high"

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
