"use client"

import { Suspense } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { APP_NAV_ITEMS, type AppNavItem } from "@/lib/nav/app-nav"
import { SalonMark } from "@/components/brand/salon-mark"
import { UserCard } from "@/components/layout/user-card"
import { useSalon } from "@/hooks/use-salon"
import { cn } from "@/lib/utils"

/**
 * Desktop sidebar, `design/EquipoDesktop.dc.html:37-77`. The `(app)` layout
 * mounts this on all twelve of its routes, so `useSearchParams` (needed to
 * tell "Equipo" and "Servicios" apart on `/staff`) gets its own Suspense
 * boundary right here: without one, Next treats the missing boundary as a
 * build error for the whole route group, not just one page -- see
 * `src/app/(app)/staff/page.tsx:18-25`, which already paid for that once.
 *
 * `sticky top-0 h-dvh`: the artboard is a fixed 1440x900 frame with
 * `overflow: hidden`, so the sidebar's height there comes from the viewport
 * by construction. Without pinning it here, the `flex min-h-dvh` shell in
 * the layout stretches the `<aside>` to the *document* height, and on a
 * long page (e.g. `/clients` with fifty rows) the nav and the user card
 * scroll off screen.
 */
export function AppSidebar() {
  return (
    <aside className="sticky top-0 flex h-dvh w-[248px] shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar px-[14px] py-5">
      <div className="flex flex-col gap-[22px]">
        <Brand />
        <Suspense fallback={<NavList isActive={() => false} />}>
          <Nav />
        </Suspense>
      </div>
      <UserCard />
    </aside>
  )
}

function Brand() {
  const { data: salon, isLoading } = useSalon()

  return (
    <div className="flex min-w-0 items-center gap-[10px] px-2">
      <SalonMark className="size-[26px] shrink-0 text-sidebar-primary" />
      {isLoading ? (
        <span
          aria-hidden="true"
          className="h-[23px] w-24 animate-pulse rounded bg-sidebar-accent"
        />
      ) : (
        <span className="truncate font-heading text-[23px] font-semibold tracking-display">
          {salon?.name}
        </span>
      )}
    </div>
  )
}

function Nav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return (
    <NavList isActive={(item) => item.isActive(pathname, searchParams)} />
  )
}

function NavList({ isActive }: { isActive: (item: AppNavItem) => boolean }) {
  return (
    <ul className="flex flex-col gap-[3px]">
      {APP_NAV_ITEMS.map((item) => {
        const active = isActive(item)
        const Icon = item.icon

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-[10px] rounded-lg px-3 text-sm text-nav-foreground",
                active && "bg-sidebar-accent font-semibold text-sidebar-primary"
              )}
            >
              <Icon className="size-[18px]" strokeWidth={1.75} />
              {item.label}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
