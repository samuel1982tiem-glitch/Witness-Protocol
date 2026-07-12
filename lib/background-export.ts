// Thin, safe wrapper around the native BackgroundExport plugin (foreground
// service + progress notification). Every function is a no-op that never
// throws if the plugin isn't available (e.g. web preview) or any call
// fails -- a notification glitch should NEVER interrupt or fail an export
// that is otherwise working correctly.

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

/** Starts the foreground service + shows an initial progress notification. */
export async function startExportProgress(title: string, text: string): Promise<void> {
  if (!isNativeAndroid()) {
    alert("[WP-DEBUG] not native android, skipping notification")
    return
  }
  try {
    const plugin = await getPlugin()
    if (!plugin) {
      alert("[WP-DEBUG] BackgroundExport plugin failed to load (null)")
      return
    }
    const result = await plugin.start({ title, text, indeterminate: true })
    alert("[WP-DEBUG] start() result: " + JSON.stringify(result))
  } catch (err) {
    alert("[WP-DEBUG] start() threw: " + String(err))
  }
}

/** Updates the notification with a specific progress count. */
export async function updateExportProgress(
  title: string,
  text: string,
  current: number,
  total: number,
): Promise<void> {
  if (!isNativeAndroid()) return
  try {
    const plugin = await getPlugin()
    if (!plugin) return
    await plugin.update({
      title,
      text,
      progress: current,
      max: Math.max(total, 1),
      indeterminate: total <= 0,
    })
  } catch (err) {
    console.error("updateExportProgress failed (non-fatal):", err)
  }
}

/** Stops the foreground service and removes the notification. ALWAYS call this in a finally block. */
export async function stopExportProgress(): Promise<void> {
  if (!isNativeAndroid()) return
  try {
    const plugin = await getPlugin()
    if (!plugin) return
    await plugin.stop()
  } catch (err) {
    console.error("stopExportProgress failed (non-fatal):", err)
  }
}
