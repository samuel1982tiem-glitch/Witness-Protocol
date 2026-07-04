"use client"

import {
  Camera,
  Crosshair,
  FileAudio,
  FileImage,
  FileText,
  Film,
  ImageIcon,
  Loader2,
  MapPin,
  Mic,
  PlayCircle,
  Trash2,
  Video,
  X,
} from "lucide-react"
import {
  Camera as CapacitorCamera,
  CameraResultType,
  CameraSource,
} from "@capacitor/camera"
import { useRouter } from "next/navigation"
import * as React from "react"

import { useI18n } from "@/components/i18n-provider"
import { Button } from "@/components/ui/button"
import { Card, Input, Label, Textarea } from "@/components/ui/primitives"
import { useVault } from "@/components/vault-provider"
import { VoiceRecorder } from "@/components/voice-recorder"
import { CATEGORIES, categoryName } from "@/lib/categories"
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/format"
import { formatBytes, processMedia } from "@/lib/media"
import type { CategoryId, EvidenceKind, GeoLocation } from "@/lib/types"

type AttachmentKind = EvidenceKind | "video"

interface PendingAttachment {
  id: string
  kind: AttachmentKind
  name: string
  blob: Blob
  url: string
  mimeType: string
}

interface DraftAttachment {
  id: string
  kind: AttachmentKind
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

const INCIDENT_DRAFT_KEY = "witness:incident-draft:v2"

function pid() {
  return Math.random().toString(36).slice(2)
}

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",
  }
  return map[mime] || mime.split("/")[1] || "bin"
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const result = reader.result as string
      const commaIdx = result.indexOf(",")
      resolve(commaIdx === -1 ? result : result.slice(commaIdx + 1))
    }
    reader.readAsDataURL(blob)
  })
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

function sha256Hex(bytes: Uint8Array): Promise<string> {
  return crypto.subtle.digest("SHA-256", bytes).then((buffer) =>
    Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  )
}

function useObjectUrlCleanup(attachments: PendingAttachment[]) {
  React.useEffect(() => {
    return () => {
      attachments.forEach((a) => URL.revokeObjectURL(a.url))
    }
  }, [attachments])
}

function attachmentKindLabel(kind: AttachmentKind) {
  switch (kind) {
    case "photo":
      return "photo"
    case "screenshot":
      return "image"
    case "voice":
      return "audio"
    case "document":
      return "document"
    case "video":
      return "video"
    default:
      return kind
  }
}

function isVisual(kind: AttachmentKind, mimeType: string) {
  return (
    kind === "photo" ||
    kind === "screenshot" ||
    kind === "video" ||
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/")
  )
}

function isAudio(kind: AttachmentKind, mimeType: string) {
  return kind === "voice" || mimeType.startsWith("audio/")
}

function isDocument(kind: AttachmentKind, mimeType: string) {
  return (
    kind === "document" ||
    (!mimeType.startsWith("image/") &&
      !mimeType.startsWith("video/") &&
      !mimeType.startsWith("audio/"))
  )
}

async function cameraPhotoAttachment(): Promise<PendingAttachment | null> {
  const photo = await CapacitorCamera.getPhoto({
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
    quality: 85,
    allowEditing: false,
  })

  if (!photo.webPath) return null

  const response = await fetch(photo.webPath)
  const blob0 = await response.blob()
  const ext =
    photo.format === "jpeg" || photo.format === "jpg"
      ? "jpg"
      : photo.format || extFromMime(blob0.type || "image/jpeg")
  const mimeType =
    blob0.type || (ext === "jpg" ? "image/jpeg" : `image/${ext}`)
  const blob = blob0.type ? blob0 : new Blob([blob0], { type: mimeType })

  return {
    id: pid(),
    kind: "photo",
    name: `photo-${Date.now()}.${ext}`,
    blob,
    url: URL.createObjectURL(blob),
    mimeType,
  }
}

async function cameraVideoAttachment(): Promise<PendingAttachment | null> {
  // Capacitor Camera does not expose native video capture consistently across all targets.
  // We fall back to a file input flow elsewhere. This helper is here so the UI has the
  // separate “camera video” action the user asked for; on unsupported platforms we return null.
  return null
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

  const [previewId, setPreviewId] = React.useState<string | null>(null)

  const imageInput = React.useRef<HTMLInputElement>(null)
  const videoInput = React.useRef<HTMLInputElement>(null)
  const audioInput = React.useRef<HTMLInputElement>(null)
  const docInput = React.useRef<HTMLInputElement>(null)

  useObjectUrlCleanup(attachments)

  const previewAttachment = React.useMemo(
    () => attachments.find((a) => a.id === previewId) ?? null,
    [attachments, previewId],
  )

  // Restore draft
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
            mimeType: a.mimeType,
          }
        })
        setAttachments(restored)
      }
    } catch {
      // ignore corrupt draft
    }
  }, [])

  // Persist draft, including attachments
  React.useEffect(() => {
    let cancelled = false

    async function persistDraft() {
      if (typeof window === "undefined") return
      try {
        const draftAttachments: DraftAttachment[] = await Promise.all(
          attachments.map(async (a) => ({
            id: a.id,
            kind: a.kind,
            name: a.name,
            mimeType: a.mimeType,
            base64: await blobToBase64(a.blob),
          })),
        )

        if (cancelled) return

        const draft: IncidentDraft = {
          category,
          title,
          description,
          occurredAt,
          location,
          attachments: draftAttachments,
        }

        window.localStorage.setItem(INCIDENT_DRAFT_KEY, JSON.stringify(draft))
      } catch {
        // ignore localStorage / encoding failures
      }
    }

    persistDraft()

    return () => {
      cancelled = true
    }
  }, [category, title, description, occurredAt, location, attachments])

  // Auto-fill GPS if permission already granted
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
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  function clearDraftStorage() {
    try {
      localStorage.removeItem(INCIDENT_DRAFT_KEY)
    } catch {}
  }

  function clearAllAttachments() {
    attachments.forEach((a) => URL.revokeObjectURL(a.url))
    setAttachments([])
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((a) => a.id !== id)
    })
    if (previewId === id) setPreviewId(null)
  }

  function addPendingAttachment(attachment: PendingAttachment) {
    setAttachments((prev) => [...prev, attachment])
  }

  function addFiles(files: FileList | null, kind: AttachmentKind) {
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
        mimeType: file.type || "",
      })
    })

    setAttachments((prev) => [...prev, ...next])
  }

  function addVoice(blob: Blob) {
    const mimeType = blob.type || "audio/webm"
    setAttachments((prev) => [
      ...prev,
      {
        id: pid(),
        kind: "voice",
        name: `voice-note-${prev.filter((a) => a.kind === "voice").length + 1}.${extFromMime(mimeType)}`,
        blob,
        url: URL.createObjectURL(blob),
        mimeType,
      },
    ])
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

  async function handlePhotoCamera() {
    setError(null)
    try {
      const attachment = await cameraPhotoAttachment()
      if (attachment) addPendingAttachment(attachment)
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

  async function handleVideoCamera() {
    setError(null)
    try {
      const attachment = await cameraVideoAttachment()
      if (attachment) {
        addPendingAttachment(attachment)
        return
      }
      // Fallback: open file picker if native video capture path is not available
      videoInput.current?.click()
    } catch (err) {
      const message = (err as Error)?.message || ""
      setError(`Video capture failed: ${message || "Could not capture video"}`)
    }
  }

  async function exportPdf() {
    const visual = attachments.filter((a) => isVisual(a.kind, a.mimeType))
    const docs = attachments.filter((a) => isDocument(a.kind, a.mimeType))
    const audios = attachments.filter((a) => isAudio(a.kind, a.mimeType))

    const html = `
      <html>
        <head>
          <title>Incident Export</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { margin: 0 0 16px; }
            h2 { margin-top: 24px; }
            .row { margin: 8px 0; }
            .label { font-weight: bold; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
            .card { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
            .small { color: #555; font-size: 12px; }
            img, video { max-width: 100%; border-radius: 6px; }
          </style>
        </head>
        <body>
          <h1>${title || "Incident"}</h1>
          <div class="row"><span class="label">Category:</span> ${
            category ? categoryName(category, t) : "-"
          }</div>
          <div class="row"><span class="label">Occurred at:</span> ${occurredAt}</div>
          <div class="row"><span class="label">GPS:</span> ${
            location
              ? `${location.latitude}, ${location.longitude} (±${Math.round(
                  location.accuracy ?? 0,
                )}m)`
              : "-"
          }</div>
          <div class="row"><span class="label">Description:</span><br/>${
            description ? description.replace(/\n/g, "<br/>") : "-"
          }</div>

          <h2>Images / Videos</h2>
          <div class="grid">
            ${visual
              .map((a) => {
                const tag = a.mimeType.startsWith("video/")
                  ? `<video controls src="${a.url}"></video>`
                  : `<img src="${a.url}" alt="${a.name}" />`
                return `
                  <div class="card">
                    ${tag}
                    <div><strong>${a.name}</strong></div>
                    <div class="small">${a.mimeType || a.kind} · ${formatBytes(a.blob.size)}</div>
                  </div>
                `
              })
              .join("")}
          </div>

          <h2>Documents</h2>
          ${docs
            .map(
              (a) => `
                <div class="card" style="margin-bottom: 8px;">
                  <div><strong>${a.name}</strong></div>
                  <div class="small">${a.mimeType || a.kind} · ${formatBytes(a.blob.size)}</div>
                </div>
              `,
            )
            .join("")}

          <h2>Audio</h2>
          ${audios
            .map(
              (a) => `
                <div class="card" style="margin-bottom: 8px;">
                  <div><strong>${a.name}</strong></div>
                  <div class="small">${a.mimeType || a.kind} · ${formatBytes(a.blob.size)}</div>
                </div>
              `,
            )
            .join("")}
        </body>
      </html>
    `

    const printWindow = window.open("", "_blank", "noopener,noreferrer")
    if (!printWindow) return
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
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
          const processed = await processMedia(a.blob, a.mimeType.startsWith("image/"))
          return {
            kind:
              a.kind === "video"
                ? ("document" as EvidenceKind) // temporary mapping until the data model gets a native "video" evidence kind
                : (a.kind as EvidenceKind),
            name: a.name,
            mimeType: processed.mimeType || a.mimeType,
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

      clearDraftStorage()
      router.replace("/incidents")
    } catch (err) {
      setError((err as Error).message || t("incidentFormExtra.couldNotSaveIncident"))
      setSubmitting(false)
    }
  }

  async function renderTechnicalInfo(a: PendingAttachment) {
    const bytes = new Uint8Array(await a.blob.arrayBuffer())
    const hash = await sha256Hex(bytes)
    return {
      size: formatBytes(a.blob.size),
      mimeType: a.mimeType || a.blob.type || "application/octet-stream",
      hash,
    }
  }

  const [techCache, setTechCache] = React.useState<
    Record<string, { size: string; mimeType: string; hash: string }>
  >({})

  React.useEffect(() => {
    let cancelled = false

    async function fillTech() {
      const missing = attachments.filter((a) => !techCache[a.id])
      if (missing.length === 0) return

      const pairs = await Promise.all(
        missing.map(async (a) => [a.id, await renderTechnicalInfo(a)] as const),
      )

      if (cancelled) return

      setTechCache((prev) => {
        const next = { ...prev }
        for (const [id, info] of pairs) next[id] = info
        return next
      })
    }

    fillTech()

    return () => {
      cancelled = true
    }
  }, [attachments, techCache])

  const visualAttachments = attachments.filter((a) => isVisual(a.kind, a.mimeType))
  const documentAttachments = attachments.filter((a) =>
    isDocument(a.kind, a.mimeType),
  )
  const audioAttachments = attachments.filter((a) => isAudio(a.kind, a.mimeType))

  return (
    <>
      <form onSubmit={onSubmit} className="mx-auto w-full max-w-[440px] space-y-5 pb-8">
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div>
              <Label htmlFor="category">{t("incidentForm.category")}</Label>
              <select
                id="category"
                value={category ?? ""}
                onChange={(e) =>
                  setCategory((e.target.value || null) as CategoryId | null)
                }
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
              >
                <option value="">Select category…</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryName(c.id, t)}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[150px]">
              <Label>{t("incidentForm.gps")}</Label>
              <Card className="mt-1 flex min-h-[44px] items-center justify-between gap-2 rounded-xl px-3 py-2">
                {location ? (
                  <button
                    type="button"
                    onClick={openInMaps}
                    className="min-w-0 flex-1 text-left"
                    aria-label="Open location in maps"
                  >
                    <div className="flex items-center gap-1 text-primary">
                      <MapPin className="size-3.5 shrink-0" />
                      <span className="truncate text-xs font-medium">
                        {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      ±{Math.round(location.accuracy ?? 0)}m
                    </div>
                  </button>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {geoStatus ?? "No GPS"}
                  </span>
                )}

                <div className="flex items-center gap-1">
                  {location ? (
                    <button
                      type="button"
                      onClick={() => setLocation(null)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                      aria-label={t("incidentFormExtra.removeLocation")}
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={captureLocation}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                    aria-label={t("incidentFormExtra.capture")}
                  >
                    <Crosshair className="size-3.5" />
                  </button>
                </div>
              </Card>
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

          <div>
            <Label htmlFor="occurredAt">{t("incidentForm.date")}</Label>
            <Input
              id="occurredAt"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label>{t("incidentForm.evidence")}</Label>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handlePhotoCamera}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background px-2 py-3 text-xs font-medium hover:bg-muted"
            >
              <Camera className="size-4" />
              <span>Pic Cam</span>
            </button>

            <button
              type="button"
              onClick={() => imageInput.current?.click()}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background px-2 py-3 text-xs font-medium hover:bg-muted"
            >
              <FileImage className="size-4" />
              <span>Pic File</span>
            </button>

            <button
              type="button"
              onClick={handleVideoCamera}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background px-2 py-3 text-xs font-medium hover:bg-muted"
            >
              <Video className="size-4" />
              <span>Vid Cam</span>
            </button>

            <button
              type="button"
              onClick={() => videoInput.current?.click()}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background px-2 py-3 text-xs font-medium hover:bg-muted"
            >
              <Film className="size-4" />
              <span>Vid File</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("voice-recorder-anchor")
                el?.scrollIntoView({ behavior: "smooth", block: "center" })
              }}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background px-2 py-3 text-xs font-medium hover:bg-muted"
            >
              <Mic className="size-4" />
              <span>Record</span>
            </button>

            <button
              type="button"
              onClick={() => audioInput.current?.click()}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background px-2 py-3 text-xs font-medium hover:bg-muted"
            >
              <FileAudio className="size-4" />
              <span>Audio File</span>
            </button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-3">
            <div id="voice-recorder-anchor">
              <VoiceRecorder onRecorded={addVoice} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {visualAttachments.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Images & Videos
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {visualAttachments.map((a) => {
                    const tech = techCache[a.id]
                    const isVideo = a.mimeType.startsWith("video/")
                    return (
                      <div
                        key={a.id}
                        className="rounded-xl border border-border bg-card p-2"
                      >
                        <button
                          type="button"
                          onClick={() => setPreviewId(a.id)}
                          className="block w-full"
                        >
                          <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                            {isVideo ? (
                              <>
                                <video
                                  src={a.url}
                                  className="h-full w-full object-cover"
                                  muted
                                  playsInline
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                  <PlayCircle className="size-8 text-white" />
                                </div>
                              </>
                            ) : (
                              <img
                                src={a.url}
                                alt={a.name}
                                className="h-full w-full object-cover"
                              />
                            )}
                          </div>
                        </button>

                        <div className="mt-2 space-y-0.5">
                          <div className="truncate text-[11px] font-medium">
                            {a.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {attachmentKindLabel(a.kind)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {tech?.size ?? formatBytes(a.blob.size)}
                          </div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            {tech?.mimeType ?? a.mimeType}
                          </div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            {tech?.hash ?? "hashing…"}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeAttachment(a.id)}
                          className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                        >
                          <Trash2 className="size-3" />
                          Remove
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {documentAttachments.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Documents
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {documentAttachments.map((a) => {
                    const tech = techCache[a.id]
                    return (
                      <div
                        key={a.id}
                        className="rounded-xl border border-border bg-card p-2"
                      >
                        <div className="flex aspect-square items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <FileText className="size-8" />
                        </div>

                        <div className="mt-2 space-y-0.5">
                          <div className="truncate text-[11px] font-medium">
                            {a.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {attachmentKindLabel(a.kind)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {tech?.size ?? formatBytes(a.blob.size)}
                          </div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            {tech?.mimeType ?? a.mimeType}
                          </div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            {tech?.hash ?? "hashing…"}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeAttachment(a.id)}
                          className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                        >
                          <Trash2 className="size-3" />
                          Remove
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {audioAttachments.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Audio
                </div>
                <div className="space-y-2">
                  {audioAttachments.map((a) => {
                    const tech = techCache[a.id]
                    return (
                      <div
                        key={a.id}
                        className="rounded-xl border border-border bg-card p-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1 rounded-lg bg-muted p-2 text-muted-foreground">
                            <Mic className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-2">
                            <div>
                              <div className="truncate text-sm font-medium">
                                {a.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {attachmentKindLabel(a.kind)} ·{" "}
                                {tech?.size ?? formatBytes(a.blob.size)}
                              </div>
                            </div>

                            <audio controls src={a.url} className="w-full" />

                            <div className="space-y-0.5 text-[10px] text-muted-foreground">
                              <div className="truncate">
                                {tech?.mimeType ?? a.mimeType}
                              </div>
                              <div className="truncate">
                                {tech?.hash ?? "hashing…"}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeAttachment(a.id)}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                            aria-label={t("incidentFormExtra.removeAttachment")}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {attachments.length === 0 ? (
              <p className="text-xs leading-relaxed text-muted-foreground">
                Images are stripped of EXIF metadata, hashed with SHA-256, and
                encrypted before storage.
              </p>
            ) : null}
          </div>

          <input
            ref={imageInput}
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
            ref={videoInput}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files, "video")
              e.target.value = ""
            }}
          />

          <input
            ref={audioInput}
            type="file"
            accept="audio/*"
            multiple
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

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => docInput.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium hover:bg-muted"
            >
              <FileText className="size-4" />
              Upload document
            </button>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="col-span-1"
            onClick={() => {
              clearDraftStorage()
              clearAllAttachments()
              router.back()
            }}
            disabled={submitting}
          >
            {t("incidentFormExtra.cancel")}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="col-span-1"
            onClick={exportPdf}
            disabled={submitting}
          >
            Export PDF
          </Button>

          <Button
            type="submit"
            size="lg"
            className="col-span-1"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("incidentFormExtra.encrypting")}
              </>
            ) : (
              t("incidentForm.saveIncident")
            )}
          </Button>
        </div>
      </form>

      {previewAttachment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-background p-3 shadow-xl">
            <button
              type="button"
              onClick={() => setPreviewId(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/75"
              aria-label="Close preview"
            >
              <X className="size-4" />
            </button>

            <div className="overflow-hidden rounded-xl bg-black">
              {previewAttachment.mimeType.startsWith("video/") ? (
                <video
                  src={previewAttachment.url}
                  controls
                  className="max-h-[70vh] w-full"
                />
              ) : (
                <img
                  src={previewAttachment.url}
                  alt={previewAttachment.name}
                  className="max-h-[70vh] w-full object-contain"
                />
              )}
            </div>

            <div className="mt-3 space-y-1">
              <div className="font-medium">{previewAttachment.name}</div>
              <div className="text-sm text-muted-foreground">
                {attachmentKindLabel(previewAttachment.kind)}
              </div>
              <div className="text-xs text-muted-foreground">
                {techCache[previewAttachment.id]?.size ??
                  formatBytes(previewAttachment.blob.size)}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {techCache[previewAttachment.id]?.mimeType ??
                  previewAttachment.mimeType}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {techCache[previewAttachment.id]?.hash ?? "hashing…"}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>

  )
}