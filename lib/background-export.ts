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
