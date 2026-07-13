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

import * as React from "react"
import { startExportProgress, updateExportProgress, stopExportProgress } from "@/lib/background-export"
import { useVault } from "@/components/vault-provider"

interface ExportProgressContextValue {
  /** Non-null while any export is running -- survives navigation since this is app-wide state. */
  active: { title: string; text: string; current: number; total: number } | null
  /** Starts tracking a new export. Also starts the native notification. */
  begin: (title: string, text: string) => Promise<void>
  /** Updates progress for the currently active export. */
  progress: (title: string, text: string, current: number, total: number) => void
  /** Ends tracking. Also stops the native notification. Always call in a finally block. */
  end: () => Promise<void>
}

const ExportProgressContext = React.createContext<ExportProgressContextValue | null>(null)

export function useExportProgress(): ExportProgressContextValue {
  const ctx = React.useContext(ExportProgressContext)
  if (!ctx) throw new Error("useExportProgress must be used within ExportProgressProvider")
  return ctx
}

export function ExportProgressProvider({ children }: { children: React.ReactNode }) {
  const { suspendAutoLock, resumeAutoLock } = useVault()
  const [active, setActive] = React.useState<ExportProgressContextValue["active"]>(null)

  const begin = React.useCallback(async (title: string, text: string) => {
    // Suspend the vault's inactivity auto-lock for the duration of the
    // export -- otherwise a long export that outlives the auto-lock
    // timeout while backgrounded would have its decrypt calls start
    // failing partway through once the vault key clears.
    suspendAutoLock()
    setActive({ title, text, current: 0, total: 0 })
    await startExportProgress(title, text)
  }, [suspendAutoLock])

  const progress = React.useCallback(
    (title: string, text: string, current: number, total: number) => {
      setActive({ title, text, current, total })
      void updateExportProgress(title, text, current, total)
    },
    [],
  )

  const end = React.useCallback(async () => {
    setActive(null)
    await stopExportProgress()
    resumeAutoLock()
  }, [resumeAutoLock])

  const value: ExportProgressContextValue = { active, begin, progress, end }

  return (
    <ExportProgressContext.Provider value={value}>
      {children}
    </ExportProgressContext.Provider>
  )
}
