import { en } from "./en"
import { ptBR } from "./pt-BR"
import { es } from "./es"
import { normalizeLanguage } from "./languages"
import type { Dictionary, LanguageCode, LanguagePreference } from "./types"

export type { LanguageCode, LanguagePreference, Dictionary } from "./types"
export { SUPPORTED_LANGUAGES, normalizeLanguage, isSupportedLanguageCode } from "./languages"

const DICTIONARIES: Record<LanguageCode, Dictionary> = {
  en,
  "pt-BR": ptBR,
  es,
}

// Plain, unencrypted localStorage — deliberately NOT part of the vault's
// encrypted profile. Language preference must be readable before the
// vault is unlocked (so the lock/unlock screen itself renders in the
// right language), and it isn't sensitive data.
const STORAGE_KEY = "witness-protocol:language"

/**
 * Reads the device/browser's reported language and normalizes it to one
 * of our supported codes. Returns "en" if no locale info is available
 * (e.g. server-side render, or an environment without navigator).
 */
export function getDeviceLanguage(): LanguageCode {
  if (typeof navigator === "undefined") return "en"
  return normalizeLanguage(navigator.language)
}

/** Reads the raw stored preference ("system" | LanguageCode), or null if never set. */
function readStoredPreference(): LanguagePreference | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === "system" || raw === "en" || raw === "pt-BR" || raw === "es") {
      return raw
    }
    return null
  } catch {
    // localStorage can throw in some restricted/private-browsing contexts
    return null
  }
}

/**
 * Resolves the effective LanguageCode to use right now, given:
 *   1. an explicit manual override, if the user selected one
 *   2. otherwise, the device's language
 *   3. otherwise, English
 */
export function getInitialLanguage(): LanguageCode {
  const stored = readStoredPreference()
  if (stored && stored !== "system") return stored
  return getDeviceLanguage()
}

/** Persist the user's language preference. Pass "system" to clear the override. */
export function setStoredLanguagePreference(pref: LanguagePreference): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    // ignore — worst case, preference doesn't persist this session
  }
}

/** The raw preference as stored ("system" if no override was ever set). */
export function getStoredLanguagePreference(): LanguagePreference {
  return readStoredPreference() ?? "system"
}

/**
 * Look up a nested key like "vault.lockNow" in a dictionary.
 * Returns undefined if any segment of the path is missing.
 */
function lookup(dict: Dictionary, path: string): string | undefined {
  const segments = path.split(".")
  let node: any = dict
  for (const seg of segments) {
    if (node == null || typeof node !== "object") return undefined
    node = node[seg]
  }
  return typeof node === "string" ? node : undefined
}

/**
 * Replace {placeholder} tokens in a translated string with values from
 * `vars`. Supports a simple {plural} convention: pass plural as "" for
 * singular (count === 1) or "s"/language-appropriate suffix otherwise —
 * callers decide the exact suffix per call since pluralization rules
 * differ by language (e.g. Portuguese pluralizes adjectives too).
 */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key]
    return value !== undefined ? String(value) : match
  })
}

/**
 * Translate a dot-path key (e.g. "vault.lockNow") for the given language.
 * Falls back to English if the key is missing in the target language,
 * and falls back to the key itself (visibly, so it's easy to spot in
 * testing) if it's missing from English too.
 */
export function translate(
  language: LanguageCode,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const dict = DICTIONARIES[language] ?? DICTIONARIES.en
  const value = lookup(dict, key) ?? lookup(DICTIONARIES.en, key) ?? key
  return interpolate(value, vars)
}
