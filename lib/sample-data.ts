import type { CategoryId, GeoLocation } from "./types"

export interface SampleIncident {
  title: string
  description: string
  category: CategoryId
  occurredAt: number
  location: GeoLocation | null
}

const HQ = { latitude: 40.7484, longitude: -73.9857, accuracy: 12 }
const HOME = { latitude: 40.7306, longitude: -73.9352, accuracy: 8 }

function daysAgo(days: number, hour: number, minute = 0): number {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, minute, 0, 0)
  return d.getTime()
}

/**
 * Deterministic-ish sample log designed to demonstrate every analysis type:
 * recurring 9am activity, a repeated location, a frequency spike, and
 * category clustering toward Surveillance.
 */
export function buildSampleIncidents(): SampleIncident[] {
  return [
    {
      title: "Unfamiliar vehicle parked outside",
      description:
        "A dark sedan was parked across the street again this morning. Same one as before.",
      category: "surveillance",
      occurredAt: daysAgo(14, 9, 5),
      location: HOME,
    },
    {
      title: "Same vehicle, same spot",
      description: "Vehicle returned to the identical position near the corner.",
      category: "surveillance",
      occurredAt: daysAgo(11, 9, 12),
      location: HOME,
    },
    {
      title: "Phone battery draining unusually fast",
      description:
        "Battery dropped 40% overnight with no apps running. Device felt warm.",
      category: "device-anomaly",
      occurredAt: daysAgo(10, 23, 40),
      location: null,
    },
    {
      title: "Followed on the commute",
      description:
        "Noticed the same person behind me across three separate streets.",
      category: "personal-tracking",
      occurredAt: daysAgo(9, 9, 0),
      location: HQ,
    },
    {
      title: "Conversation denied",
      description:
        "Was told a conversation never happened despite clear memory of it.",
      category: "gaslighting",
      occurredAt: daysAgo(7, 18, 20),
      location: null,
    },
    {
      title: "Observation at the office entrance",
      description: "Someone photographing the building entrance as I arrived.",
      category: "surveillance",
      occurredAt: daysAgo(3, 9, 8),
      location: HQ,
    },
    // Frequency spike — three incidents on the same recent day.
    {
      title: "Camera repositioned",
      description: "A street camera appears to have been re-aimed toward the door.",
      category: "surveillance",
      occurredAt: daysAgo(2, 9, 2),
      location: HOME,
    },
    {
      title: "Unknown device on network",
      description: "A device I do not recognize appeared on the home network.",
      category: "device-anomaly",
      occurredAt: daysAgo(2, 14, 15),
      location: HOME,
    },
    {
      title: "Repeated drive-by",
      description: "The dark sedan passed the house three times in an hour.",
      category: "surveillance",
      occurredAt: daysAgo(2, 20, 30),
      location: HOME,
    },
    {
      title: "Legal notice received",
      description: "Received a formal notice; archived the document reference.",
      category: "legal",
      occurredAt: daysAgo(1, 11, 0),
      location: null,
    },
  ]
}
