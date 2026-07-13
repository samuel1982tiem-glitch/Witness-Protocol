// Thin, safe wrapper around the native BackgroundExport plugin (foreground
// service + progress notification). Every function is a no-op that never
// throws if the plugin isn't available or misbehaves -- a notification
// glitch must never block or delay the actual export work.
//
// IMPORTANT: statically imported (not dynamic import()). A dynamic
// import("background-export") was hanging forever and never resolving --
// likely because this is a static-exported Next.js app running in a
// Capacitor WebView with no real HTTP server, and dynamic import()'s
// runtime chunk-fetch can silently fail/hang under file://-style
// protocols. Official Capacitor plugins elsewhere in this app are
// dynamically imported successfully, but this hand-built local package
// apparently bundles differently. A static import avoids the issue
// entirely by resolving everything at build time instead of runtime.

import { Capacitor } from "@capacitor/core"
import { BackgroundExport } from "background-export"

function isNativeAndroid(): boolean {
  try {
    return Capacitor.getPlatform() === "android"
  } catch {
    return false
  }
}

export async function startExportProgress(title: string, text: string): Promise<void> {
  if (!isNativeAndroid()) return
  try {
    await BackgroundExport.start({ title, text, indeterminate: true })
  } catch (err) {
    console.error("startExportProgress failed (non-fatal):", err)
  }
}

export async function updateExportProgress(
  title: string,
  text: string,
  current: number,
  total: number,
): Promise<void> {
  if (!isNativeAndroid()) return
  try {
    await BackgroundExport.update({
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

export async function stopExportProgress(): Promise<void> {
  if (!isNativeAndroid()) return
  try {
    await BackgroundExport.stop()
  } catch (err) {
    console.error("stopExportProgress failed (non-fatal):", err)
  }
}
