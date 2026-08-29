"use client"

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { appointmentsApi } from "@/lib/api/appointments"
import { useAuth } from "@/hooks/use-auth"
import type { Appointment, AppointmentStatus, AppointmentListParams } from "@/types/appointment"
import type { Page } from "@/types/api"

/**
 * `params` entra entero en la `queryKey`, `date` incluido, asi que cada dia es
 * una query propia. `keepPreviousData` es lo que evita que avanzar de dia deje
 * la pantalla en blanco: sin el, el dia nuevo arranca sin datos, `isLoading`
 * se pone a true, el calendario desmonta la rejilla y monta el esqueleto, y al
 * volver los datos el `overflow-y-auto` ha perdido el scroll y reaparece en
 * las 08:00. Ademas era ASIMETRICO -- hacia atras el dia anterior seguia en
 * cache (`staleTime`) y no parpadeaba, hacia delante si --, que es lo que lo
 * hacia desconcertante. Con datos previos `isLoading` ya no se levanta y el
 * cambio de dia se nota en `isPlaceholderData`/`isFetching`, no en un
 * desmontaje.
 */
export function useAppointments(params: AppointmentListParams) {
  const { accessToken, isAuthenticated } = useAuth()

  return useQuery<Page<Appointment>>({
    queryKey: ["appointments", params],
    queryFn: () => appointmentsApi.list(params, accessToken!),
    enabled: isAuthenticated && !!accessToken,
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  })
}

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
