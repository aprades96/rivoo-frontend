"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { WorkingHoursEditor, type WorkingHoursEditorHandle } from "@/components/staff/working-hours-editor"
import { salonsApi } from "@/lib/api/salons"
import { useAuth } from "@/hooks/use-auth"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { OnboardingFooter } from "../_components/onboarding-footer"
import type { BusinessHoursRequest } from "@/types/salon"

export default function OnboardingBusinessHoursPage() {
  const router = useRouter()
  const { accessToken } = useAuth()
  const { setCurrentStep } = useOnboardingStore()
  const editorRef = useRef<WorkingHoursEditorHandle>(null)

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
    onSuccess: () => toast.success("Horarios guardados"),
    onError: () => toast.error("Error al guardar horarios"),
  })

  // El editor no tiene boton propio en este paso (showSaveButton={false}):
  // "Continuar" guarda a traves del ref y solo navega si el guardado
  // resuelve. Si mutateAsync rechaza, el toast de error ya lo puso onError
  // de arriba y nos quedamos en el paso para que el usuario reintente -- no
  // hay `router.push` en la rama de error ni en `onError` de la mutacion.
  const handleContinue = async () => {
    try {
      await editorRef.current?.save()
      router.push("/add-employee")
    } catch {
      // No-op: se queda en el paso, el toast de error ya se disparo.
    }
  }

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
          ref={editorRef}
          hours={hoursQuery.data}
          onSave={(hours) => mutation.mutateAsync(hours)}
          isSaving={mutation.isPending}
          showSaveButton={false}
        />
      </div>

      {/*
        Sin boton "Omitir": el diseno no lo dibuja en este paso. Sin boton
        interno tampoco (showSaveButton={false}): el pie ya tiene su propio
        "Continuar", que guarda a traves de editorRef y solo avanza si el
        guardado resuelve (handleContinue, arriba).
      */}
      <OnboardingFooter
        ctaLabel="Continuar"
        onCta={handleContinue}
        ctaDisabled={mutation.isPending}
        ctaLoading={mutation.isPending}
      />
    </>
  )
}
