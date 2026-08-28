"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { WorkingHoursEditor } from "@/components/staff/working-hours-editor"
import { salonsApi } from "@/lib/api/salons"
import { useAuth } from "@/hooks/use-auth"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { OnboardingFooter } from "../_components/onboarding-footer"
import type { BusinessHoursRequest } from "@/types/salon"

export default function OnboardingBusinessHoursPage() {
  const router = useRouter()
  const { accessToken } = useAuth()
  const { setCurrentStep } = useOnboardingStore()

  useEffect(() => {
    setCurrentStep(2)
  }, [setCurrentStep])

  // Precarga real: sin esto WorkingHoursEditor siempre partia de sus valores
  // por defecto porque recibia `hours={undefined}` a propósito. La misma
  // queryKey que src/app/(app)/settings/business-hours/page.tsx:20, asi
  // comparten cache en vez de disparar dos GET distintos.
  const hoursQuery = useQuery({
    queryKey: ["salon-business-hours"],
    queryFn: () => salonsApi.getBusinessHours(accessToken!),
    enabled: !!accessToken,
  })

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
    <>
      <div className="flex flex-col gap-[5px]">
        <h1 className="font-heading text-[26px] font-semibold leading-[1.12] tracking-display md:text-[32px]">
          Horarios de apertura
        </h1>
        <p className="text-[13px] leading-[1.5] text-muted-foreground md:hidden">
          La reserva online solo ofrecera huecos dentro de este horario.
        </p>
        <p className="hidden text-[14px] leading-[1.5] text-muted-foreground md:block">
          La reserva online solo ofrecera huecos dentro de este horario. Podras cambiarlo luego en
          Ajustes.
        </p>
      </div>

      <div className="overflow-hidden rounded-[12px] border border-border bg-white">
        <WorkingHoursEditor
          hours={hoursQuery.data}
          onSave={(hours) => mutation.mutateAsync(hours)}
          isSaving={mutation.isPending}
        />
      </div>

      {/*
        Sin boton "Omitir": el diseno no lo dibuja en este paso, y con el
        horario ya precargado, "Continuar" es un no-op valido -- solo avanza.
        Guardar cambios sigue siendo el boton interno de WorkingHoursEditor
        (fuera de alcance: no se toca ese componente).
      */}
      <OnboardingFooter ctaLabel="Continuar" onCta={() => router.push("/add-employee")} />
    </>
  )
}
