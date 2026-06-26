"use client"

import { Download, X } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPrompt() {
  const [deferred, setDeferred] =
    React.useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = React.useState(false)

  React.useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  if (!deferred || dismissed) return null

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Download className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">Install the app</p>
        <p className="text-xs text-muted-foreground">
          Add Witness Protocol to your home screen for offline access.
        </p>
      </div>
      <Button size="sm" onClick={install}>
        Install
      </Button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Dismiss install prompt"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
