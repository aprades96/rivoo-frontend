"use client"

import Link from "next/link"
import { ChevronRight, Store, Clock, CreditCard, Globe, User, LogOut } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { PageShell } from "@/components/layout/page-shell"
import { useAuth } from "@/hooks/use-auth"

const menuItems = [
  { href: "/settings/salon", label: "Perfil del salon", icon: Store },
  { href: "/settings/business-hours", label: "Horarios", icon: Clock },
  { href: "/settings/billing", label: "Facturacion y plan", icon: CreditCard },
  { href: "/settings/booking", label: "Reservas online", icon: Globe },
  { href: "/settings/account", label: "Mi cuenta", icon: User },
] as const

export default function SettingsPage() {
  const { logout } = useAuth()

  return (
    <PageShell title="Ajustes">
      <div className="space-y-1">
        {menuItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center justify-between rounded-lg px-3 py-3 text-sm transition-colors hover:bg-muted"
          >
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span>{label}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
        <Separator className="my-2" />
        <button
          onClick={logout}
          className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-sm text-destructive transition-colors hover:bg-muted"
        >
          <LogOut className="h-4 w-4" />
          <span>Cerrar sesion</span>
        </button>
      </div>
    </PageShell>
  )
}
