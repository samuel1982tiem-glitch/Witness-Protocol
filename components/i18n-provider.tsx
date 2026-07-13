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
  getInitialLanguage,
  getStoredLanguagePreference,
  setStoredLanguagePreference,
  translate,
  type LanguageCode,
  type LanguagePreference,
} from "@/lib/i18n"

interface I18nContextValue {
  /** The language currently in effect (never "system" — always resolved). */
  language: LanguageCode
  /** The raw preference as stored — "system" if following device language. */
  preference: LanguagePreference
  /** Change the language preference. Pass "system" to follow device language again. */
  setLanguage: (pref: LanguagePreference) => void
  /** Translate a dot-path key, e.g. t("vault.lockNow"). */
  t: (key: string, vars?: Record<string, string | number>) => string
}

const I18nContext = React.createContext<I18nContextValue | null>(null)

export function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within I18nProvider")
  return ctx
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Lazy init from localStorage so the very first render (including the
  // locked/unlock screen, before any vault interaction) already has the
  // right language — no flash of English-then-translated.
  const [language, setLanguageState] = React.useState<LanguageCode>(() =>
    getInitialLanguage(),
  )
  const [preference, setPreferenceState] = React.useState<LanguagePreference>(
    () => getStoredLanguagePreference(),
  )

  const setLanguage = React.useCallback((pref: LanguagePreference) => {
    setStoredLanguagePreference(pref)
    setPreferenceState(pref)
    setLanguageState(pref === "system" ? getInitialLanguage() : pref)
  }, [])

  const t = React.useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      translate(language, key, vars),
    [language],
  )

  const value: I18nContextValue = { language, preference, setLanguage, t }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
