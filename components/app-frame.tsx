"use client"

import * as React from "react"

import { AppShell } from "@/components/app-shell"
import { PwaRegister } from "@/components/pwa-register"
import { VaultGate } from "@/components/vault-gate"
import { VaultProvider } from "@/components/vault-provider"

export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <VaultProvider>
      <PwaRegister />
      <VaultGate>
        <AppShell>{children}</AppShell>
      </VaultGate>
    </VaultProvider>
  )
}
