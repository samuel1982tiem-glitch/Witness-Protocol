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

import type { Category, CategoryId } from "./types"

// English reference strings. Never displayed directly once wired through
// categoryName()/categoryDescription() below — the actual displayed text
// always comes from the i18n dictionary. Kept here so CATEGORIES remains
// a valid Category[] for any code that reads .name/.description directly,
// and "Poisoning" internal id is unchanged even though its display name
// changed to "Poisoning and Threats".
export const CATEGORIES: Category[] = [
  {
    id: "surveillance",
    name: "Surveillance",
    description: "Observation, recording, or monitoring activity.",
  },
  {
    id: "personal-tracking",
    name: "Personal Tracking",
    description: "Following, location tracking, or movement monitoring.",
  },
  {
    id: "gaslighting",
    name: "Gaslighting",
    description: "Manipulation, denial, or distortion of events.",
  },
  {
    id: "device-anomaly",
    name: "Device Anomaly",
    description: "Unexpected device behavior or technical irregularities.",
  },
  {
    id: "poisoning",
    name: "Poisoning and Threats",
    description: "Suspected contamination of food, water, or environment.",
  },
  {
    id: "legal",
    name: "Legal",
    description: "Legal documents, notices, or proceedings.",
  },
]

export const CATEGORY_MAP: Record<CategoryId, Category> = CATEGORIES.reduce(
  (acc, c) => {
    acc[c.id] = c
    return acc
  },
  {} as Record<CategoryId, Category>,
)

const NAME_KEY: Record<CategoryId, string> = {
  surveillance: "categories.surveillanceName",
  "personal-tracking": "categories.personalTrackingName",
  gaslighting: "categories.gaslightingName",
  "device-anomaly": "categories.deviceAnomalyName",
  poisoning: "categories.poisoningName",
  legal: "categories.legalName",
}

const DESC_KEY: Record<CategoryId, string> = {
  surveillance: "categories.surveillanceDesc",
  "personal-tracking": "categories.personalTrackingDesc",
  gaslighting: "categories.gaslightingDesc",
  "device-anomaly": "categories.deviceAnomalyDesc",
  poisoning: "categories.poisoningDesc",
  legal: "categories.legalDesc",
}

/**
 * Translated display name for a category. Always call this instead of
 * reading Category.name directly — that field holds only the English
 * reference string.
 */
export function categoryName(
  id: CategoryId,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const key = NAME_KEY[id]
  return key ? t(key) : t("categories.unknown")
}

/**
 * Translated description for a category. Always call this instead of
 * reading Category.description directly.
 */
const CATEGORY_COLORS: Record<CategoryId, string> = {
  "surveillance": "#3b82f6",
  "personal-tracking": "#8b5cf6",
  "gaslighting": "#f59e0b",
  "device-anomaly": "#06b6d4",
  "poisoning": "#ef4444",
  "legal": "#64748b",
}

/** Marker/legend color for a category, used on the Heat Map. */
export function categoryColor(id: CategoryId): string {
  return CATEGORY_COLORS[id] ?? "#64748b"
}

export function categoryDescription(
  id: CategoryId,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const key = DESC_KEY[id]
  return key ? t(key) : ""
}
