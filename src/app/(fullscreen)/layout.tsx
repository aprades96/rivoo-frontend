"use client"

import type { ReactNode } from "react"
import { OnboardingGate } from "@/components/layout/onboarding-gate"

export default function FullscreenLayout({ children }: { children: ReactNode }) {
  return (
    <OnboardingGate>
      {/*
       * `min-h-dvh` (no `min-h-full`): el padre (`body`) solo fija
       * `min-height`, nunca `height`, asi que un `%` aqui no resuelve a nada
       * (regla CSS: un porcentaje de altura necesita que el contenedor tenga
       * una altura EXPLICITA, no un min-height) y el div se queda del alto de
       * su contenido. `dvh` es una unidad de viewport, no un porcentaje:
       * resuelve siempre. Mismo bug documentado en
       * `src/app/(onboarding)/layout.tsx:35-44`.
       */}
      <div className="flex min-h-dvh flex-col bg-background">{children}</div>
    </OnboardingGate>
  )
}
