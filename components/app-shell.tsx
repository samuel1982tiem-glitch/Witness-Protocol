"use client"

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

import {
  Activity,
  Lock,
  Mic,
  Plus,
  ScrollText,
  ShieldCheck,
  Square,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"

import { InstallPrompt } from "@/components/install-prompt"
import { useVault } from "@/components/vault-provider"
import { useDiaryRecording } from "@/components/diary-recording-provider"
import { useExportProgress } from "@/components/export-progress-provider"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"


function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { lock } = useVault()
  const { t } = useI18n()
  const { isRecording, elapsed, error, toggleRecording, clearError } = useDiaryRecording()
  const { active: exportActive } = useExportProgress()
  const NAV = [
    { href: "/incidents", label: t("nav.records"), icon: ScrollText },
    { href: "/patterns", label: t("nav.patterns"), icon: Activity },
    { href: "/vault", label: t("nav.vault"), icon: ShieldCheck },
  ] as const

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-5 py-3.5 backdrop-blur">
        <Link href="/incidents" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-4.5" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Witness Protocol
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {exportActive ? (
            <span
              className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"
              title={exportActive.text}
            >
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              {exportActive.total > 0
                ? `${exportActive.current}/${exportActive.total}`
                : "…"}
            </span>
          ) : null}
          <button
            type="button"
            onClick={lock}
            className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-border"
          >
            <Lock className="size-3.5" aria-hidden="true" />
            Lock
          </button>
        </div>
      </header>

      <main className="flex-1 px-5 pb-28 pt-5">
        <InstallPrompt />
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t border-border bg-background/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="flex items-stretch justify-around">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </Link>
            )
          })}
          <Link
            href="/log"
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium text-red-600 transition-colors hover:text-red-700"
          >
            <Plus className="size-5" aria-hidden="true" />
            {t("nav.newIncident")}
          </Link>
          <button
            type="button"
            onClick={() => toggleRecording()}
            aria-label={isRecording ? t("miscUi.stopRecording") : t("nav.diary")}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium text-red-600 transition-colors hover:text-red-700"
          >
            <span
              className={`flex size-8 items-center justify-center rounded-full border-2 border-red-600 ${
                isRecording ? "bg-red-600 text-white animate-pulse" : "bg-transparent text-red-600"
              }`}
            >
              {isRecording ? (
                <Square className="size-3.5" aria-hidden="true" />
              ) : (
                <Mic className="size-4" aria-hidden="true" />
              )}
            </span>
            {isRecording
              ? `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`
              : t("nav.diary")}
          </button>
        </div>
        {error ? (
          <p className="px-4 pb-2 text-center text-xs text-destructive" onClick={clearError}>
            {error}
          </p>
        ) : null}
      </nav>
    </div>
  )
}
