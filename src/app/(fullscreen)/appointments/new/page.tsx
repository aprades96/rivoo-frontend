"use client"

import { Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { EmployeeStep } from "@/components/appointments/wizard/employee-step"
import { ServiceStep } from "@/components/appointments/wizard/service-step"
import { DateTimeStep } from "@/components/appointments/wizard/datetime-step"
import { ClientStep } from "@/components/appointments/wizard/client-step"
import { ConfirmationStep } from "@/components/appointments/wizard/confirmation-step"
import { useWizardStore } from "@/lib/stores/wizard-store"

/**
 * Dispatcher puro: CADA PASO monta su propio `NewAppointmentShell`
 * (`src/components/booking/public-employee-step.tsx:148,160-165` es el
 * patron -- construye su `aside`/`footer` y devuelve el chasis, ninguna
 * pagina lo monta). Si esta pagina montara el chasis, las cinco tareas de la
 * ola siguiente -- que corren JUNTAS -- tendrian que editarla cada una: cinco
 * propietarios de un fichero en una sola ola.
 *
 * `useSearchParams` exige su propio limite de `<Suspense>`: sin el, Next
 * trata la falta de limite como error de build para el GRUPO DE RUTAS
 * entero, no solo esta pagina (`src/components/layout/app-sidebar.tsx:12-18`,
 * ya resuelto en `src/app/(app)/staff/page.tsx:19-34`). Importa mas aqui: al
 * sacar esta ruta de `(app)`, `AppSidebar` -- que aportaba el unico limite de
 * ese grupo -- ya no se monta, y en `(fullscreen)` no queda ninguno.
 */
export default function NewAppointmentPage() {
  return (
    <Suspense fallback={null}>
      <NewAppointmentPageContent />
    </Suspense>
  )
}

function NewAppointmentPageContent() {
  const searchParams = useSearchParams()
  const { step, reset } = useWizardStore()

  const employeeId = searchParams.get("employeeId")
  const date = searchParams.get("date")
  const time = searchParams.get("time")
  // D26: `/clients/{id}` -> "Nueva cita" siembra el cliente. NO es simetrico
  // con los tres de arriba: aquellos son preferencias `string` que un paso
  // posterior resuelve contra una lista ya cargada; `client-step.tsx`
  // resuelve este id con su propia consulta (`clientsApi.getById`).
  const clientId = searchParams.get("clientId")

  // Siembra y arranca SIEMPRE en el paso 1. Esta pagina NO resuelve el
  // empleado: `selectedEmployee` guarda el `Employee` COMPLETO y su unica
  // fuente es `useEmployees`, que es asincrona -- en este efecto de montaje
  // todavia no ha resuelto. Lo hara el paso 1 de la ola siguiente, que ya
  // monta esa query. `rescheduleId` se ignora a proposito: ningun artboard
  // dibuja una variante de reprogramacion.
  useEffect(() => {
    reset({
      preferredEmployeeId: employeeId,
      preferredDate: date,
      // `selectedSlot` en el resto del store es un datetime local completo
      // ("2026-08-28T09:00:00", ver `datetime-step.test.tsx:58`) -- misma
      // forma aqui para que el paso 3 de la ola siguiente pueda comparar sin
      // reformatear.
      preferredSlot: date && time ? `${date}T${time}:00` : null,
      preferredClientId: clientId,
    })
  }, [reset, employeeId, date, time, clientId])

  return (
    <>
      {step === 1 && <EmployeeStep />}
      {step === 2 && <ServiceStep />}
      {step === 3 && <DateTimeStep />}
      {step === 4 && <ClientStep />}
      {step === 5 && <ConfirmationStep />}
    </>
  )
}
