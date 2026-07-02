"use client"

import * as React from "react"

import { AppShell } from "@/components/app-shell"
import { I18nProvider } from "@/components/i18n-provider"
import { PwaRegister } from "@/components/pwa-register"
import { VaultGate } from "@/components/vault-gate"
import { VaultProvider } from "@/components/vault-provider"

export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <VaultProvider>
        <PwaRegister />
        <VaultGate>
          <AppShell>{children}</AppShell>
        </VaultGate>
      </VaultProvider>
    </I18nProvider>
  )
}
