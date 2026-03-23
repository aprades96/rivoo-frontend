"use client"

import { usePathname } from "next/navigation"
import { AppHeader } from "@/components/layout/app-header"
import { BottomNav } from "@/components/layout/bottom-nav"
import { FabButton } from "@/components/layout/fab-button"
import { OnboardingGate } from "@/components/layout/onboarding-gate"
import { useSwipeNavigation } from "@/hooks/use-swipe-navigation"
import type { ReactNode } from "react"

const FAB_ROUTES = ["/today", "/calendar"]

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const showFab = FAB_ROUTES.some((r) => pathname.startsWith(r))
  const { onTouchStart, onTouchEnd } = useSwipeNavigation()

  return (
    <OnboardingGate>
      <div
        className="flex min-h-full flex-col"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <AppHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 pb-20">{children}</main>
        {showFab && <FabButton />}
        <BottomNav />
      </div>
    </OnboardingGate>
  )
}
