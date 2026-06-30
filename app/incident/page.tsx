"use client"

import {
  ArrowLeft,
  Crosshair,
  Lock,
  MapPin,
  Pencil,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { EvidenceList } from "@/components/evidence-list"
import {
  Badge,
  Card,
  CardBody,
  Input,
  Label,
  SectionTitle,
  Textarea,
} from "@/components/ui/primitives"
import { useVault } from "@/components/vault-provider"
import { CATEGORIES, categoryName } from "@/lib/categories"
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/format"
import { formatCoords, formatDateTime, shortHash } from "@/lib/format"
import type { CategoryId, GeoLocation } from "@/lib/types"

export default function IncidentDetailPage() {
 const searchParams = useSearchParams()
const incidentId = searchParams.get("id")
  const router = useRouter()
  const { incidents, sealIncident, removeIncident, updateIncident, busy } =
    useVault()
  const [working, setWorking] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState(false)
  const [geoStatus, setGeoStatus] = React.useState<string | null>(null)

  const incident = incidents.find((i) => i.id === incidentId)

  // Edit-mode draft state. Synced from the incident when editing begins.
  const [draftCategory, setDraftCategory] = React.useState<CategoryId | null>(
    null,
  )
  const [draftTitle, setDraftTitle] = React.useState("")
  const [draftDescription, setDraftDescription] = React.useState("")
  const [draftOccurredAt, setDraftOccurredAt] = React.useState("")
  const [draftLocation, setDraftLocation] = React.useState<GeoLocation | null>(
    null,
  )

  function beginEdit() {
    if (!incident) return
    setDraftCategory(incident.category)
    setDraftTitle(incident.title)
    setDraftDescription(incident.description)
    setDraftOccurredAt(toDateTimeLocal(incident.occurredAt))
    setDraftLocation(incident.location)
    setEditing(true)
    setError(null)
  }

  function cancelEdit() {
    setEditing(false)
    setGeoStatus(null)
  }

  function captureLocation() {
    setGeoStatus("Locating…")
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("Geolocation is not available on this device.")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDraftLocation({
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

  function openInMaps(loc: GeoLocation) {
    const url = `https://maps.google.com/?q=${loc.latitude},${loc.longitude}`
    window.open(url, "_blank")
  }

  async function handleSaveEdit() {
    if (!incident) return
    setError(null)
    if (!draftCategory) {
      setError("Select a category.")
      return
    }
    if (!draftTitle.trim()) {
      setError("Enter a title.")
      return
    }
    setWorking(true)
    try {
      await updateIncident(incident.id, {
        title: draftTitle.trim(),
        description: draftDescription.trim(),
        category: draftCategory,
        occurredAt: fromDateTimeLocal(draftOccurredAt),
        location: draftLocation,
      })
      setEditing(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setWorking(false)
    }
  }

  if (!incident) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card>
          <CardBody className="text-sm text-muted-foreground">
            This record could not be found. It may have been deleted, or the
            vault needs to be unlocked.
          </CardBody>
        </Card>
      </div>
    )
  }

  async function handleSeal() {
    setError(null)
    setWorking(true)
    try {
      await sealIncident(incident!.id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setWorking(false)
    }
  }

  async function handleDelete() {
    setError(null)
    setWorking(true)
    try {
      await removeIncident(incident!.id)
      router.push("/incidents")
    } catch (err) {
      setError((err as Error).message)
      setWorking(false)
    }
  }

  return (
    <div className="space-y-5">
      <BackLink />

      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">{categoryName(incident.category)}</Badge>
            {incident.sealed ? (
              <Badge tone="green">
                <ShieldCheck className="size-3" aria-hidden="true" />
                Sealed
              </Badge>
            ) : (
              <Badge tone="gray">Unsealed</Badge>
            )}
          </div>
          {!incident.sealed && !editing ? (
            <Button variant="outline" size="sm" onClick={beginEdit}>
              <Pencil className="size-4" aria-hidden="true" />
              Edit
            </Button>
          ) : null}
        </div>
        {!editing ? (
          <>
            <h1 className="text-balance text-2xl font-semibold tracking-tight">
              {incident.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatDateTime(incident.occurredAt)}
            </p>
          </>
        ) : null}
      </header>

      {editing ? (
        <Card>
          <CardBody className="space-y-4">
            <div>
              <Label>Category</Label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setDraftCategory(c.id)}
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                      draftCategory === c.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    <span
                      className={`block text-sm font-medium ${
                        draftCategory === c.id ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {c.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                maxLength={120}
              />
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-occurredAt">Date and time</Label>
                <Input
                  id="edit-occurredAt"
                  type="datetime-local"
                  value={draftOccurredAt}
                  onChange={(e) => setDraftOccurredAt(e.target.value)}
                />
              </div>

              <div>
                <Label>GPS coordinates</Label>
                <Card className="flex h-full flex-col justify-between gap-2 p-3">
                  {draftLocation ? (
                    <button
                      type="button"
                      onClick={() => openInMaps(draftLocation)}
                      className="min-w-0 flex-1 text-left text-sm"
                      aria-label="Open location in maps"
                    >
                      <p className="truncate font-medium text-primary underline-offset-2 hover:underline">
                        {draftLocation.latitude.toFixed(5)},{" "}
                        {draftLocation.longitude.toFixed(5)}
                      </p>
                    </button>
                  ) : (
                    <p className="flex-1 text-sm text-muted-foreground">
                      {geoStatus ?? "No location attached."}
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-2">
                    {draftLocation ? (
                      <button
                        type="button"
                        onClick={() => setDraftLocation(null)}
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

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={cancelEdit}
                disabled={working}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveEdit}
                disabled={working || busy}
              >
                Save changes
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="space-y-4">
            <div>
              <h2 className="mb-1 text-sm font-medium text-foreground">
                Description
              </h2>
              <p className="whitespace-pre-wrap text-pretty text-sm leading-relaxed text-muted-foreground">
                {incident.description || "No description provided."}
              </p>
            </div>

            {incident.location ? (
              <button
                type="button"
                onClick={() => openInMaps(incident.location!)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                aria-label="Open location in maps"
              >
                <MapPin className="size-4 text-primary" aria-hidden="true" />
                <span className="font-mono underline-offset-2 hover:underline">
                  {formatCoords(
                    incident.location.latitude,
                    incident.location.longitude,
                  )}
                </span>
              </button>
            ) : null}
          </CardBody>
        </Card>
      )}

      {!editing ? (
        <section className="space-y-3">
          <SectionTitle
            title="Evidence"
            description="Decrypted in memory only."
          />
          <EvidenceList incidentId={incident.id} />
        </section>
      ) : null}

      {incident.sealed && incident.seal ? (
        <Card className="border-emerald-200 bg-emerald-50/60">
          <CardBody className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Evidence seal
            </div>
            <p className="text-xs text-emerald-700/90">
              Sealed {formatDateTime(incident.seal.sealedAt)}
            </p>
            <p className="break-all font-mono text-xs text-emerald-700/90">
              SHA-256 {shortHash(incident.seal.hash, 16)}
            </p>
          </CardBody>
        </Card>
      ) : null}

      {!editing && error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      {!editing ? (
      <div className="flex flex-col gap-2 pt-1">
        {!incident.sealed ? (
          <Button
            onClick={handleSeal}
            disabled={working || busy}
            className="w-full"
          >
            <Lock className="size-4" aria-hidden="true" />
            Seal evidence
          </Button>
        ) : null}

        {incident.sealed ? (
          <p className="rounded-xl bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
            Sealed records are permanent and cannot be deleted.
          </p>
        ) : confirmDelete ? (
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={working}
              className="flex-1"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Confirm delete
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={working}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            onClick={() => setConfirmDelete(true)}
            disabled={working}
            className="w-full text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete record
          </Button>
        )}
      </div>
      ) : null}
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href="/incidents"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      All records
    </Link>
  )
}
