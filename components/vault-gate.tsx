"use client"

import { ShieldCheck } from "lucide-react"
import * as React from "react"
import { useVault } from "@/components/vault-provider"
import { useRouter } from "next/navigation"

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
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function Dots({ length, filled }: { length: number; filled: number }) {
  return (
    <div className="flex gap-4 justify-center mb-4" aria-hidden>
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={`w-3.5 h-3.5 rounded-full border-2 ${
            i < filled ? "bg-foreground border-foreground" : "border-border bg-transparent"
          }`}
        />
      ))}
    </div>
  )
}

function DialPad({
  onPress,
  onDelete,
}: {
  onPress: (d: string) => void
  onDelete: () => void
}) {
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
  const [firstEntry, setFirstEntry] = React.useState("")
  const [confirming, setConfirming] = React.useState(false)
  
  const [localError, setLocalError] = React.useState<string | null>(null)
  const [shake, setShake] = React.useState(false)

  React.useEffect(() => {
    if (shake) {
      const t = setTimeout(() => setShake(false), 400)
      return () => clearTimeout(t)
    }
  }, [shake])


  const onPress = (d: string) => {
  if (passcode.length >= length) return

  const next = passcode + d
  setPasscode(next)

  if (next.length !== length) return

  if (!confirming) {
  setLocalError(null)
    setTimeout(() => {
      setFirstEntry(next)
      setPasscode("")
      setConfirming(true)
    }, 180)
    return
  }

  if (next !== firstEntry) {
    setLocalError("Passcodes do not match.")
    setShake(true)

    setTimeout(() => {
  setPasscode("")
  setFirstEntry("")
  setConfirming(false)
  setLocalError(null)
}, 1000)

    return
  }

  ;(async () => {
  try {
    setLocalError(null)
    setPasscode("")
    await setupVault(next)
  } catch {
    setLocalError("Could not create the vault.")
    setPasscode("")
    setFirstEntry("")
    setConfirming(false)
  }
})()
}

  const onDelete = () => {
  setPasscode((s) => s.slice(0, -1))
}

  return (
    <Shell>
      <Brand subtitle="Create a private vault passcode." />

      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
     
        

       <div className={shake ? "animate-shake" : ""}>
  <p className="mb-3 text-center text-sm font-medium text-muted-foreground">
    {confirming ? "Confirm your passcode" : "Create your passcode"}
  </p>

  <Dots
    length={length}
    filled={passcode.length}
  />
</div>

        {localError && <p className="text-sm text-destructive">{localError}</p>}

        <DialPad onPress={onPress} onDelete={onDelete} />

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

  return (
    <Shell>
      <Brand subtitle="Your vault is locked." />

      <div className={shake ? "animate-shake" : ""}>
        <Dots length={length} filled={passcode.length} />
      </div>

      {(localError || error) && (
        <p className="text-sm text-destructive">{localError ?? error}</p>
      )}

      <DialPad
        onPress={(d) => {
          if (passcode.length < length) setPasscode((s) => s + d)
        }}
        onDelete={() => setPasscode((s) => s.slice(0, -1))}
      />

      <button
        className="text-sm text-muted-foreground mt-4"
        onClick={() => {
          setPasscode("")
          setLocalError(null)
        }}
      >
        Clear
      </button>
    </Shell>
  )
}

  export function VaultGate({ children }: { children: React.ReactNode }) {
  const { status } = useVault()
  const router = useRouter()

  React.useEffect(() => {
    if (status === "unlocked" && window.location.pathname === "/") {
      router.replace("/incidents")
    }
  }, [status, router])

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