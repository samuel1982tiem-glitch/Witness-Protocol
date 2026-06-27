"use client"

import {
  Activity,
  Lock,
  Plus,
  ScrollText,
  ShieldCheck,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import * as React from "react"

import { InstallPrompt } from "@/components/install-prompt"
import { useVault } from "@/components/vault-provider"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/incidents", label: "Records", icon: ScrollText },
  { href: "/patterns", label: "Patterns", icon: Activity },
  { href: "/vault", label: "Vault", icon: ShieldCheck },
] as const

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { lock } = useVault()
  const showFab =
  pathname !== "/log" &&
  pathname !== "/incident"

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-5 py-3.5 backdrop-blur">
        <Link href="/incidents" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-4.5" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Witness Protocol
          </span>
        </Link>
        <button
          type="button"
          onClick={lock}
          className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-border"
        >
          <Lock className="size-3.5" aria-hidden="true" />
          Lock
        </button>
      </header>

      <main className="flex-1 px-5 pb-28 pt-5">
        <InstallPrompt />
        {children}
      </main>

      {showFab ? (
        <button
          type="button"
          aria-label="Log new incident"
          onClick={() => router.push("/log")}
          className="fixed bottom-24 left-1/2 z-30 flex size-15 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95"
          style={{ width: "3.5rem", height: "3.5rem" }}
        >
          <Plus className="size-7" aria-hidden="true" />
        </button>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t border-border bg-background/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="flex items-stretch justify-around">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
