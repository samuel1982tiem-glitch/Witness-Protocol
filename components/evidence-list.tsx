"use client"

import { Download, FileCheck2, FileText } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/primitives"
import { useVault } from "@/components/vault-provider"
import type { EvidenceRecord } from "@/lib/db"
import { shortHash } from "@/lib/format"
import { formatBytes } from "@/lib/media"

interface LoadedEvidence {
  record: EvidenceRecord
  url: string
  name: string
}

export function EvidenceList({ incidentId }: { incidentId: string }) {
  const { getEvidenceRecords, loadEvidenceUrl, downloadEvidence } = useVault()
  const [items, setItems] = React.useState<LoadedEvidence[]>([])
  const [loading, setLoading] = React.useState(true)
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)
  const urlsRef = React.useRef<string[]>([])

  React.useEffect(() => {
    let active = true
    setLoading(true)
    ;(async () => {
      const records = await getEvidenceRecords(incidentId)
      const loaded: LoadedEvidence[] = []
      for (const record of records) {
        try {
          const { url, name } = await loadEvidenceUrl(record)
          urlsRef.current.push(url)
          loaded.push({ record, url, name })
        } catch {}
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

  async function handleDownload(record: EvidenceRecord) {
    setDownloadingId(record.id)
    try {
      const savedName = await downloadEvidence(record)
      alert(`Ready to save/share:\n${savedName}`)
    } catch (err) {
      alert(`Download failed: ${(err as Error).message}\n\nIf this persists, allow storage permission for this app in Android Settings.`)
    } finally {
      setDownloadingId(null)
    }
  }

  if (loading) {
    return <Card className="p-4 text-sm text-muted-foreground">Decrypting attachments…</Card>
  }
  if (items.length === 0) {
    return <Card className="p-4 text-sm text-muted-foreground">No attachments on this record.</Card>
  }

  const documentCount = items.filter((i) => i.record.kind === "document").length

  return (
    <div className="space-y-3">
      {documentCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {documentCount} document{documentCount === 1 ? "" : "s"} attached
        </p>
      ) : null}
      {items.map(({ record, url, name }) => (
        <Card key={record.id} className="overflow-hidden">
          {record.kind === "voice" ? (
            <div className="p-3">
              <audio controls src={url} className="w-full" />
            </div>
          ) : record.kind === "document" ? (
            <div className="flex items-center justify-center bg-muted p-6">
              <FileText className="size-10 text-muted-foreground" aria-hidden="true" />
            </div>
          ) : (
            <img src={url || "/placeholder.svg"} alt={name || record.kind} className="max-h-72 w-full object-contain bg-muted" />
          )}
          <div className="flex items-start gap-2 border-t border-border p-3">
            <FileCheck2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1 text-xs">
              <p className="truncate font-medium text-foreground">
                {name || record.kind}
              </p>
              <p className="text-muted-foreground">
                {record.kind} · {formatBytes(record.size)}
              </p>
              <p className="mt-0.5 break-all font-mono text-muted-foreground">
                SHA-256 {shortHash(record.sha256, 10)}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleDownload(record)} disabled={downloadingId === record.id}>
              <Download className="size-3.5" aria-hidden="true" />
              {downloadingId === record.id ? "Saving…" : "Download"}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}
