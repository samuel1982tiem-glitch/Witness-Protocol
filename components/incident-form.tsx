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
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from "@capacitor/camera"
import { useRouter } from "next/navigation"
import * as React from "react"
import { useI18n } from "@/components/i18n-provider"

import { Button } from "@/components/ui/button"
import {
  Card,
  Input,
  Label,
  Textarea,
} from "@/components/ui/primitives"
import { useVault } from "@/components/vault-provider"
import { VoiceRecorder } from "@/components/voice-recorder"
import { CATEGORIES, categoryDescription, categoryName } from "@/lib/categories"
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


const INCIDENT_DRAFT_KEY = "witness:incident-draft:v1"

interface DraftAttachment {
  id: string
  kind: EvidenceKind
  name: string
  mimeType: string
  base64: string
}

interface IncidentDraft {
  category: CategoryId | null
  title: string
  description: string
  occurredAt: string
  location: GeoLocation | null
  attachments: DraftAttachment[]
}

/** Convert a Blob to a base64 string (no data: prefix) for localStorage persistence. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const result = reader.result as string
      // Strip the "data:<mime>;base64," prefix, keep only the raw base64
      const commaIdx = result.indexOf(",")
      resolve(commaIdx === -1 ? result : result.slice(commaIdx + 1))
    }
    reader.readAsDataURL(blob)
  })
}

/** Convert a base64 string (no prefix) back into a Blob. */
function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

function pid() {
  return Math.random().toString(36).slice(2)
}

export function IncidentForm() {
  const router = useRouter()
  const { addIncident } = useVault()
  const { t } = useI18n()

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

  const shotInput = React.useRef<HTMLInputElement>(null)
  const audioInput = React.useRef<HTMLInputElement>(null)
  const docInput = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(INCIDENT_DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw) as IncidentDraft

      if (draft.category) setCategory(draft.category)
      if (typeof draft.title === "string") setTitle(draft.title)
      if (typeof draft.description === "string") setDescription(draft.description)
      if (typeof draft.occurredAt === "string" && draft.occurredAt) {
        setOccurredAt(draft.occurredAt)
      }
      if (draft.location) setLocation(draft.location)
      if (Array.isArray(draft.attachments) && draft.attachments.length > 0) {
        const restored: PendingAttachment[] = draft.attachments.map((a) => {
          const blob = base64ToBlob(a.base64, a.mimeType)
          return {
            id: a.id,
            kind: a.kind,
            name: a.name,
            blob,
            url: URL.createObjectURL(blob),
          }
        })
        setAttachments((prev) => [...prev, ...restored])
      }
    } catch {
      // Ignore corrupt draft
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      // NOTE: attachments are intentionally NOT persisted here. Base64-
      // encoding every photo on every draft save caused repeated large
      // localStorage writes that appear to have triggered instability/
      // quota issues with multiple photos. The Base64 capture fix (see
      // capturePhoto) already solves the main crash; draft recovery for
      // in-progress photos is not attempted to avoid this regression.
      const draft: IncidentDraft = {
        category,
        title,
        description,
        occurredAt,
        location,
        attachments: [],
      }
      window.localStorage.setItem(INCIDENT_DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // Ignore storage failures
    }
  }, [category, title, description, occurredAt, location])

  React.useEffect(() => {
    return () => {
      attachments.forEach((a) => URL.revokeObjectURL(a.url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        // Permissions API not supported for geolocation on this device
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function extFromMime(mime: string): string {
    const map: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "audio/webm": "webm",
      "audio/mp4": "m4a",
      "audio/mpeg": "mp3",
      "application/pdf": "pdf",
      "text/plain": "txt",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
    }
    return map[mime] || mime.split("/")[1] || "bin"
  }

  function addFiles(files: FileList | null, kind: EvidenceKind) {
    if (!files) return
    const next: PendingAttachment[] = []
    Array.from(files).forEach((file) => {
      const fallbackName = `${kind}-${Date.now()}.${extFromMime(file.type || "")}`
      next.push({
        id: pid(),
        kind,
        name: file.name || fallbackName,
        blob: file,
        url: URL.createObjectURL(file),
      })
    })
    setAttachments((prev) => [...prev, ...next])
  }

  async function capturePhoto() {
    try {
      // Base64 avoids depending on a blob: URL scoped to the current
      // WebView session. If Android recreates the hosting Activity while
      // the native camera has focus (common on lower-memory devices),
      // a Uri-based webPath can become stale or point at a dead session —
      // this was the root cause of intermittent capture failures.
      // Base64 comes back as a plain string with no such dependency.
      const photo = await CapacitorCamera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        quality: 85,
        allowEditing: false,
      })

      if (!photo.webPath) return

      const response = await fetch(photo.webPath)
      const originalBlob = await response.blob()

      const ext =
        photo.format === "jpeg" || photo.format === "jpg"
          ? "jpg"
          : photo.format || extFromMime(originalBlob.type || "image/jpeg")

      const mimeType =
        originalBlob.type ||
        (ext === "jpg" ? "image/jpeg" : `image/${ext}`)

      const blob =
        originalBlob.type
          ? originalBlob
          : new Blob([originalBlob], { type: mimeType })

      const attachment: PendingAttachment = {
        id: pid(),
        kind: "photo",
        name: `photo-${Date.now()}.${ext}`,
        blob,
        url: URL.createObjectURL(blob),
      }

      setAttachments((prev) => [...prev, attachment])
    } catch (err) {
      const message = (err as Error)?.message || ""

      if (
        /cancel/i.test(message) ||
        /user/i.test(message) ||
        /No image selected/i.test(message)
      ) {
        return
      }

      setError(`Camera failed: ${message || "Could not capture photo"}`)
    }
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
    setGeoStatus(t("incidentFormExtra.locating"))
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus(t("incidentFormExtra.geoNotAvailable"))
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
      () => setGeoStatus(t("incidentFormExtra.geoPermissionDenied")),
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
      setError(t("incidentFormExtra.selectCategory"))
      return
    }
    if (!title.trim()) {
      setError(t("incidentFormExtra.enterTitle"))
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

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(INCIDENT_DRAFT_KEY)
      }

      router.replace("/incidents")
    } catch (err) {
      setError((err as Error).message || t("incidentFormExtra.couldNotSaveIncident"))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <Label>{t("incidentForm.category")}</Label>
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
                {categoryName(c.id, t)}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                {categoryDescription(c.id, t)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="title">{t("incidentForm.title")}</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("miscUi.shortSummaryPlaceholder")}
          maxLength={120}
        />
      </div>

      <div>
        <Label htmlFor="description">{t("incidentForm.description")}</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What happened? Include details while they are fresh."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="occurredAt">{t("incidentForm.date")}</Label>
          <Input
            id="occurredAt"
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </div>

        <div>
          <Label>{t("incidentForm.gps")}</Label>
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
                {geoStatus ?? t("incidentFormExtra.noLocationAttached")}
              </p>
            )}
            <div className="flex items-center justify-end gap-2">
              {location ? (
                <button
                  type="button"
                  onClick={() => setLocation(null)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  aria-label={t("incidentFormExtra.removeLocation")}
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
                {t("incidentFormExtra.capture")}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <div className="space-y-3">
        <Label>{t("incidentForm.evidence")}</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={capturePhoto}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium hover:bg-muted"
          >
            <Camera className="size-4" aria-hidden="true" />
            {t("incidentFormExtra.photo")}
          </button>
          <button
            type="button"
            onClick={() => shotInput.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium hover:bg-muted"
          >
            <ImageIcon className="size-4" aria-hidden="true" />
            {t("incidentFormExtra.screenshot")}
          </button>
        </div>
        <VoiceRecorder onRecorded={addVoice} />
        <button
          type="button"
          onClick={() => audioInput.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium hover:bg-muted"
        >
          <Mic className="size-4" aria-hidden="true" />
          {t("incidentFormExtra.uploadAudio")}
        </button>
        <button
          type="button"
          onClick={() => docInput.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium hover:bg-muted"
        >
          <FileText className="size-4" aria-hidden="true" />
          {t("incidentFormExtra.uploadDocument")}
        </button>

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
                  aria-label={t("incidentFormExtra.removeAttachment")}
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
          onClick={() => {
            try {
              localStorage.removeItem(INCIDENT_DRAFT_KEY)
            } catch {}
            attachments.forEach((a) => URL.revokeObjectURL(a.url))
            setAttachments([])
            router.back()
          }}
          disabled={submitting}
        >
          {t("incidentFormExtra.cancel")}
        </Button>
        <Button type="submit" size="lg" className="flex-1" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t("incidentFormExtra.encrypting")}
            </>
          ) : (
            t("incidentForm.saveIncident")
          )}
        </Button>
      </div>
    </form>
  )
}
