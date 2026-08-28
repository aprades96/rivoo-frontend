"use client"

import { LogOut, Scissors } from "lucide-react"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import { Progress } from "@/components/ui/progress"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { onboardingCardMaxWidthClass, useOnboardingStore } from "@/lib/stores/onboarding-store"

// Cada pagina sigue llamando a `setCurrentStep` (mantiene el store correcto
// para quien lo lea mas adelante y a los tests que lo comprueban), pero ese
// efecto corre DESPUES del montaje. El chasis no puede esperar a eso: entrar
// directo en /add-employee pintaria un frame al paso 1/2 (tarjeta de 640px,
// progreso al 20%) antes de saltar a los 760px/60% reales. Derivar el paso
// de la URL deja el primer pintado ya correcto.
const STEP_BY_PATHNAME: Record<string, number> = {
  "/welcome": 1,
  "/business-hours": 2,
  "/add-employee": 3,
  "/add-service": 4,
  "/complete": 5,
}

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const { currentStep: storeCurrentStep, totalSteps } = useOnboardingStore()
  const pathname = usePathname()
  const { logout } = useAuth()
  // Cae al valor del store solo para una ruta que no este en el mapa (no
  // deberia ocurrir dentro de este grupo de rutas), nunca como caso normal.
  const currentStep = STEP_BY_PATHNAME[pathname] ?? storeCurrentStep
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
