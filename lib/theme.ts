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

export type ThemePreference = "system" | "light" | "dark"

const STORAGE_KEY = "wp_theme_preference"

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system"
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === "light" || raw === "dark" || raw === "system") return raw
  return "system"
}

export function setStoredThemePreference(pref: ThemePreference): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, pref)
}

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function resolveTheme(pref: ThemePreference): "light" | "dark" {
  return pref === "system" ? (systemPrefersDark() ? "dark" : "light") : pref
}

export function applyTheme(resolved: "light" | "dark"): void {
  if (typeof document === "undefined") return
  document.documentElement.classList.toggle("dark", resolved === "dark")
}
