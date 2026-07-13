// Thin, safe wrapper around the native BackgroundExport plugin (foreground
// service + progress notification). Every function is a no-op that never
// throws AND NEVER HANGS if the plugin isn't available or misbehaves --
// a notification glitch (including the native permission-request bridge
// call never resolving) must never block or delay the actual export work.

import { Capacitor } from "@capacitor/core"

let pluginPromise: Promise<any> | null = null

function getPlugin(): Promise<any> {
  if (!pluginPromise) {
    pluginPromise = import("background-export")
      .then((mod) => mod.BackgroundExport)
      .catch(() => null)
  }
  return pluginPromise
}

function isNativeAndroid(): boolean {
  try {
    return Capacitor.getPlatform() === "android"
  } catch {
    return false
  }
}

/**
 * Runs a promise-returning function but gives up after `ms` if it never
 * settles, so a hung native bridge call (e.g. a stuck permission-request
 * callback) can never block the caller indefinitely.
 */
function withTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    let done = false
    const timer = setTimeout(() => {
      if (!done) {
        done = true
        resolve(null)
      }
    }, ms)
    fn()
      .then((v) => {
        if (!done) {
          done = true
          clearTimeout(timer)
          resolve(v)
        }
      })
      .catch(() => {
        if (!done) {
          done = true
          clearTimeout(timer)
          resolve(null)
        }
      })
  })
}

const NATIVE_CALL_TIMEOUT_MS = 3000

export async function startExportProgress(title: string, text: string): Promise<void> {
  // TEMP DIAGNOSTIC -- fires synchronously, cannot hang, proves this
  // function was even called at all.
  alert("[WP-DEBUG] startExportProgress CALLED, isNativeAndroid=" + isNativeAndroid())
  if (!isNativeAndroid()) return
  try {
    const plugin = await getPlugin()
    if (!plugin) {
      alert("[WP-DEBUG] plugin is null (failed to import)")
      return
    }
    const r = await plugin.start({ title, text, indeterminate: true })
    alert("[WP-DEBUG] start() resolved: " + JSON.stringify(r))
  } catch (err) {
    alert("[WP-DEBUG] start() rejected: " + String(err))
  }
}

export async function updateExportProgress(
  title: string,
  text: string,
  current: number,
  total: number,
): Promise<void> {
  if (!isNativeAndroid()) return
  await withTimeout(async () => {
    const plugin = await getPlugin()
    if (!plugin) return null
    return plugin.update({
      title,
      text,
      progress: current,
      max: Math.max(total, 1),
      indeterminate: total <= 0,
    })
  }, NATIVE_CALL_TIMEOUT_MS)
}

export async function stopExportProgress(): Promise<void> {
  if (!isNativeAndroid()) return
  await withTimeout(async () => {
    const plugin = await getPlugin()
    if (!plugin) return null
    return plugin.stop()
  }, NATIVE_CALL_TIMEOUT_MS)
}
