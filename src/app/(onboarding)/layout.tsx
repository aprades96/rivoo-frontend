"use client"

import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import type { ReactNode } from "react"

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const { currentStep, totalSteps } = useOnboardingStore()

  return (
    <div className="flex min-h-full flex-col">
      {/* Progress bar */}
      <div className="sticky top-0 z-40 bg-background px-4 py-3 mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Paso {currentStep} de {totalSteps}</span>
          <span className="font-semibold text-primary">Rivoo</span>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl flex-1 p-4 md:py-6">{children}</main>
    </div>
  )
}
