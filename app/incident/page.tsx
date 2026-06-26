"use client"

import {
  ArrowLeft,
  Lock,
  MapPin,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import * as React from "react"

import { EvidenceList } from "@/components/evidence-list"
import { Button } from "@/components/ui/button"
import {
  Badge,
  Card,
  CardBody,
  SectionTitle,
} from "@/components/ui/primitives"
import { useVault } from "@/components/vault-provider"
import { categoryName } from "@/lib/categories"
import { formatCoords, formatDateTime, shortHash } from "@/lib/format"

export default function IncidentDetailPage() {
 const searchParams = useSearchParams()
const incidentId = searchParams.get("id")
  const router = useRouter()
  const { incidents, sealIncident, removeIncident, busy } = useVault()
  const [working, setWorking] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

const incident = incidents.find((i) => i.id === incidentId)

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
        <h1 className="text-balance text-2xl font-semibold tracking-tight">
          {incident.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatDateTime(incident.occurredAt)}
        </p>
      </header>

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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-4 text-primary" aria-hidden="true" />
              <span className="font-mono">
                {formatCoords(
                  incident.location.latitude,
                  incident.location.longitude,
                )}
              </span>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <section className="space-y-3">
        <SectionTitle title="Evidence" description="Decrypted in memory only." />
        <EvidenceList incidentId={incident.id} />
      </section>

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

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

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
