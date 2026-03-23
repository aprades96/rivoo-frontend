"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import { WorkingHoursEditor } from "@/components/staff/working-hours-editor"
import { salonsApi } from "@/lib/api/salons"
import { useAuth } from "@/hooks/use-auth"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import type { BusinessHoursRequest } from "@/types/salon"

export default function OnboardingBusinessHoursPage() {
  const router = useRouter()
  const { accessToken } = useAuth()
  const { setCurrentStep } = useOnboardingStore()

  useEffect(() => {
    setCurrentStep(2)
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
      <button
        onClick={() => router.push("/welcome")}
        className="flex cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver
      </button>

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
        className="w-full cursor-pointer py-2 text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => router.push("/add-employee")}
      >
        Configurar mas tarde
      </button>
    </div>
  )
}
