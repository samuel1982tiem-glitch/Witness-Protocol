"use client"

import {
  Camera,
  Crosshair,
  Download,
  FileAudio,
  FileImage,
  FileText,
  Film,
  ImageIcon,
  Loader2,
  Mic,
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
  createdAt: number
}

const INCIDENT_DRAFT_KEY = "witness:incident-draft:v1"

interface IncidentDraft {
  category: CategoryId | null
  title: string
  description: string
  occurredAt: string
  location: GeoLocation | null
}

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

function isImageAttachment(kind: EvidenceKind) {
  return kind === "photo" || kind === "screenshot"
}

function isVideoAttachment(kind: EvidenceKind) {
  return kind === "video"
}

function isAudioAttachment(kind: EvidenceKind) {
  return kind === "voice"
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
  const [previewAttachmentId, setPreviewAttachmentId] = React.useState<string | null>(null)

  const photoFileInput = React.useRef<HTMLInputElement>(null)
  const videoFileInput = React.useRef<HTMLInputElement>(null)
  const audioFileInput = React.useRef<HTMLInputElement>(null)
  const docInput = React.useRef<HTMLInputElement>(null)

  // Restore draft text/location
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
    } catch {
      // ignore corrupt draft
    }
  }, [])

  // Persist draft text/location only
  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const draft: IncidentDraft = {
        category,
        title,
        description,
        occurredAt,
        location,
      }
      window.localStorage.setItem(INCIDENT_DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // ignore storage failures
    }
  }, [category, title, description, occurredAt, location])

  React.useEffect(() => {
    return () => {
      attachments.forEach((a) => URL.revokeObjectURL(a.url))
    }
  }, [attachments])

  // Autofill GPS if permission already granted
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function buildAttachment(kind: EvidenceKind, blob: Blob, name?: string): PendingAttachment {
    const fallbackName = `${kind}-${Date.now()}.${extFromMime(blob.type || "")}`
    return {
      id: pid(),
      kind,
      name: name || fallbackName,
      blob,
      url: URL.createObjectURL(blob),
      createdAt: Date.now(),
    }
  }

  function addFiles(files: FileList | null, kind: EvidenceKind) {
    if (!files) return
    const next: PendingAttachment[] = Array.from(files).map((file) =>
      buildAttachment(
        kind,
        file,
        file.name || `${kind}-${Date.now()}.${extFromMime(file.type || "")}`,
      ),
    )
    setAttachments((prev) => [...prev, ...next])
  }

  async function capturePhoto() {
    try {
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

      setAttachments((prev) => [
        ...prev,
        buildAttachment("photo", blob, `photo-${Date.now()}.${ext}`),
      ])
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

                            async function captureVideo() {
    try {
      // First, request camera permission
      const permissionStatus = await CapacitorCamera.requestPermissions({
        permissions: ['camera']
      });

      if (permissionStatus.camera !== 'granted') {
        setError("Camera permission denied. Please enable camera access in settings.");
        return;
      }

      // Use Capacitor Camera's getPhoto with video quality
      // This opens the native camera app
      const video = await CapacitorCamera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        quality: 85,
        allowEditing: false,
      });

      if (!video.webPath) {
        throw new Error("No video captured");
      }

      // Fetch the file
      const response = await fetch(video.webPath);
      const blob = await response.blob();

      // Check if it's a video file
      let ext = 'mp4';
      let mimeType = blob.type || 'video/mp4';
      
      // If it's actually a photo, inform the user
      if (mimeType.includes('image')) {
        setError("Camera captured a photo instead of video. Please use the video file picker instead.");
        // Optionally add as photo
        const photoExt = 'jpg';
        const photoMime = blob.type || 'image/jpeg';
        const finalPhoto = blob.type ? blob : new Blob([blob], { type: photoMime });
        setAttachments((prev) => [
          ...prev,
          buildAttachment("photo", finalPhoto, `photo-${Date.now()}.${photoExt}`),
        ]);
        return;
      }

      const finalBlob = blob.type ? blob : new Blob([blob], { type: mimeType });

      setAttachments((prev) => [
        ...prev,
        buildAttachment("video", finalBlob, `video-${Date.now()}.${ext}`),
      ]);

      setError(null);

    } catch (err) {
      const message = (err as Error)?.message || "";
      if (
        /cancel/i.test(message) ||
        /user/i.test(message) ||
        /No video selected/i.test(message)
      ) {
        return;
      }
      // If the error is about getPhoto not supporting video, fall back to file picker
      if (message.includes('not implemented') || message.includes('video')) {
        setError("Video recording not available. Please select a video from your device.");
        videoFileInput.current?.click();
        return;
      }
      setError(`Video capture failed: ${message || "Could not record video"}`);
    }
  }

  function addVoice(blob: Blob) {
    setAttachments((prev) => [
      ...prev,
      buildAttachment(
        "voice",
        blob,
        `voice-note-${prev.filter((a) => a.kind === "voice").length + 1}.webm`,
      ),
    ])
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return prev.filter((a) => a.id !== id)
    })
    if (previewAttachmentId === id) {
      setPreviewAttachmentId(null)
    }
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

  function downloadAttachment(attachment: PendingAttachment) {
    const link = document.createElement("a")
    link.href = attachment.url
    link.download = attachment.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
          const processed = await processMedia(a.blob, isImageAttachment(a.kind))
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

  const previewAttachment =
    previewAttachmentId != null
      ? attachments.find((a) => a.id === previewAttachmentId) ?? null
      : null

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-5">
        {/* Date + GPS - centered */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-6">
            <Label htmlFor="occurredAt">{t("incidentForm.date")}</Label>
            <Input
              id="occurredAt"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          </div>

          <div className="col-span-6">
            <Label>{t("incidentForm.gps")}</Label>
            <Card className="flex min-h-[42px] items-center justify-between gap-2 px-3 py-2">
              {location ? (
                <button
                  type="button"
                  onClick={openInMaps}
                  className="min-w-0 flex-1 text-left"
                  aria-label="Open location in maps"
                >
                  <p className="truncate text-sm font-medium text-primary underline-offset-2 hover:underline">
                    {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    ±{Math.round(location.accuracy ?? 0)}m
                  </p>
                </button>
              ) : (
                <p className="truncate text-sm text-muted-foreground">
                  {geoStatus ?? t("incidentFormExtra.noLocationAttached")}
                </p>
              )}

              <div className="flex items-center gap-1">
                {location ? (
                  <button
                    type="button"
                    onClick={() => setLocation(null)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                    aria-label={t("incidentFormExtra.removeLocation")}
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={captureLocation}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                  aria-label={t("incidentFormExtra.capture")}
                >
                  <Crosshair className="size-4" />
                </button>
              </div>
            </Card>
          </div>
        </div>

        {/* Category + Title */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-5">
            <Label htmlFor="category">{t("incidentForm.category")}</Label>
            <select
              id="category"
              value={category ?? ""}
              onChange={(e) =>
                setCategory((e.target.value || null) as CategoryId | null)
              }
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">{t("evidenceHint.selectCategoryPlaceholder")}</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryName(c.id, t)}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-7">
            <Label htmlFor="title">{t("incidentForm.title")}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("miscUi.shortSummaryPlaceholder")}
              maxLength={120}
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description">{t("incidentForm.description")}</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened? Include details while they are fresh."
          />
        </div>

        {/* Attachment toolbar - centered icons */}
        <div className="space-y-3">
          <Label>{t("incidentForm.evidence")}</Label>

          <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-border bg-card p-2">
            {/* Photo camera */}
            <button
              type="button"
              onClick={capturePhoto}
              className="rounded-lg border border-border bg-background p-2 hover:bg-muted"
              aria-label="Capture photo"
              title="Capture photo"
            >
              <Camera className="size-4" />
            </button>

            {/* Photo file */}
            <button
              type="button"
              onClick={() => photoFileInput.current?.click()}
              className="rounded-lg border border-border bg-background p-2 hover:bg-muted"
              aria-label="Select photo"
              title="Select photo"
            >
              <FileImage className="size-4" />
            </button>

            {/* Video camera */}
            <button
              type="button"
              onClick={captureVideo}
              className="rounded-lg border border-border bg-background p-2 hover:bg-muted"
              aria-label="Capture video"
              title="Capture video"
            >
              <Video className="size-4" />
            </button>

            {/* Video file */}
            <button
              type="button"
              onClick={() => videoFileInput.current?.click()}
              className="rounded-lg border border-border bg-background p-2 hover:bg-muted"
              aria-label="Select video"
              title="Select video"
            >
              <Film className="size-4" />
            </button>

            {/* Audio file */}
            <button
              type="button"
              onClick={() => audioFileInput.current?.click()}
              className="rounded-lg border border-border bg-background p-2 hover:bg-muted"
              aria-label="Upload audio"
              title="Upload audio"
            >
              <FileAudio className="size-4" />
            </button>

            {/* Document file */}
            <button
              type="button"
              onClick={() => docInput.current?.click()}
              className="rounded-lg border border-border bg-background p-2 hover:bg-muted"
              aria-label="Upload document"
              title="Upload document"
            >
              <FileText className="size-4" />
            </button>
          </div>

          {/* Recorder row preserved */}
          <VoiceRecorder onRecorded={addVoice} />

          <input
            ref={photoFileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files, "photo")
              e.target.value = ""
            }}
          />

          <input
            ref={videoFileInput}
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
            ref={audioFileInput}
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

          {/* Attachments grid */}
          {attachments.length > 0 ? (
            <div className="space-y-4">
              {/* Visual media */}
              {attachments.some(
                (a) => isImageAttachment(a.kind) || isVideoAttachment(a.kind),
              ) ? (
                <div className="grid grid-cols-3 gap-3">
                  {attachments
                    .filter(
                      (a) => isImageAttachment(a.kind) || isVideoAttachment(a.kind),
                    )
                    .map((a) => (
                      <div
                        key={a.id}
                        className="rounded-xl border border-border bg-card p-2"
                      >
                        <button
                          type="button"
                          onClick={() => setPreviewAttachmentId(a.id)}
                          className="block w-full"
                        >
                          {isVideoAttachment(a.kind) ? (
                            <div className="flex aspect-square items-center justify-center rounded-lg bg-muted">
                              <Film className="size-8 text-muted-foreground" />
                            </div>
                          ) : (
                            <img
                              src={a.url}
                              alt={a.name}
                              className="aspect-square w-full rounded-lg object-cover"
                            />
                          )}
                        </button>

                        <div className="mt-2 space-y-0.5">
                          <p className="truncate text-[11px] font-medium">{a.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {a.kind} · {formatBytes(a.blob.size)}
                          </p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {a.blob.type || "application/octet-stream"}
                          </p>
                        </div>

                        <div className="mt-2 flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => removeAttachment(a.id)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                            aria-label={t("incidentFormExtra.removeAttachment")}
                            title="Remove"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : null}

              {/* Documents + audio list */}
              {attachments.some(
                (a) => a.kind === "document" || a.kind === "voice",
              ) ? (
                <div className="grid grid-cols-1 gap-3">
                  {attachments
                    .filter((a) => a.kind === "document" || a.kind === "voice")
                    .map((a) => (
                      <div
                        key={a.id}
                        className="rounded-xl border border-border bg-card p-3"
                      >
                        {a.kind === "voice" ? (
                          <div className="space-y-2">
                            <audio controls src={a.url} className="w-full" />
                            <div className="space-y-0.5">
                              <p className="truncate text-sm font-medium">{a.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {a.kind} · {formatBytes(a.blob.size)}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {a.blob.type || "application/octet-stream"}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                              <FileText className="size-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{a.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {a.kind} · {formatBytes(a.blob.size)}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {a.blob.type || "application/octet-stream"}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="mt-2 flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => removeAttachment(a.id)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                            aria-label={t("incidentFormExtra.removeAttachment")}
                            title="Remove"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("evidenceHint.evidenceDisclaimer")}
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
                <Loader2 className="size-4 animate-spin" />
                {t("incidentFormExtra.encrypting")}
              </>
            ) : (
              t("incidentForm.saveIncident")
            )}
          </Button>
        </div>
      </form>

      {/* Fullscreen preview modal */}
      {previewAttachment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-md rounded-2xl bg-background p-4 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewAttachmentId(null)}
              className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Close preview"
            >
              <X className="size-4" />
            </button>

            <div className="space-y-3">
              {isVideoAttachment(previewAttachment.kind) ? (
                <video
                  src={previewAttachment.url}
                  controls
                  className="max-h-[70vh] w-full rounded-xl bg-black"
                />
              ) : (
                <img
                  src={previewAttachment.url}
                  alt={previewAttachment.name}
                  className="max-h-[70vh] w-full rounded-xl object-contain"
                />
              )}

              <div className="rounded-xl border border-border bg-card p-3 text-sm">
                <p className="font-medium">{previewAttachment.name}</p>
                <p className="text-muted-foreground">
                  Kind: {previewAttachment.kind}
                </p>
                <p className="text-muted-foreground">
                  Size: {formatBytes(previewAttachment.blob.size)}
                </p>
                <p className="break-all text-muted-foreground">
                  MIME: {previewAttachment.blob.type || "application/octet-stream"}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downloadAttachment(previewAttachment)}
                >
                  <Download className="size-4" />
                  Download
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}