"use client"

import { IncidentForm } from "@/components/incident-form"
import { SectionTitle } from "@/components/ui/primitives"
import { useI18n } from "@/components/i18n-provider"

export default function LogIncidentPage() {
  const { t } = useI18n()
  return (
    <div className="space-y-6">
      <SectionTitle
        title={t("miscUi.logIncidentTitle")}
        description={t("miscUi.logIncidentDescription")}
      />
      <IncidentForm />
    </div>
  )
}
