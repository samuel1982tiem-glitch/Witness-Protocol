"use client"

import { KeyRound, Lock, ShieldCheck } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input, Label } from "@/components/ui/primitives"
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
      <h1 className="mt-4 text-xl font-semibold tracking-tight">
        Witness Protocol
      </h1>
      <p className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground">
        {subtitle}
      </p>
    </div>
  )
}

function SetupForm() {
  const { setupVault, busy } = useVault()
  const [passcode, setPasscode] = React.useState("")
  const [confirm, setConfirm] = React.useState("")
  const [minutes, setMinutes] = React.useState(3)
  const [localError, setLocalError] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError(null)
    if (passcode.length < 6) {
      setLocalError("Passcode must be at least 6 characters.")
      return
    }
    if (passcode !== confirm) {
      setLocalError("Passcodes do not match.")
      return
    }
    try {
      await setupVault(passcode, minutes)
    } catch {
      setLocalError("Could not create the vault on this device.")
    }
  }

  return (
    <Shell>
      <Brand subtitle="Create a private vault passcode. It encrypts every record on this device and is never sent anywhere." />
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="passcode">Vault passcode</Label>
          <Input
            id="passcode"
            type="password"
            autoComplete="new-password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="At least 6 characters"
          />
        </div>
        <div>
          <Label htmlFor="confirm">Confirm passcode</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter passcode"
          />
        </div>
        <div>
          <Label htmlFor="autolock">Auto-lock after inactivity</Label>
          <div className="flex gap-2">
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
        {localError ? (
          <p className="text-sm text-destructive">{localError}</p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          <KeyRound className="size-4" aria-hidden="true" />
          {busy ? "Creating vault…" : "Create secure vault"}
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          There is no recovery. If you forget this passcode, encrypted records
          cannot be opened.
        </p>
      </form>
    </Shell>
  )
}

function UnlockForm() {
  const { unlock, busy, error } = useVault()
  const [passcode, setPasscode] = React.useState("")
  const [localError, setLocalError] = React.useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError(null)
    const ok = await unlock(passcode)
    if (!ok) setLocalError("Incorrect vault passcode.")
    else setPasscode("")
  }

  return (
    <Shell>
      <Brand subtitle="Your vault is locked. Enter your passcode to decrypt your records on this device." />
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="unlock-passcode">Vault passcode</Label>
          <Input
            id="unlock-passcode"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Enter passcode"
          />
        </div>
        {localError || error ? (
          <p className="text-sm text-destructive">{localError ?? error}</p>
        ) : null}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          <Lock className="size-4" aria-hidden="true" />
          {busy ? "Unlocking…" : "Unlock vault"}
        </Button>
      </form>
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
