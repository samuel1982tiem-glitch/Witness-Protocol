"use client"

import { FileCheck2 } from "lucide-react"
import * as React from "react"

import { Card } from "@/components/ui/primitives"
import { useVault } from "@/components/vault-provider"
import type { EvidenceRecord } from "@/lib/db"
import { shortHash } from "@/lib/format"
import { formatBytes } from "@/lib/media"

interface LoadedEvidence {
  record: EvidenceRecord
  url: string
}

export function EvidenceList({ incidentId }: { incidentId: string }) {
  const { getEvidenceRecords, loadEvidenceUrl } = useVault()
  const [items, setItems] = React.useState<LoadedEvidence[]>([])
  const [loading, setLoading] = React.useState(true)
  const urlsRef = React.useRef<string[]>([])

  React.useEffect(() => {
    let active = true
    setLoading(true)
    ;(async () => {
      const records = await getEvidenceRecords(incidentId)
      const loaded: LoadedEvidence[] = []
      for (const record of records) {
        try {
          const url = await loadEvidenceUrl(record)
          urlsRef.current.push(url)
          loaded.push({ record, url })
        } catch {
          // skip undecryptable item
        }
      }
      if (active) {
        loaded.sort((a, b) => a.record.createdAt - b.record.createdAt)
        setItems(loaded)
        setLoading(false)
      }
    })()
    return () => {
      active = false
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u))
      urlsRef.current = []
    }
  }, [incidentId, getEvidenceRecords, loadEvidenceUrl])

  if (loading) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        Decrypting attachments…
      </Card>
    )
  }

  if (items.length === 0) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        No attachments on this record.
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(({ record, url }) => (
        <Card key={record.id} className="overflow-hidden">
          {record.kind === "voice" ? (
            <div className="p-3">
              <audio controls src={url} className="w-full" />
            </div>
          ) : (
            <img
              src={url || "/placeholder.svg"}
              alt={`${record.kind} evidence`}
              className="max-h-72 w-full object-contain bg-muted"
            />
          )}
          <div className="flex items-start gap-2 border-t border-border p-3">
            <FileCheck2
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="min-w-0 text-xs">
              <p className="font-medium capitalize text-foreground">
                {record.kind} · {formatBytes(record.size)}
              </p>
              <p className="mt-0.5 break-all font-mono text-muted-foreground">
                SHA-256 {shortHash(record.sha256, 10)}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
