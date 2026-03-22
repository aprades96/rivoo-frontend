"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSalon } from "@/hooks/use-salon"
import { useAuth } from "@/hooks/use-auth"
import { Loader2 } from "lucide-react"
import type { ReactNode } from "react"

export function OnboardingGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { data: salon, isLoading: salonLoading, error } = useSalon()

  useEffect(() => {
    if (authLoading || salonLoading) return

    // If salon doesn't exist or status is ONBOARDING, redirect to onboarding
    if (!salon || salon.status === "ONBOARDING") {
      router.replace("/welcome")
      return
    }

    // If salon is suspended/deactivated, could show a special page
    // For now, let them through — the backend will return 403 on API calls
  }, [authLoading, salonLoading, salon, router])

  // Show loading while checking auth + salon status
  if (authLoading || (isAuthenticated && salonLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // If we got an error fetching salon (404 = no salon yet), redirect handled by useEffect
  if (error && !salon) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <>{children}</>
}
