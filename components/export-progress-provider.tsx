"use client"

import * as React from "react"
import { startExportProgress, updateExportProgress, stopExportProgress } from "@/lib/background-export"

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
  const [active, setActive] = React.useState<ExportProgressContextValue["active"]>(null)

  const begin = React.useCallback(async (title: string, text: string) => {
    setActive({ title, text, current: 0, total: 0 })
    await startExportProgress(title, text)
  }, [])

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
  }, [])

  const value: ExportProgressContextValue = { active, begin, progress, end }

  return (
    <ExportProgressContext.Provider value={value}>
      {children}
    </ExportProgressContext.Provider>
  )
}
