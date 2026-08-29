"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { appointmentsApi } from "@/lib/api/appointments"
import { useAuth } from "@/hooks/use-auth"
import type { Appointment, AppointmentStatus, AppointmentListParams } from "@/types/appointment"
import type { Page } from "@/types/api"

/**
 * Cierto cuando lo UNICO que cambia entre dos consultas es la FECHA. Compara
 * la union de las claves de las dos, no una lista escrita a mano, para que un
 * filtro nuevo de `AppointmentListParams` entre solo por existir; todos sus
 * valores son primitivos, asi que `!==` basta.
 */
function differsOnlyByDate(
  previous: AppointmentListParams | undefined,
  next: AppointmentListParams
): boolean {
  if (!previous) return false

  const keys = new Set<keyof AppointmentListParams>([
    ...(Object.keys(previous) as (keyof AppointmentListParams)[]),
    ...(Object.keys(next) as (keyof AppointmentListParams)[]),
  ])
  keys.delete("date")

  for (const key of keys) {
    if (previous[key] !== next[key]) return false
  }
  return true
}

/**
 * `params` entra entero en la `queryKey`, `date` incluido, asi que cada dia es
 * una query propia. Prestar los datos de la consulta anterior es lo que evita
 * que avanzar de dia deje la pantalla en blanco: sin ello el dia nuevo arranca
 * sin datos, `isLoading` se pone a true, el calendario desmonta la rejilla y
 * monta el esqueleto, y al volver los datos el `overflow-y-auto` ha perdido el
 * scroll y reaparece en las 08:00. Ademas era ASIMETRICO -- hacia atras el dia
 * anterior seguia en cache (`staleTime`) y no parpadeaba, hacia delante si --,
 * que es lo que lo hacia desconcertante. Con datos prestados `isLoading` no se
 * levanta y el cambio de dia se nota en `isPlaceholderData`/`isFetching`, no
 * en un desmontaje.
 *
 * Pero el prestamo se acota a la DIMENSION DE LA FECHA, que es menos de lo que
 * presta `keepPreviousData`: la clave lleva TAMBIEN `employeeId`, y el
 * calendario lo cambia cada vez que se toca una pildora del filtro de movil
 * (`(app)/calendar/page.tsx`). Prestando entre empleados, `isLoading` tampoco
 * se levanta y la pantalla AFIRMA un dia que no ha comprobado: al entrar en
 * una empleada filtra por el id NUEVO la lista VIEJA y anuncia "Sin citas", y
 * al salir a "Todos" pinta un dia incompleto como si fuera completo -- con lo
 * que el recuadro "Libre" puede ofrecer una franja que las empleadas que
 * faltan ya tienen ocupada. Cambiar de filtro vuelve a la rama de carga, que
 * es lo unico cierto: todavia no se sabe.
 */
export function useAppointments(params: AppointmentListParams) {
  const { accessToken, isAuthenticated } = useAuth()

  return useQuery<Page<Appointment>>({
    queryKey: ["appointments", params],
    queryFn: () => appointmentsApi.list(params, accessToken!),
    enabled: isAuthenticated && !!accessToken,
    staleTime: 30 * 1000,
    placeholderData: (previousData, previousQuery) =>
      differsOnlyByDate(
        previousQuery?.queryKey[1] as AppointmentListParams | undefined,
        params
      )
        ? previousData
        : undefined,
  })
}

/**
 * La agenda de `/today`. Hereda el recorte de arriba y no le afecta: su clave
 * es ESTABLE -- no lleva `employeeId` y el resto de parametros son constantes
 * --, asi que entre dos renders no hay nada distinto que prestar; y el unico
 * cambio que puede darse, pasar de medianoche, es justo el de fecha, que
 * sigue prestando igual que antes.
 */
export function useTodayAppointments(date: string) {
  return useAppointments({ date, page: 0, size: 100 })
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      appointmentsApi.updateStatus(id, { status }, accessToken!),

    onMutate: async ({ id, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["appointments"] })

      // Snapshot previous state
      const previousQueries = queryClient.getQueriesData<Page<Appointment>>({
        queryKey: ["appointments"],
      })

      // Optimistic update: update status in all matching queries
      queryClient.setQueriesData<Page<Appointment>>(
        { queryKey: ["appointments"] },
        (old) => {
          if (!old) return old
          return {
            ...old,
            content: old.content.map((apt) =>
              apt.id === id ? { ...apt, status } : apt
            ),
          }
        }
      )

      return { previousQueries }
    },

    onError: (_err, _vars, context) => {
      // Revert optimistic update
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data)
        }
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
    },
  })
}

export function useCancelAppointment() {
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()

  return useMutation({
    mutationFn: ({
      id,
      reason,
      cancelledBy,
    }: {
      id: string
      reason?: string
      cancelledBy: "CLIENT" | "SALON"
    }) => appointmentsApi.cancel(id, { reason, cancelledBy }, accessToken!),

    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ["appointments"] })

      const previousQueries = queryClient.getQueriesData<Page<Appointment>>({
        queryKey: ["appointments"],
      })

      queryClient.setQueriesData<Page<Appointment>>(
        { queryKey: ["appointments"] },
        (old) => {
          if (!old) return old
          return {
            ...old,
            content: old.content.map((apt) =>
              apt.id === id ? { ...apt, status: "CANCELLED" as const } : apt
            ),
          }
        }
      )

      return { previousQueries }
    },

    onError: (_err, _vars, context) => {
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data)
        }
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
    },
  })
}
