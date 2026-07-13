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

import type { LanguageCode } from "./types"

export interface LanguageMeta {
  code: LanguageCode
  nativeName: string
  englishName: string
}

/** Metadata for the language picker UI. Order here is display order. */
export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { code: "en", nativeName: "English", englishName: "English" },
  { code: "pt-BR", nativeName: "Português (Brasil)", englishName: "Portuguese (Brazil)" },
  { code: "es", nativeName: "Español", englishName: "Spanish" },
]

const DEFAULT_LANGUAGE: LanguageCode = "en"

/**
 * Normalize a raw device/browser locale string (e.g. from
 * navigator.language) down to one of our supported LanguageCode values.
 *
 * Examples:
 *   en, en-US, en-GB          -> en
 *   pt, pt-BR, pt_BR          -> pt-BR
 *   es, es-AR, es-MX, es-ES   -> es
 *   fr, de, ja, anything else -> en (fallback)
 */
export function normalizeLanguage(raw: string | null | undefined): LanguageCode {
  if (!raw) return DEFAULT_LANGUAGE

  // Normalize separators and case: "pt_BR" -> "pt-br", "EN-US" -> "en-us"
  const lower = raw.trim().toLowerCase().replace(/_/g, "-")
  const primary = lower.split("-")[0]

  if (primary === "pt") return "pt-BR"
  if (primary === "es") return "es"
  if (primary === "en") return "en"

  return DEFAULT_LANGUAGE
}

export function isSupportedLanguageCode(value: string): value is LanguageCode {
  return SUPPORTED_LANGUAGES.some((l) => l.code === value)
}
