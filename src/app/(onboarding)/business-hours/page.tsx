"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { WorkingHoursEditor, type WorkingHoursEditorHandle } from "@/components/staff/working-hours-editor"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
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

      {/*
        No se monta el editor hasta que el GET resuelve: con `hours={undefined}`
        el bloque de sincronizacion de WorkingHoursEditor (linea ~82) adopta
        CUALQUIER respuesta posterior como "primera llegada", asi que una
        respuesta en vuelo pisaria lo que el usuario ya hubiese tecleado.
        Mismo patron que settings/business-hours/page.tsx.
      */}
      {hoursQuery.isLoading ? (
        <LoadingSkeleton count={7} />
      ) : (
        <WorkingHoursEditor
          ref={editorRef}
          hours={hoursQuery.data}
          onSave={(hours) => mutation.mutateAsync(hours)}
          isSaving={mutation.isPending}
          showSaveButton={false}
        />
      )}

      {/*
        Sin boton "Omitir": el diseno no lo dibuja en este paso. Sin boton
        interno tampoco (showSaveButton={false}): el pie ya tiene su propio
        "Continuar", que guarda a traves de editorRef y solo avanza si el
        guardado resuelve (handleContinue, arriba). Deshabilitado tambien
        mientras el horario todavia esta cargando: sin esto, pulsar antes de
        que el GET resuelva enviaria los valores por defecto del editor y
        pisaria el horario ya guardado.
      */}
      <OnboardingFooter
        ctaLabel="Continuar"
        onCta={handleContinue}
        ctaDisabled={hoursQuery.isLoading || mutation.isPending}
        ctaLoading={mutation.isPending}
      />
    </>
  )
}
