"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Scissors, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"

export default function WelcomePage() {
  const router = useRouter()
  const { setCurrentStep } = useOnboardingStore()

  useEffect(() => {
    setCurrentStep(1)
  }, [setCurrentStep])

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <Scissors className="h-10 w-10 text-primary" />
      </div>

      <h1 className="text-2xl font-bold">Bienvenido a Rivoo</h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Configura tu salon en unos minutos y empieza a gestionar tus citas.
      </p>

      <div className="mt-8 space-y-3 text-left">
        <Step number={1} label="Datos del salon" />
        <Step number={2} label="Horarios de apertura" />
        <Step number={3} label="Tu equipo y servicios" />
      </div>

      <Button
        className="mt-8 w-full max-w-xs"
        size="lg"
        onClick={() => router.push("/salon-setup")}
      >
        Comencemos
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}

function Step({ number, label }: { number: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {number}
      </div>
      <span className="text-sm">{label}</span>
    </div>
  )
}
