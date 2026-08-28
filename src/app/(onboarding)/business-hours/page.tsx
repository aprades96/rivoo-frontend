"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { WorkingHoursEditor, type WorkingHoursEditorHandle } from "@/components/staff/working-hours-editor"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
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

  // Derived from the absence of data, not from `isLoading`: a disabled query
  // (no accessToken yet, half-alive session per use-auth.ts:22-27) reports
  // `isLoading: false` in React Query v5 (`isLoading = isPending &&
  // isFetching`, node_modules/@tanstack/query-core/build/modern/
  // queryObserver.js:310), so `isLoading` alone would let a hard load of this
  // page slip through the window below with `hoursQuery.data` still
  // undefined -- mounting the editor on its defaults and leaving "Continuar"
  // enabled, exactly what the comment two blocks down says this guards
  // against.
  const hoursNotReady = !accessToken || hoursQuery.data === undefined

  // `hoursNotReady` alone stays true forever after a failed GET (`retry:
  // failureCount < 1` in query-provider.tsx caps it at one retry, then
  // `data` never stops being undefined): the skeleton above would render
  // forever with no way to recover. `hoursFailed` singles out that terminal
  // case so it gets its own screen with a retry action instead of an
  // infinite skeleton. Requires accessToken: a disabled query (half-alive
  // session) is not an error, just not-yet-run.
  const hoursFailed = !!accessToken && hoursQuery.isError

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
      <div className="flex flex-col gap-[5px] md:gap-1.5">
        <h1 className="font-heading text-[26px] font-semibold leading-[1.12] tracking-display md:text-[32px] md:leading-[1.08]">
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
      {hoursFailed ? (
        <EmptyState
          title="No se ha podido cargar tu horario"
          description="Comprueba tu conexion e intentalo de nuevo."
          action={<Button onClick={() => hoursQuery.refetch()}>Reintentar</Button>}
        />
      ) : hoursNotReady ? (
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
        mientras el horario todavia esta cargando o si la carga fallo
        (`hoursNotReady` cubre ambos: `data` sigue undefined en los dos
        casos): el editor no esta montado, asi que editorRef.current seria
        null y handleContinue avanzaria de paso sin guardar nada. La salida
        de esta pantalla cuando la carga falla no es "Continuar a ciegas",
        es "Reintentar" (arriba) o el "Salir" que el layout del asistente ya
        pinta siempre, fuera de este componente (src/app/(onboarding)/layout.tsx).
      */}
      <OnboardingFooter
        ctaLabel="Continuar"
        onCta={handleContinue}
        ctaDisabled={hoursNotReady || mutation.isPending}
        ctaLoading={mutation.isPending}
      />
    </>
  )
}
