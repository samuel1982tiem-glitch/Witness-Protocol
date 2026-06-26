"use client"

import { KeyRound, Lock, ShieldCheck } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/primitives"
import { useVault } from "@/components/vault-provider"

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  )
}

function Brand({ subtitle }: { subtitle: string }) {
  return (
    <div className="mb-8 flex flex-col items-center text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <ShieldCheck className="size-7" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Witness Protocol</h1>
      <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function Dots({ length, filled }: { length: number; filled: number }) {
  return (
    <div className="flex gap-4 justify-center mb-4" aria-hidden>
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={`w-3.5 h-3.5 rounded-full border-2 ${i < filled ? "bg-foreground border-foreground" : "border-border bg-transparent"}`}
        />
      ))}
    </div>
  )
}

function DialPad({ onPress, onDelete }: { onPress: (d: string) => void; onDelete: () => void }) {
  const layout = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"]
  return (
    <div className="grid grid-cols-3 gap-3" role="group" aria-label="dial pad">
      {layout.map((k, idx) => {
        if (k === "") return <div key={idx} className="h-16" />
        if (k === "del") {
          return (
            <button
              key={idx}
              type="button"
              onClick={onDelete}
              className="h-16 rounded-full bg-muted/50 flex items-center justify-center text-lg font-semibold"
              aria-label="delete"
            >
              ⌫
            </button>
          )
        }
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onPress(k)}
            className="h-16 rounded-full bg-muted/10 flex items-center justify-center text-lg font-semibold"
            aria-label={`digit ${k}`}
          >
            {k}
          </button>
        )
      })}
    </div>
  )
}

function SetupForm() {
  const { setupVault, busy } = useVault()
  const length = 6
  const [passcode, setPasscode] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [activeField, setActiveField] = React.useState<"pass" | "confirm">("pass")
  const [minutes, setMinutes] = React.useState(3)
  const [localError, setLocalError] = React.useState<string | null>(null)
  const [shake, setShake] = React.useState(false)

  React.useEffect(() => {
    if (shake) {
      const t = setTimeout(() => setShake(false), 400)
      return () => clearTimeout(t)
    }
  }, [shake])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError(null)
    if (passcode.length < length) {
      setLocalError(`Passcode must be at least ${length} digits.`)
      setShake(true)
      return
    }
    if (passcode !== confirm) {
      setLocalError("Passcodes do not match.")
      setShake(true)
      return
    }
    try {
      await setupVault(passcode, minutes)
    } catch {
      setLocalError("Could not create the vault on this device.")
    }
  }

  const onPress = (d: string) => {
    if (activeField === "pass") {
      if (passcode.length >= length) return
      setPasscode((s) => s + d)
    } else {
      if (confirm.length >= length) return
      setConfirm((s) => s + d)
    }
  }
  const onDelete = () => {
    if (activeField === "pass") setPasscode((s) => s.slice(0, -1))
    else setConfirm((s) => s.slice(0, -1))
  }

  return (
    <Shell>
      <Brand subtitle="Create a private vault passcode. It encrypts every record on this device and is never sent anywhere." />
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="autolock">Auto-lock after inactivity</Label>
          <div className="flex gap-2 mt-2">
            {[1, 3, 5, 10].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(m)}
                className={`flex-1 rounded-xl border px-2 py-2 text-sm font-medium transition-colors ${
                  minutes === m
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className={`text-sm font-medium ${activeField === "pass" ? "text-foreground" : "text-muted-foreground"}`}>Enter passcode</span>
            <button type="button" className="text-xs text-muted-foreground" onClick={() => setActiveField("pass")}>Edit</button>
          </div>
          <div className={`${shake && passcode !== confirm ? "animate-shake" : ""}`}>
            <Dots length={length} filled={passcode.length} />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className={`text-sm font-medium ${activeField === "confirm" ? "text-foreground" : "text-muted-foreground"}`}>Confirm passcode</span>
            <button type="button" className="text-xs text-muted-foreground" onClick={() => setActiveField("confirm")}>Edit</button>
          </div>
          <Dots length={length} filled={confirm.length} />
        </div>

        {localError ? <p className="text-sm text-destructive">{localError}</p> : null}

        <div className="pt-2">
          <DialPad onPress={onPress} onDelete={onDelete} />
        </div>

        <div className="flex gap-3">
          <Button type="submit" size="lg" className="flex-1" disabled={busy}>
            <KeyRound className="size-4" aria-hidden="true" />
            {busy ? "Creating vault…" : "Create secure vault"}
          </Button>
        </div>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          There is no recovery. If you forget this passcode, encrypted records cannot be opened.
        </p>
      </form>
    </Shell>
  )
}

function UnlockForm() {
  const { unlock, busy, error } = useVault()
  const length = 6
  const [passcode, setPasscode] = React.useState("")
  const [localError, setLocalError] = React.useState<string | null>(null)
  const [shake, setShake] = React.useState(false)

  React.useEffect(() => {
    if (passcode.length === length) {
      ;(async () => {
        const ok = await unlock(passcode)
        if (!ok) {
          setLocalError("Incorrect vault passcode.")
          setShake(true)
          setPasscode("")
        } else {
          setLocalError(null)
          setPasscode("")
        }
      })()
    }
  }, [passcode, length, unlock])

  React.useEffect(() => {
    if (shake) {
      const t = setTimeout(() => setShake(false), 400)
      return () => clearTimeout(t)
    }
  }, [shake])

  const onPress = (d: string) => {
    if (passcode.length >= length) return
    setPasscode((s) => s + d)
  }
  const onDelete = () => setPasscode((s) => s.slice(0, -1))

  return (
    <Shell>
      <Brand subtitle="Your vault is locked. Enter your passcode to decrypt your records on this device." />
      <div className="space-y-4">
        <div className={`${shake ? "animate-shake" : ""}`}> 
          <Dots length={length} filled={passcode.length} />
        </div>

        {localError || error ? <p className="text-sm text-destructive">{localError ?? error}</p> : null}

        <div className="pt-2">
          <DialPad onPress={onPress} onDelete={onDelete} />
        </div>

        <div className="flex gap-3 justify-center">
          <button
            type="button"
            className="text-sm text-muted-foreground"
            onClick={() => {
              // clear
              setPasscode("")
              setLocalError(null)
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </Shell>
  )
}

export function VaultGate({ children }: { children: React.ReactNode }) {
  const { status } = useVault()

  if (status === "loading") {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-sm">Preparing secure storage…</p>
        </div>
      </Shell>
    )
  }
  if (status === "uninitialized") return <SetupForm />
  if (status === "locked") return <UnlockForm />
  return <>{children}</>
}
