"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { PartyPopper, ArrowRight, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useSalon } from "@/hooks/use-salon"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"

export default function OnboardingCompletePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: salon } = useSalon()
  const { setCurrentStep, reset } = useOnboardingStore()

  useEffect(() => {
    setCurrentStep(6)
  }, [setCurrentStep])

  const handleGoToDashboard = () => {
    // Invalidate salon query so OnboardingGate re-checks status
    queryClient.invalidateQueries({ queryKey: ["salon"] })
    reset()
    router.push("/today")
  }

  const bookingUrl = salon
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/book/${salon.slug}`
    : null

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
        <PartyPopper className="h-10 w-10 text-green-600" />
      </div>

      <h1 className="text-2xl font-bold">Tu salon esta listo</h1>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Ya puedes empezar a gestionar tus citas y atender a tus clientes.
      </p>

      {/* Booking link */}
      {bookingUrl && (
        <Card className="mt-6 w-full max-w-xs p-4 text-left">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-medium">Tu pagina de reservas</p>
          </div>
          <p className="mt-1 break-all text-xs text-primary">{bookingUrl}</p>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Comparte este enlace con tus clientes para que reserven online.
          </p>
        </Card>
      )}

      <Button
        className="mt-8 w-full max-w-xs"
        size="lg"
        onClick={handleGoToDashboard}
      >
        Ir al dashboard
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  )
}
