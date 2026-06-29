"use client"

import {
  Lock,
  ShieldCheck,
  Timer,
  User,
  IdCard,
  Building2,
  Phone,
  Mail,
} from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardBody } from "@/components/ui/primitives"
import { useVault } from "@/components/vault-provider"

export default function VaultPage() {
  const {
    status,
    autoLockMs,
    lock,
    exportBackup,
    importBackup,
  } = useVault()

  const autoLockMin = Math.round(autoLockMs / 60000)

  const [profile, setProfile] = React.useState({
    name: "",
    governmentId: "",
    organization: "",
    phone: "",
    email: "",
  })

  async function handleExport() {
    try {
      const fileName = await exportBackup()
      alert(`Backup saved:\n${fileName}`)
    } catch (err) {
      console.error(err)
      alert(String(err))
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    await importBackup(file)

    event.target.value = ""
  }

  return (
    <div className="space-y-5">

      <Card>
        <CardBody className="space-y-5">

          <div className="flex items-center gap-2">
            <User className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Identity</h2>
          </div>

          <Field
            icon={<User className="size-4" />}
            placeholder="Full name"
            value={profile.name}
            onChange={(v) =>
              setProfile((p) => ({ ...p, name: v }))
            }
          />

          <Field
            icon={<IdCard className="size-4" />}
            placeholder="Government ID"
            value={profile.governmentId}
            onChange={(v) =>
              setProfile((p) => ({ ...p, governmentId: v }))
            }
          />

          <Field
            icon={<Building2 className="size-4" />}
            placeholder="Organization"
            value={profile.organization}
            onChange={(v) =>
              setProfile((p) => ({ ...p, organization: v }))
            }
          />

          <Field
            icon={<Phone className="size-4" />}
            placeholder="Phone"
            value={profile.phone}
            onChange={(v) =>
              setProfile((p) => ({ ...p, phone: v }))
            }
          />

          <Field
            icon={<Mail className="size-4" />}
            placeholder="Email"
            value={profile.email}
            onChange={(v) =>
              setProfile((p) => ({ ...p, email: v }))
            }
          />

          <Button
            className="w-full"
            disabled
          >
            Save Identity (coming soon)
          </Button>

        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">

          <div className="flex items-start gap-3">
            <Timer className="mt-1 size-4 text-primary" />
            <div>
              <p className="font-medium">
                Inactivity auto-lock
              </p>

              <p className="text-sm text-muted-foreground">
                Vault locks automatically after {autoLockMin} minute
                {autoLockMin === 1 ? "" : "s"}.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            disabled={status !== "unlocked"}
            onClick={lock}
          >
            <Lock className="size-4" />
            Lock vault now
          </Button>

        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">

          <Button
            className="w-full"
            onClick={handleExport}
          >
            Export Backup
          </Button>

          <input
            id="backup-import"
            type="file"
            accept=".wpb"
            className="hidden"
            onChange={handleImport}
          />

          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              document.getElementById("backup-import")?.click()
            }
          >
            Import Backup
          </Button>

        </CardBody>
      </Card>

    </div>
  )
}

function Field({
  icon,
  placeholder,
  value,
  onChange,
}: {
  icon: React.ReactNode
  placeholder: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border px-3 py-2">
      <span className="text-muted-foreground">
        {icon}
      </span>

      <input
        className="w-full bg-transparent outline-none"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}