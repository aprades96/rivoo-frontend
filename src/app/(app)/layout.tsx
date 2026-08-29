"use client"

import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { BottomNav } from "@/components/layout/bottom-nav"
import { FabButton } from "@/components/layout/fab-button"
import { OnboardingGate } from "@/components/layout/onboarding-gate"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useSwipeNavigation } from "@/hooks/use-swipe-navigation"
import type { ReactNode } from "react"

const FAB_ROUTES = ["/today", "/calendar"]

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const showFab = FAB_ROUTES.some((r) => pathname.startsWith(r))
  const { onTouchStart, onTouchEnd } = useSwipeNavigation()

  // Desktop chassis: `design/EquipoDesktop.dc.html` -- fixed sidebar plus a
  // full-width main, no `AppHeader` (each screen paints its own top bar via
  // `PageShell`), no `BottomNav`/swipe (there is no bottom tab bar to swipe
  // between), and no `pb-20` (that gap only exists to clear the fixed bottom
  // nav). The FAB stays: it is the only way to reach `/appointments/new` on
  // `/today` and `/calendar` until those screens get their own CTA.
  if (isDesktop) {
    return (
      <OnboardingGate>
        <div className="flex min-h-dvh">
          <AppSidebar />
          <main className="flex min-w-0 flex-1 flex-col">{children}</main>
        </div>
        {showFab && <FabButton />}
      </OnboardingGate>
    )
  }

  return (
    <OnboardingGate>
      <div
        className="flex min-h-dvh flex-col"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <main className="mx-auto w-full max-w-3xl flex-1 pb-20">{children}</main>
        {showFab && <FabButton />}
        <BottomNav />
      </div>
    </OnboardingGate>
  )
}
