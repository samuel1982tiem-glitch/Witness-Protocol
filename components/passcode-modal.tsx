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
            <button key={idx} type="button" onClick={onDelete}
              className="h-16 rounded-full bg-muted/50 flex items-center justify-center text-lg font-semibold">
              ⌫
            </button>
          )
        }
        return (
          <button key={idx} type="button" onClick={() => onPress(k)}
            className="h-16 rounded-full bg-muted/10 flex items-center justify-center text-lg font-semibold">
            {k}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Modal keypad prompt matching the vault unlock screen's design.
 * Used for import backup passcode entry instead of window.prompt().
 */
export function PasscodeModal({
  open,
  title,
  subtitle,
  onSubmit,
  onCancel,
}: {
  open: boolean
  title: string
  subtitle?: string
  onSubmit: (passcode: string) => void
  onCancel: () => void
}) {
  const length = 6
  const [passcode, setPasscode] = React.useState("")

  React.useEffect(() => {
    if (!open) setPasscode("")
  }, [open])

  React.useEffect(() => {
    if (passcode.length === length) {
      const code = passcode
      setPasscode("")
      onSubmit(code)
    }
  }, [passcode, length, onSubmit])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5">
      <div className="w-full max-w-sm rounded-2xl bg-background p-6">
        <p className="mb-1 text-center text-base font-semibold">{title}</p>
        {subtitle ? (
          <p className="mb-4 text-center text-sm text-muted-foreground">{subtitle}</p>
        ) : null}

        <Dots length={length} filled={passcode.length} />

        <DialPad
          onPress={(d) => {
            if (passcode.length < length) setPasscode((s) => s + d)
          }}
          onDelete={() => setPasscode((s) => s.slice(0, -1))}
        />

        <button
          type="button"
          className="mt-4 w-full text-center text-sm text-muted-foreground"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
