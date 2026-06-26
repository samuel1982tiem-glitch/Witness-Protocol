import type { Category, CategoryId } from "./types"

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
    name: "Poisoning",
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

export function categoryName(id: CategoryId): string {
  return CATEGORY_MAP[id]?.name ?? "Unknown"
}
