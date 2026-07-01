"use client"

import {
  Camera,
  Crosshair,
  FileText,
  ImageIcon,
  Loader2,
  Mic,
  Trash2,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  Input,
  Label,
  Textarea,
} from "@/components/ui/primitives"
import { useVault } from "@/components/vault-provider"
import { VoiceRecorder } from "@/components/voice-recorder"
import { CATEGORIES } from "@/lib/categories"
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/format"
import { formatBytes, processMedia } from "@/lib/media"
import type { CategoryId, EvidenceKind, GeoLocation } from "@/lib/types"

interface PendingAttachment {
  id: string
  kind: EvidenceKind
  name: string
  blob: Blob
  url: string
}

function pid() {
  return Math.random().toString(36).slice(2)
}

export function IncidentForm() {
  const router = useRouter()
  const { addIncident } = useVault()

  const [category, setCategory] = React.useState<CategoryId | null>(null)
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [occurredAt, setOccurredAt] = React.useState(() =>
    toDateTimeLocal(Date.now()),
  )
  const [location, setLocation] = React.useState<GeoLocation | null>(null)
  const [geoStatus, setGeoStatus] = React.useState<string | null>(null)
  const [attachments, setAttachments] = React.useState<PendingAttachment[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const photoInput = React.useRef<HTMLInputElement>(null)
  const shotInput = React.useRef<HTMLInputElement>(null)
  const audioInput = React.useRef<HTMLInputElement>(null)
  const docInput = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    return () => {
      attachments.forEach((a) => URL.revokeObjectURL(a.url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-fill GPS coordinates on mount if permission has already been
  // granted. Uses the Permissions API to check first so we never trigger
  // an unexpected browser permission prompt — that stays an explicit
  // action via the Capture button.
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return
    if (!navigator.permissions?.query) return

    let cancelled = false
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (cancelled) return
        if (status.state === "granted") {
          captureLocation()
        }
      })
      .catch(() => {
        // Permissions API not supported for geolocation on this device —
        // silently skip auto-fill, user can still tap Capture manually.
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function addFiles(files: FileList | null, kind: EvidenceKind) {
    if (!files) return
    const next: PendingAttachment[] = []
    Array.from(files).forEach((file) => {
      next.push({
        id: pid(),
        kind,
        name: file.name || `${kind}-${Date.now()}`,
        blob: file,
        url: URL.createObjectURL(file),
      })
    })
    setAttachments((prev) => [...prev, ...next])
  }

  function addVoice(blob: Blob) {
    setAttachments((prev) => [
      ...prev,
      {
        id: pid(),
        kind: "voice",
        name: `voice-note-${prev.filter((a) => a.kind === "voice").length + 1}.webm`,
        blob,
        url: URL.createObjectURL(blob),
      },
    ])
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((a) => a.id !== id)
    })
  }

  function captureLocation() {
    setGeoStatus("Locating…")
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("Geolocation is not available on this device.")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        })
        setGeoStatus(null)
      },
      () => setGeoStatus("Location permission denied or unavailable."),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  function openInMaps() {
    if (!location) return
    const url = `https://maps.google.com/?q=${location.latitude},${location.longitude}`
    window.open(url, "_blank")
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!category) {
      setError("Select a category.")
      return
    }
    if (!title.trim()) {
      setError("Enter a title.")
      return
    }
    setSubmitting(true)
    try {
      const evidence = await Promise.all(
        attachments.map(async (a) => {
          const isImage = a.kind === "photo" || a.kind === "screenshot"
          const processed = await processMedia(a.blob, isImage)
          return {
            kind: a.kind,
            name: a.name,
            mimeType: processed.mimeType,
            size: processed.size,
            sha256: processed.sha256,
            bytes: processed.bytes,
          }
        }),
      )
      await addIncident(
        {
          title: title.trim(),
          description: description.trim(),
          category,
          occurredAt: fromDateTimeLocal(occurredAt),
          location,
        },
        evidence,
      )
      router.replace("/incidents")
    } catch (err) {
      setError((err as Error).message || "Could not save the incident.")
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <Label>Category</Label>
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                category === c.id
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              <span
                className={`block text-sm font-medium ${
                  category === c.id ? "text-primary" : "text-foreground"
                }`}
              >
                {c.name}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                {c.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short summary of the incident"
          maxLength={120}
        />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What happened? Include details while they are fresh."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="occurredAt">Date and time</Label>
          <Input
            id="occurredAt"
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </div>

        <div>
          <Label>GPS coordinates</Label>
          <Card className="flex h-full flex-col justify-between gap-2 p-3">
            {location ? (
              <button
                type="button"
                onClick={openInMaps}
                className="min-w-0 flex-1 text-left text-sm"
                aria-label="Open location in maps"
              >
                <p className="truncate font-medium text-primary underline-offset-2 hover:underline">
                  {location.latitude.toFixed(5)},{" "}
                  {location.longitude.toFixed(5)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Accuracy ±{Math.round(location.accuracy ?? 0)}m
                </p>
              </button>
            ) : (
              <p className="flex-1 text-sm text-muted-foreground">
                {geoStatus ?? "No location attached."}
              </p>
            )}
            <div className="flex items-center justify-end gap-2">
              {location ? (
                <button
                  type="button"
                  onClick={() => setLocation(null)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  aria-label="Remove location"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={captureLocation}
              >
                <Crosshair className="size-4" aria-hidden="true" />
                Capture
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Evidence attachments</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => photoInput.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium hover:bg-muted"
          >
            <Camera className="size-4" aria-hidden="true" />
            Photo
          </button>
          <button
            type="button"
            onClick={() => shotInput.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium hover:bg-muted"
          >
            <ImageIcon className="size-4" aria-hidden="true" />
            Screenshot
          </button>
        </div>
        <VoiceRecorder onRecorded={addVoice} />
        <button
          type="button"
          onClick={() => audioInput.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium hover:bg-muted"
        >
          <Mic className="size-4" aria-hidden="true" />
          Upload audio file
        </button>
        <button
          type="button"
          onClick={() => docInput.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium hover:bg-muted"
        >
          <FileText className="size-4" aria-hidden="true" />
          Upload document
        </button>

        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files, "photo")
            e.target.value = ""
          }}
        />
        <input
          ref={shotInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files, "screenshot")
            e.target.value = ""
          }}
        />
        <input
          ref={audioInput}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files, "voice")
            e.target.value = ""
          }}
        />
        <input
          ref={docInput}
          type="file"
          accept=".pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files, "document")
            e.target.value = ""
          }}
        />

        {attachments.length > 0 ? (
          <ul className="space-y-2">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5"
              >
                {a.kind === "voice" ? (
                  <audio
                    controls
                    src={a.url}
                    className="h-9 min-w-0 flex-1"
                  />
                ) : a.kind === "document" ? (
                  <>
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FileText className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {a.kind} · {formatBytes(a.blob.size)}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <img
                      src={a.url || "/placeholder.svg"}
                      alt={a.name}
                      className="size-12 shrink-0 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {a.kind} · {formatBytes(a.blob.size)}
                      </p>
                    </div>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  aria-label="Remove attachment"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Images are stripped of EXIF metadata, hashed with SHA-256, and
            encrypted before storage.
          </p>
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" size="lg" className="flex-1" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Encrypting…
            </>
          ) : (
            "Save incident"
          )}
        </Button>
      </div>
    </form>
  )
}
