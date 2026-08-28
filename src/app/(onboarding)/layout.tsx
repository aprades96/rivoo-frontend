"use client"

import { LogOut, Scissors } from "lucide-react"
import type { ReactNode } from "react"
import { Progress } from "@/components/ui/progress"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { onboardingCardMaxWidthClass, useOnboardingStore } from "@/lib/stores/onboarding-store"

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const { currentStep, totalSteps } = useOnboardingStore()
  const { logout } = useAuth()
  const progressValue = (currentStep / totalSteps) * 100

  return (
    <div className="flex min-h-full flex-col gap-[18px] bg-background px-4 py-[18px] md:items-center md:gap-0 md:px-10 md:py-11">
      {/* Bloque de marca: solo escritorio, fuera de la tarjeta */}
      <div className="hidden items-center gap-[11px] md:mb-[26px] md:flex">
        <Scissors size={26} strokeWidth={2.5} className="text-primary" />
        <span className="font-heading text-[22px] font-semibold tracking-display">Rivoo</span>
      </div>

      <div
        className={cn(
          "flex w-full flex-1 flex-col gap-[18px] md:flex-none md:gap-[22px] md:rounded-[12px] md:border md:border-border md:bg-card md:p-8",
          onboardingCardMaxWidthClass(currentStep)
        )}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs tabular-nums text-muted-foreground">
              Paso {currentStep} de {totalSteps}
            </span>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-primary md:hidden">Rivoo</span>
              <div className="h-3 w-px bg-switch-off md:hidden" />
              <button
                type="button"
                onClick={logout}
                className="flex cursor-pointer items-center gap-[5px] text-xs text-muted-foreground-2 hover:text-foreground"
              >
                <LogOut size={13} strokeWidth={1.75} />
                Salir
              </button>
            </div>
          </div>
          <Progress value={progressValue} />
        </div>

        {children}
      </div>
    </div>
  )
}
