"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { WorkingHoursEditor } from "@/components/staff/working-hours-editor"
import { salonsApi } from "@/lib/api/salons"
import { useAuth } from "@/hooks/use-auth"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { Button } from "@/components/ui/button"
import type { BusinessHoursRequest } from "@/types/salon"

export default function OnboardingBusinessHoursPage() {
  const router = useRouter()
  const { accessToken } = useAuth()
  const { setCurrentStep } = useOnboardingStore()

  useEffect(() => {
    setCurrentStep(3)
  }, [setCurrentStep])

  const mutation = useMutation({
    mutationFn: (hours: BusinessHoursRequest[]) =>
      salonsApi.updateBusinessHours(hours, accessToken!),
    onSuccess: () => {
      toast.success("Horarios guardados")
      router.push("/add-employee")
    },
    onError: () => toast.error("Error al guardar horarios"),
  })

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Horarios de apertura</h2>
        <p className="text-sm text-muted-foreground">
          Configura los dias y horas en que abres
        </p>
      </div>

      <WorkingHoursEditor
        hours={undefined}
        onSave={(hours) => mutation.mutateAsync(hours)}
        isSaving={mutation.isPending}
      />

      <button
        className="w-full py-2 text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => router.push("/add-employee")}
      >
        Configurar mas tarde
      </button>
    </div>
  )
}
