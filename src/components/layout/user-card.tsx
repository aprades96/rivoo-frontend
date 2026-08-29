"use client"

import { useAuth } from "@/hooks/use-auth"
import type { UserRole } from "@/types/auth"

// UserRole carries no gender, so the label stays neutral instead of
// guessing one from the person's name (see design/EquipoDesktop.dc.html:75,
// whose "Propietaria" only fits its example user, Maria).
const ROLE_LABELS: Record<UserRole, string> = {
  ROLE_SALON_OWNER: "Titular del salon",
  ROLE_EMPLOYEE: "Equipo",
  ROLE_PLATFORM_ADMIN: "Plataforma",
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) {
    return ""
  }
  if (words.length === 1) {
    return words[0]!.charAt(0).toUpperCase()
  }
  const first = words[0]!.charAt(0)
  const last = words[words.length - 1]!.charAt(0)
  return (first + last).toUpperCase()
}

export function UserCard() {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  return (
    <div className="flex items-center gap-[10px] rounded-[10px] border border-border bg-card p-[10px]">
      <div className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-accent-foreground">
        {getInitials(user.name)}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-[13px] font-semibold">{user.name}</span>
        <span className="text-[11px] text-muted-foreground-2">
          {ROLE_LABELS[user.role]}
        </span>
      </div>
    </div>
  )
}
