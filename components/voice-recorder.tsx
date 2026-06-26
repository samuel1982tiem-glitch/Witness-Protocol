"use client"

import { Mic, Square } from "lucide-react"
import * as React from "react"

export function VoiceRecorder({
  onRecorded,
}: {
  onRecorded: (blob: Blob) => void
}) {
  const [recording, setRecording] = React.useState(false)
  const [elapsed, setElapsed] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const chunksRef = React.useRef<Blob[]>([])
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }

  React.useEffect(() => () => stopTimer(), [])

  async function start() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        })
        onRecorded(blob)
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } catch {
      setError("Microphone access was denied or is unavailable.")
    }
  }

  function stop() {
    recorderRef.current?.stop()
    setRecording(false)
    stopTimer()
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
