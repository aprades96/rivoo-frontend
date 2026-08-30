"use client"

import { useCallback } from "react"
import { useQueries, type UseQueryResult } from "@tanstack/react-query"
import { appointmentsApi } from "@/lib/api/appointments"
import { useAuth } from "@/hooks/use-auth"
import type { AvailabilityResponse, AvailableSlot } from "@/types/appointment"

/**
 * Un hueco libre con el empleado al que pertenece. Vive AQUI, no en
 * `src/types/appointment.ts`: ese fichero refleja el JSON que manda el
 * backend (`AvailableSlot(LocalTime startTime, LocalTime endTime)`, sin
 * `employeeId` por hueco), y anadirselo alli mentiria sobre el contrato.
 * `employeeId` lo resuelve este hook al unir la disponibilidad de varios
 * empleados.
 */
export type WizardSlot = AvailableSlot & { employeeId: string }

export interface UseWizardAvailabilityParams {
  employeeIds: string[]
  serviceId: string | undefined
  date: string | undefined
}

/**
 * Disponibilidad agregada de uno o varios empleados para "Sin preferencia".
 *
 * `GET /api/v1/appointments/availability` exige `employeeId` y es por dia:
 * hoy el paso de fecha/hora del asistente manda literalmente `"any"` como
 * `employeeId` cuando el usuario elige "Sin preferencia" (`datetime-step.tsx`
 * antes de esta tarea), lo cual es un fallo real en produccion -- ese
 * `employeeId` no existe. Este hook lanza una peticion POR empleado y une los
 * resultados.
 *
 * `combine` va MEMORIZADO con `useCallback`, igual que
 * `useEmployeesWorkingHours` y `useEmployeesServices` (`use-staff.ts`):
 * `useQueries` cachea su resultado por `[results, combine]`, asi que con una
 * flecha inline -- nueva en cada render -- ese memo fallaba SIEMPRE.
 * `employeeIds` esta en las dependencias porque los huecos de cada query se
 * atribuyen POR POSICION (`results[index]`): con una lista distinta y el
 * `combine` viejo, un hueco se atribuiria al empleado equivocado.
 *
 * Los huecos se unen y se ordenan por `startTime`. Si dos empleados estan
 * libres a la misma hora, el mapa se queda con el PRIMERO de `employeeIds`
 * (determinista: se recorre la lista en orden y solo se escribe la primera
 * vez que aparece cada `startTime`) -- necesario porque `POST /appointments`
 * exige un unico `employeeId` por cita, no una lista de candidatos.
 *
 * Un empleado cuya peticion falla no tumba al resto: sus huecos, si los
 * hubiera, simplemente no entran en la union. `isLoading`/`isError` quedan
 * agregados (`some`) sobre todas las peticiones.
 */
export function useWizardAvailability({ employeeIds, serviceId, date }: UseWizardAvailabilityParams) {
  const { accessToken, isAuthenticated } = useAuth()
  const enabled = isAuthenticated && !!accessToken && !!date

  const combine = useCallback(
    (results: UseQueryResult<AvailabilityResponse, Error>[]) => {
      const byStartTime = new Map<string, WizardSlot>()

      employeeIds.forEach((employeeId, index) => {
        const response = results[index]?.data
        if (!response) return
        for (const slot of response.slots) {
          if (!byStartTime.has(slot.startTime)) {
            byStartTime.set(slot.startTime, { ...slot, employeeId })
          }
        }
      })

      const slots = Array.from(byStartTime.values()).sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      )

      return {
        slots,
        isLoading: results.some((result) => result.isLoading),
        isError: results.some((result) => result.isError),
      }
    },
    [employeeIds]
  )

  return useQueries({
    queries: employeeIds.map((employeeId) => ({
      queryKey: ["availability", employeeId, serviceId, date],
      queryFn: () =>
        appointmentsApi.getAvailability({ employeeId, date: date!, serviceId }, accessToken!),
      enabled,
    })),
    combine,
  })
}
