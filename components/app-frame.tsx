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

import * as React from "react"

import { AppShell } from "@/components/app-shell"
import { I18nProvider } from "@/components/i18n-provider"
import { PwaRegister } from "@/components/pwa-register"
import { VaultGate } from "@/components/vault-gate"
import { VaultProvider } from "@/components/vault-provider"
import { DiaryRecordingProvider } from "@/components/diary-recording-provider"
import { ExportProgressProvider } from "@/components/export-progress-provider"

export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <VaultProvider>
        <PwaRegister />
        <VaultGate>
          <ExportProgressProvider>
            <DiaryRecordingProvider>
              <AppShell>{children}</AppShell>
            </DiaryRecordingProvider>
          </ExportProgressProvider>
        </VaultGate>
      </VaultProvider>
    </I18nProvider>
  )
}
