"use client"

import { useQueries, useQuery } from "@tanstack/react-query"
import { staffApi } from "@/lib/api/staff"
import { useAuth } from "@/hooks/use-auth"
import type { Employee, WorkingHoursResponse } from "@/types/employee"
import type { ServiceOffering } from "@/types/service"
import type { Page } from "@/types/api"

export function useEmployees() {
  const { accessToken, isAuthenticated } = useAuth()

  return useQuery<Page<Employee>>({
    queryKey: ["employees"],
    queryFn: () => staffApi.listEmployees(accessToken!),
    enabled: isAuthenticated && !!accessToken,
  })
}

export function useServices() {
  const { accessToken, isAuthenticated } = useAuth()

  return useQuery<Page<ServiceOffering>>({
    queryKey: ["services"],
    queryFn: () => staffApi.listServices(accessToken!),
    enabled: isAuthenticated && !!accessToken,
  })
}

/**
 * Los horarios de varios empleados a la vez, indexados por id.
 *
 * El descanso del calendario es POR EMPLEADO, no del salon: el artboard lo
 * pinta solo en la columna de Laura (`design/CalendarioDesktop.dc.html:177`),
 * asi que la rejilla necesita una peticion por columna y `useQueries` es la
 * unica forma de lanzar un numero variable de queries sin romper las reglas de
 * los hooks.
 *
 * `queryKey` replica EXACTAMENTE la de la ficha de empleado
 * (`src/app/(app)/staff/[id]/page.tsx:58`) para compartir cache con ella: al
 * abrir la ficha desde el calendario los horarios ya estan cargados, y al
 * guardarlos alli el calendario se invalida solo.
 *
 * Un empleado cuya peticion falla simplemente no aparece en el mapa: la
 * columna se pinta sin bloque de descanso, que degrada mucho mejor que dejar
 * la rejilla entera en blanco. `isError` queda expuesto por si la pantalla
 * quiere avisar.
 */
export function useEmployeesWorkingHours(employeeIds: string[]) {
  const { accessToken, isAuthenticated } = useAuth()
  const enabled = isAuthenticated && !!accessToken

  return useQueries({
    queries: employeeIds.map((employeeId) => ({
      queryKey: ["employee-working-hours", employeeId],
      queryFn: () => staffApi.getWorkingHours(employeeId, accessToken!),
      enabled,
    })),
    combine: (results) => ({
      data: employeeIds.reduce<Record<string, WorkingHoursResponse[]>>(
        (byEmployee, employeeId, index) => {
          const hours = results[index]?.data
          if (hours) byEmployee[employeeId] = hours
          return byEmployee
        },
        {}
      ),
      isLoading: results.some((result) => result.isLoading),
      isError: results.some((result) => result.isError),
    }),
  })
}

export function useEmployeeServices(employeeId: string | undefined) {
  const { accessToken, isAuthenticated } = useAuth()

  return useQuery({
    queryKey: ["employee-services", employeeId],
    queryFn: () => staffApi.getEmployeeServices(employeeId!, accessToken!),
    enabled: isAuthenticated && !!accessToken && !!employeeId,
  })
}
