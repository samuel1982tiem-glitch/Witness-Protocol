"use client"

import { createContext } from "react"
import * as React from "react"
import {
  exportVaultBackup,
  importVaultBackup,
} from "@/lib/backup"
import {
  checkVerifier,
  createVerifier,
  decryptJSON,
  deriveKey,
  encryptJSON,
  generateSalt,
} from "@/lib/crypto"
import {
  clearStore,
  getRecord,
  putRecord,
  STORES,
  toCipherPayload,
  type AlertRecord,
  type EvidenceRecord,
  type VaultRecord,
} from "@/lib/db"
import { analyzeIncidents } from "@/lib/patterns"
import {
  deleteIncident as repoDeleteIncident,
  getEvidenceRecords as repoGetEvidenceRecords,
  loadAllIncidents,
  loadEvidenceBlobUrl,
  saveEvidence,
  saveIncident,
  sealIncident as repoSealIncident,
  type EvidenceInput,
  type IncidentInput,
} from "@/lib/repo"
import { buildSampleIncidents } from "@/lib/sample-data"
import type {
  Incident,
  PatternAlert,
  VaultStatus,
} from "@/lib/types"

const DEFAULT_AUTOLOCK_MS = 3 * 60 * 1000

interface VaultContextValue {
  status: VaultStatus
  incidents: Incident[]
  alerts: PatternAlert[]
  autoLockMs: number
  error: string | null
  busy: boolean
  setupVault: (passcode: string, autoLockMinutes?: number) => Promise<void>
  unlock: (passcode: string) => Promise<boolean>
  lock: () => void
  addIncident: (
    input: IncidentInput,
    evidence: EvidenceInput[],
  ) => Promise<string>
  removeIncident: (incidentId: string) => Promise<void>
  sealIncident: (incidentId: string) => Promise<void>
  runAnalysis: () => Promise<PatternAlert[]>
  getEvidenceRecords: (incidentId: string) => Promise<EvidenceRecord[]>
  loadEvidenceUrl: (record: EvidenceRecord) => Promise<string>
  loadSampleData: () => Promise<void>
  registerActivity: () => void
exportBackup: () => Promise<string>
importBackup: (file: File) => Promise<void>
}





const VaultContext = createContext<VaultContextValue | null>(null)

export function useVault(): VaultContextValue {
  const ctx = React.useContext(VaultContext)
  if (!ctx) throw new Error("useVault must be used within VaultProvider")
  return ctx
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<VaultStatus>("loading")
  const [incidents, setIncidents] = React.useState<Incident[]>([])
  const [alerts, setAlerts] = React.useState<PatternAlert[]>([])
  const [autoLockMs, setAutoLockMs] = React.useState(DEFAULT_AUTOLOCK_MS)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)


  const keyRef = React.useRef<CryptoKey | null>(null)
  const lockTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Determine whether a vault has been initialized on this device.
React.useEffect(() => {
  let active = true

  ;(async () => {
    console.log("[VAULT] init start")

    try {
      console.log("[VAULT] before getRecord")

      const vault = await getRecord<VaultRecord>(
        STORES.users,
        "vault",
      )

      console.log("[VAULT] after getRecord", vault)

      if (!active) return

      if (vault) {
        console.log("[VAULT] found vault")
        setAutoLockMs(vault.autoLockMs ?? DEFAULT_AUTOLOCK_MS)
        setStatus("locked")
      } else {
        console.log("[VAULT] no vault")
        setStatus("uninitialized")
      }
    } catch (err) {
      console.log("[VAULT] init error", err)

      if (active) {
        setStatus("uninitialized")
      }
    }
  })()

  return () => {
    active = false
  }
}, [])

  const clearMemory = React.useCallback(() => {
    keyRef.current = null
    setIncidents([])
    setAlerts([])
  }, [])

  const lock = React.useCallback(() => {
    if (lockTimer.current) clearTimeout(lockTimer.current)
    clearMemory()
    setStatus((s) => (s === "uninitialized" ? s : "locked"))
  }, [clearMemory])

  const registerActivity = React.useCallback(() => {
    if (status !== "unlocked") return
    if (lockTimer.current) clearTimeout(lockTimer.current)
    lockTimer.current = setTimeout(() => lock(), autoLockMs)
  }, [status, autoLockMs, lock])

  // Auto-lock on inactivity + when tab is hidden for a while.
  React.useEffect(() => {
    if (status !== "unlocked") return
    registerActivity()
    const events: (keyof WindowEventMap)[] = [
      "pointerdown",
      "keydown",
      "scroll",
    ]
    const handler = () => registerActivity()
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }))
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler))
      if (lockTimer.current) clearTimeout(lockTimer.current)
    }
  }, [status, registerActivity])

  const refreshIncidents = React.useCallback(async (): Promise<Incident[]> => {
    const key = keyRef.current
    if (!key) return []
    const list = await loadAllIncidents(key)
    setIncidents(list)
    return list
  }, [])

  const loadStoredAlerts = React.useCallback(async () => {
    const key = keyRef.current
    if (!key) return
    try {
      const record = await getRecord<AlertRecord>(
        STORES.patternAlerts,
        "latest",
      )
      if (record) {
        const stored = await decryptJSON<PatternAlert[]>(
          key,
          toCipherPayload(record),
        )
        setAlerts(stored)
      }
    } catch (err) {
      console.log("[v0] load alerts error:", (err as Error).message)
    }
  }, [])

  const setupVault = React.useCallback(
    async (
  passcode: string,
  autoLockMinutes = 3,
) => {
      setBusy(true)
      setError(null)
      try {
        const salt = generateSalt()
        const key = await deriveKey(passcode, salt)
        const verifier = await createVerifier(key)
        const minutes = autoLockMinutes ?? 3
const ms = Math.max(1, minutes) * 60 * 1000
        const record: VaultRecord = {
          id: "vault",
          salt,
          verifierIv: verifier.iv,
          verifierData: verifier.data,
          autoLockMs: ms,
          createdAt: Date.now(),
        }
        await putRecord(STORES.users, record)
        keyRef.current = key
        setAutoLockMs(ms)
        setStatus("unlocked")
        await refreshIncidents()
      } catch (err) {
        setError((err as Error).message)
        throw err
      } finally {
        setBusy(false)
      }
    },
    [refreshIncidents],
  )

  const unlock = React.useCallback(
    async (passcode: string): Promise<boolean> => {
      setBusy(true)
      setError(null)
      try {
        const vault = await getRecord<VaultRecord>(STORES.users, "vault")
        if (!vault) {
          setStatus("uninitialized")
          return false
        }
        const key = await deriveKey(passcode, vault.salt)
        const ok = await checkVerifier(key, {
          iv: vault.verifierIv,
          data: vault.verifierData,
        })
        if (!ok) {
          setError("Incorrect vault passcode.")
          return false
        }
keyRef.current = key
setAutoLockMs(vault.autoLockMs ?? DEFAULT_AUTOLOCK_MS)

await refreshIncidents()
await loadStoredAlerts()

setStatus("unlocked")

return true

      } catch (err) {
        setError((err as Error).message)
        return false
      } finally {
        setBusy(false)
      }
    },
    [refreshIncidents, loadStoredAlerts],
  )

  const addIncident = React.useCallback(
    async (input: IncidentInput, evidence: EvidenceInput[]) => {
      const key = keyRef.current
      if (!key) throw new Error("Vault is locked.")
      const incidentId = await saveIncident(key, input)
      for (const ev of evidence) {
        await saveEvidence(key, incidentId, ev)
      }
      await refreshIncidents()
      return incidentId
    },
    [refreshIncidents],
  )

  const removeIncident = React.useCallback(
    async (incidentId: string) => {
      const target = incidents.find((i) => i.id === incidentId)
      if (target?.sealed) throw new Error("Sealed incidents cannot be deleted.")
      await repoDeleteIncident(incidentId)
      await refreshIncidents()
    },
    [incidents, refreshIncidents],
  )

  const sealIncident = React.useCallback(
    async (incidentId: string) => {
      const key = keyRef.current
      if (!key) throw new Error("Vault is locked.")
      const target = incidents.find((i) => i.id === incidentId)
      if (!target) throw new Error("Incident not found.")
      await repoSealIncident(key, target)
      await refreshIncidents()
    },
    [incidents, refreshIncidents],
  )

  const runAnalysis = React.useCallback(async (): Promise<PatternAlert[]> => {
    const key = keyRef.current
    if (!key) return []
    const list = await refreshIncidents()
    const result = analyzeIncidents(list)
    setAlerts(result)
    try {
      const payload = await encryptJSON(key, result)
      const record: AlertRecord = {
        id: "latest",
        iv: payload.iv,
        data: payload.data,
        createdAt: Date.now(),
      }
      await putRecord(STORES.patternAlerts, record)
    } catch (err) {
      console.log("[v0] persist alerts error:", (err as Error).message)
    }
    return result
  }, [refreshIncidents])

  const getEvidenceRecords = React.useCallback(
    (incidentId: string) => repoGetEvidenceRecords(incidentId),
    [],
  )

  const loadEvidenceUrl = React.useCallback(
    (record: EvidenceRecord) => {
      const key = keyRef.current
      if (!key) throw new Error("Vault is locked.")
      return loadEvidenceBlobUrl(key, record)
    },
    [],
  )

  const loadSampleData = React.useCallback(async () => {
    const key = keyRef.current
    if (!key) throw new Error("Vault is locked.")
    const samples = buildSampleIncidents()
    for (const s of samples) {
      await saveIncident(key, {
        title: s.title,
        description: s.description,
        category: s.category,
        occurredAt: s.occurredAt,
        location: s.location,
      })
    }
    await refreshIncidents()
    await runAnalysis()
  }, [refreshIncidents, runAnalysis])

  const exportBackup = React.useCallback(async (): Promise<string> => {
  const key = keyRef.current
  if (!key) throw new Error("Vault is locked.")

  return await exportVaultBackup(key)
}, [])

const importBackup = React.useCallback(
  async (file: File) => {
    const key = keyRef.current
    if (!key) throw new Error("Vault is locked.")

    // Snapshot the current vault record BEFORE importing, so we can
    // restore it afterwards. importAllRecords overwrites the users store
    // (including salt + verifier), which would break the current PIN.
    const currentVault = await getRecord<VaultRecord>(STORES.users, "vault")

    await importVaultBackup(file, key)

    // Restore this device's own vault record so the PIN keeps working.
    if (currentVault) {
      await putRecord(STORES.users, currentVault)
    }

    await refreshIncidents()
    await loadStoredAlerts()
    setStatus("unlocked")
    registerActivity()
  },
  [refreshIncidents, loadStoredAlerts, registerActivity],
)
  const value: VaultContextValue = {
    status,
    incidents,
    alerts,
    autoLockMs,
    error,
    busy,
    setupVault,
    unlock,
    lock,
    addIncident,
    removeIncident,
    sealIncident,
    runAnalysis,
    getEvidenceRecords,
    loadEvidenceUrl,
    loadSampleData,
    registerActivity,
exportBackup,
importBackup,

  }

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
}
