"use client"

import * as React from "react"
import { Capacitor } from "@capacitor/core"
import VoiceRecorderPlugin from "@/plugins/voice-recorder"
import { useVault } from "@/components/vault-provider"

interface DiaryRecordingContextValue {
  isRecording: boolean
  elapsed: number
  error: string | null
  toggleRecording: () => Promise<void>
  clearError: () => void
}

const DiaryRecordingContext = React.createContext<DiaryRecordingContextValue | null>(null)

export function useDiaryRecording(): DiaryRecordingContextValue {
  const ctx = React.useContext(DiaryRecordingContext)
  if (!ctx) throw new Error("useDiaryRecording must be used within DiaryRecordingProvider")
  return ctx
}

export function DiaryRecordingProvider({ children }: { children: React.ReactNode }) {
  const { addDiaryEntry } = useVault()
  const [isRecording, setIsRecording] = React.useState(false)
  const [elapsed, setElapsed] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
  }

  React.useEffect(() => () => stopTimer(), [])

  const clearError = React.useCallback(() => setError(null), [])

  const start = React.useCallback(async () => {
    setError(null)
    if (!(Capacitor.getPlatform && Capacitor.getPlatform() === "android")) {
      setError("Voice recording is only supported in the Android app.")
      return
    }
    try {
      await VoiceRecorderPlugin.startRecording()
      setIsRecording(true)
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } catch (err) {
      // Native layer rejects with "Already recording" if another recording
      // (e.g. an incident voice note) is in progress. Surface it plainly.
      setError(String(err))
    }
  }, [])

  const stop = React.useCallback(async () => {
    stopTimer()
    setIsRecording(false)
    try {
      const res = await VoiceRecorderPlugin.stopRecording()
      const nativePath = res?.path
      if (!nativePath) {
        setError("No recording was returned from native layer.")
        return
      }
      const src = (Capacitor as any).convertFileSrc(nativePath)
      const resp = await fetch(src)
      if (!resp.ok) {
        setError("Failed to retrieve recorded file from native layer.")
        return
      }
      const blob = await resp.blob()
      await addDiaryEntry(blob)
    } catch (err) {
      setError(String(err))
    }
  }, [addDiaryEntry])

  const toggleRecording = React.useCallback(async () => {
    if (isRecording) {
      await stop()
    } else {
      await start()
    }
  }, [isRecording, start, stop])

  const value: DiaryRecordingContextValue = {
    isRecording,
    elapsed,
    error,
    toggleRecording,
    clearError,
  }

  return (
    <DiaryRecordingContext.Provider value={value}>
      {children}
    </DiaryRecordingContext.Provider>
  )
}
