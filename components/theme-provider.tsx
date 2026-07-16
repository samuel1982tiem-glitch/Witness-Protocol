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
import {
  applyTheme,
  getStoredThemePreference,
  resolveTheme,
  setStoredThemePreference,
  systemPrefersDark,
  type ThemePreference,
} from "@/lib/theme"

interface ThemeContextValue {
  preference: ThemePreference
  resolved: "light" | "dark"
  setTheme: (pref: ThemePreference) => void
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = React.useState<ThemePreference>(() =>
    getStoredThemePreference(),
  )
  const [resolved, setResolved] = React.useState<"light" | "dark">(() =>
    resolveTheme(getStoredThemePreference()),
  )

  React.useEffect(() => {
    const r = resolveTheme(preference)
    setResolved(r)
    applyTheme(r)
  }, [preference])

  // Follow OS changes live while preference === "system".
  React.useEffect(() => {
    if (preference !== "system" || typeof window === "undefined" || !window.matchMedia) return
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      const r = systemPrefersDark() ? "dark" : "light"
      setResolved(r)
      applyTheme(r)
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [preference])

  const setTheme = React.useCallback((pref: ThemePreference) => {
    setStoredThemePreference(pref)
    setPreferenceState(pref)
  }, [])

  const value: ThemeContextValue = { preference, resolved, setTheme }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
