"use client"

import { IncidentForm } from "@/components/incident-form"
import { SectionTitle } from "@/components/ui/primitives"

export default function LogIncidentPage() {
  return (
    <div className="space-y-6">
      <SectionTitle
        title="Log incident"
        description="Document an event. All fields stay on this device and are encrypted before storage."
      />
      <IncidentForm />
    </div>
  )
}
