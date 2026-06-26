"use client"

import { Mic, Square } from "lucide-react"
import * as React from "react"
import { Capacitor } from "@capacitor/core"
import VoiceRecorder from "@/plugins/voice-recorder"

export function VoiceRecorder({
  onRecorded,
}: {
  onRecorded: (blob: Blob) => void
}) {
  const [recording, setRecording] = React.useState(false)
  const [elapsed, setElapsed] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }

  React.useEffect(() => () => stopTimer(), [])

  async function start() {
    setError(null)

    try {
      if (Capacitor.getPlatform && Capacitor.getPlatform() === "android") {
        await VoiceRecorder.startRecording()
        setRecording(true)
        setElapsed(0)
        timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
      } else {
        setError("Voice recording is only supported in the Android app.")
      }
    } catch (err) {
      console.error(err)
      setError(String(err))
    }
  }

  async function stop() {
    stopTimer()
    setRecording(false)
    try {
      if (Capacitor.getPlatform && Capacitor.getPlatform() === "android") {
        const res = await VoiceRecorder.stopRecording()
        const nativePath = res?.path
        if (!nativePath) {
          setError("No recording was returned from native layer.")
          return
        }
        // convert native file path to a URL accessible by the WebView
        const src = (Capacitor as any).convertFileSrc(nativePath)
        // fetch and convert to blob to keep the existing onRecorded API
        const resp = await fetch(src)
        if (!resp.ok) {
          setError("Failed to retrieve recorded file from native layer.")
          return
        }
        const blob = await resp.blob()
        onRecorded(blob)
      } else {
        setError("Voice recording is only supported in the Android app.")
      }
    } catch (err) {
      console.error(err)
      setError(String(err))
    }
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0")
  const ss = String(elapsed % 60).padStart(2, "0")

  return (
    <div>
      <button
        type="button"
        onClick={recording ? stop : start}
        className={`flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
          recording
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-border bg-background text-foreground hover:bg-muted"
        }`}
      >
        {recording ? (
          <>
            <Square className="size-4" aria-hidden="true" />
            Stop recording · {mm}:{ss}
          </>
        ) : (
          <>
            <Mic className="size-4" aria-hidden="true" />
            Record voice note
          </>
        )}
      </button>
      {error ? (
        <p className="mt-1.5 text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  )
}
