"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Scissors } from "lucide-react"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { OnboardingFooter } from "../_components/onboarding-footer"

const CHECKLIST = [
  { number: 1, label: "Horarios de apertura" },
  { number: 2, label: "Tu primer empleado" },
  { number: 3, label: "Tu primer servicio" },
]

export default function WelcomePage() {
  const router = useRouter()
  const { setCurrentStep } = useOnboardingStore()

  useEffect(() => {
    setCurrentStep(1)
  }, [setCurrentStep])

  return (
    <>
      <div className="flex flex-col items-center gap-[22px] text-center">
        <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-accent md:h-[88px] md:w-[88px]">
          <Scissors strokeWidth={2.5} className="size-9 text-primary md:size-[42px]" />
        </div>

        <div className="flex flex-col gap-[7px]">
          <h1 className="font-heading text-[27px] font-semibold leading-[1.1] tracking-display md:text-[32px]">
            Bienvenido a Rivoo
          </h1>
          <p className="max-w-[330px] text-[13px] leading-[1.5] text-muted-foreground md:text-[14px]">
            Configura tu salon en unos minutos y empieza a gestionar tus citas.
          </p>
        </div>

        <div className="flex flex-col gap-3 text-left">
          {CHECKLIST.map((step) => (
            <div key={step.number} className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary">
                {step.number}
              </div>
              <span className="text-sm">{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      <OnboardingFooter ctaLabel="Comencemos" onCta={() => router.push("/business-hours")} />
    </>
  )
}
