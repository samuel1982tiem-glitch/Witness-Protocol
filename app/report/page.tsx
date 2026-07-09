"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

import { ReportGenerator } from "@/components/ReportGenerator"
import { useI18n } from "@/components/i18n-provider"

export default function ReportPage() {
  const router = useRouter()
  const { t } = useI18n()

  return (
    <div className="space-y-5">
      <Link
        href="/incidents/"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("common.back")}
      </Link>

      <ReportGenerator onClose={() => router.push("/incidents/")} />
    </div>
  )
}
