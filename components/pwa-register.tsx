"use client"

import * as React from "react"

/** Registers the service worker for offline support. */
export function PwaRegister() {
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.log("[v0] sw register failed:", (err as Error).message)
      })
    }
    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })
  }, [])

  return null
}
