"use client"

// Witness Protocol
// Copyright (C) 2026 Samuel Matias Tiem
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { ShieldCheck, ScrollText, Mic, Activity, Lock } from "lucide-react"
import * as React from "react"
import { useVault } from "@/components/vault-provider"
import { useI18n } from "@/components/i18n-provider"
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

function OnboardingCarousel({ onDone }: { onDone: () => void }) {
  const { t } = useI18n()
  const scrollerRef = React.useRef<HTMLDivElement>(null)
  const [index, setIndex] = React.useState(0)

  const slides = [
    { Icon: Lock, title: t("onboarding.welcomeTitle"), body: t("onboarding.welcomeBody") },
    { Icon: ScrollText, title: t("onboarding.recordsTitle"), body: t("onboarding.recordsBody") },
    { Icon: Mic, title: t("onboarding.diaryTitle"), body: t("onboarding.diaryBody") },
    { Icon: Activity, title: t("onboarding.patternsTitle"), body: t("onboarding.patternsBody") },
    { Icon: ShieldCheck, title: t("onboarding.vaultTitle"), body: t("onboarding.vaultBody") },
  ]

  function handleScroll() {
    const el = scrollerRef.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    setIndex(Math.max(0, Math.min(slides.length - 1, i)))
  }

  function goTo(i: number) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" })
  }

  const isLast = index === slides.length - 1

  return (
    <Shell>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={onDone}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {t("onboarding.skip")}
        </button>
      </div>

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s, i) => (
          <div key={i} className="w-full shrink-0 snap-center px-1">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex size-20 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                <s.Icon className="size-10" aria-hidden="true" />
              </div>
              <h2 className="mb-2 text-lg font-semibold">{s.title}</h2>
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Dots length={slides.length} filled={index + 1} />
      </div>

      <div className="mt-4">
        {isLast ? (
          <button
            type="button"
            onClick={onDone}
            className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground"
          >
            {t("onboarding.getStarted")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            className="w-full rounded-full bg-muted py-3 text-sm font-semibold text-foreground"
          >
            {t("onboarding.next")}
          </button>
        )}
      </div>
    </Shell>
  )
}

function SetupForm() {
  const { setupVault, busy } = useVault()
  const { t } = useI18n()

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
    setLocalError(t("vault.passcodesDoNotMatch"))
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
    setLocalError(t("vault.couldNotCreateVault"))
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
    {confirming ? t("vault.confirmPasscode") : t("vault.createPasscode")}
  </p>

  <Dots
    length={length}
    filled={passcode.length}
  />
</div>

        {localError && <p className="text-center text-sm text-destructive">{localError}</p>}

        <DialPad onPress={onPress} onDelete={onDelete} />

      </form>
    </Shell>
  )
}

function UnlockForm() {
  const { unlock } = useVault()
  const { t } = useI18n()

  const length = 6
  const [passcode, setPasscode] = React.useState("")
  const [localError, setLocalError] = React.useState<string | null>(null)
  const [shake, setShake] = React.useState(false)

  React.useEffect(() => {
    if (passcode.length === length) {
      ;(async () => {
        const ok = await unlock(passcode)
        if (!ok) {
          setLocalError(t("vault.incorrectPasscode"))
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

      {/* Error text intentionally suppressed on unlock — the dot-row
          shake animation (see animate-shake above) is the only feedback
          for a wrong PIN, so we don't reveal anything via text. */}

      <DialPad
        onPress={(d) => {
          if (passcode.length < length) setPasscode((s) => s + d)
        }}
        onDelete={() => setPasscode((s) => s.slice(0, -1))}
      />
    </Shell>
  )
}

  export function VaultGate({ children }: { children: React.ReactNode }) {
  const { status } = useVault()
  const router = useRouter()
  const [introDismissed, setIntroDismissed] = React.useState(false)

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

  if (status === "uninitialized") {
    if (!introDismissed) {
      return <OnboardingCarousel onDone={() => setIntroDismissed(true)} />
    }
    return <SetupForm />
  }
  if (status === "locked") return <UnlockForm />

  return <>{children}</>
}