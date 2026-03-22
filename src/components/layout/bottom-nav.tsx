"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarCheck, LayoutGrid, Users, Menu } from "lucide-react"

const tabs = [
  { href: "/today", label: "Hoy", icon: CalendarCheck },
  { href: "/calendar", label: "Citas", icon: LayoutGrid },
  { href: "/staff", label: "Equipo", icon: Users },
  { href: "/settings", label: "Mas", icon: Menu },
] as const

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-16 items-center justify-around">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
              {isActive && (
                <span className="h-1 w-1 rounded-full bg-primary" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
