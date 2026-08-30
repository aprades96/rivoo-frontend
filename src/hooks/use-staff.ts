"use client"

import { useCallback } from "react"
import { useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query"
import { staffApi } from "@/lib/api/staff"
import { useAuth } from "@/hooks/use-auth"
import type { Employee, WorkingHoursResponse, EmployeeServiceResponse } from "@/types/employee"
import type { ServiceOffering } from "@/types/service"
import type { Page } from "@/types/api"

/**
 * `includeInactive` va en la queryKey (D34): el calendario, `/today` y el
 * asistente comparten `useEmployees()` sin argumentos y DEBEN seguir viendo
 * solo activos. Si `includeInactive` no estuviera en la clave, una pantalla
 * que pidiera los inactivos podria pisar o heredar la cache de las que solo
 * quieren activos.
 */
export function useEmployees(opts?: { includeInactive?: boolean }) {
  const { accessToken, isAuthenticated } = useAuth()
  const includeInactive = opts?.includeInactive ?? false

  return useQuery<Page<Employee>>({
    queryKey: ["employees", { includeInactive }],
    queryFn: () => staffApi.listEmployees(accessToken!, { includeInactive }),
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
 *
 * `combine` va MEMORIZADO. `useQueries` cachea su resultado por
 * `[results, combine]`, asi que con una flecha inline -- nueva en cada
 * render -- ese memo fallaba SIEMPRE y `data` era un `Record` nuevo cada vez.
 * Aguas abajo eso rehacia en cada render los `useMemo` de la pantalla que
 * dependen de este mapa: `breaks` y `freeSlot`.
 *
 * Lo que NO arregla, y conviene no atribuirselo: el reparto en carriles al
 * teclear en el buscador. Teclear cambia `appointments`, y de ahi `columns`,
 * asi que `assignLanes` se rehacia igual con `combine` memorizado o sin el.
 * Eso lo corta el `useMemo` de `ColumnBody` (`day-view.tsx`), no este.
 * `employeeIds` esta en las dependencias
 * porque el mapa se indexa POR POSICION (`results[index]`): con una lista
 * distinta y el `combine` viejo, cada empleado recibiria el horario de otro y
 * el descanso se pintaria en la columna equivocada.
 */
export function useEmployeesWorkingHours(employeeIds: string[]) {
  const { accessToken, isAuthenticated } = useAuth()
  const enabled = isAuthenticated && !!accessToken

  const combine = useCallback(
    (results: UseQueryResult<WorkingHoursResponse[], Error>[]) => ({
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
    [employeeIds]
  )

  return useQueries({
    queries: employeeIds.map((employeeId) => ({
      queryKey: ["employee-working-hours", employeeId],
      queryFn: () => staffApi.getWorkingHours(employeeId, accessToken!),
      enabled,
    })),
    combine,
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

/**
 * Gemelo exacto de `useEmployeesWorkingHours` (arriba): mismo `useQueries`,
 * mismo `combine` MEMORIZADO con `useCallback` y las mismas trampas.
 *
 * `queryKey` replica EXACTAMENTE la de `useEmployeeServices` (arriba) para
 * compartir cache con el paso 2 del asistente de nueva cita: al elegir varios
 * empleados aqui, el paso de servicio de cada uno individual ya esta cargado.
 *
 * Un empleado cuya peticion falla simplemente no aparece en el mapa, igual
 * que en `useEmployeesWorkingHours`: degrada a "ese empleado no tiene
 * servicios listados" en vez de tumbar la pantalla entera. `isError` queda
 * expuesto por si la pantalla quiere avisar.
 *
 * `combine` va MEMORIZADO. `useQueries` cachea su resultado por
 * `[results, combine]`, asi que con una flecha inline -- nueva en cada
 * render -- ese memo fallaba SIEMPRE y `data` era un `Record` nuevo cada vez.
 * `employeeIds` esta en las dependencias porque el mapa se indexa POR
 * POSICION (`results[index]`): con una lista distinta y el `combine` viejo,
 * cada empleado recibiria los servicios de otro.
 */
export function useEmployeesServices(employeeIds: string[]) {
  const { accessToken, isAuthenticated } = useAuth()
  const enabled = isAuthenticated && !!accessToken

  const combine = useCallback(
    (results: UseQueryResult<EmployeeServiceResponse[], Error>[]) => ({
      data: employeeIds.reduce<Record<string, EmployeeServiceResponse[]>>(
        (byEmployee, employeeId, index) => {
          const services = results[index]?.data
          if (services) byEmployee[employeeId] = services
          return byEmployee
        },
        {}
      ),
      isLoading: results.some((result) => result.isLoading),
      isError: results.some((result) => result.isError),
    }),
    [employeeIds]
  )

  return useQueries({
    queries: employeeIds.map((employeeId) => ({
      queryKey: ["employee-services", employeeId],
      queryFn: () => staffApi.getEmployeeServices(employeeId, accessToken!),
      enabled,
    })),
    combine,
  })
}
