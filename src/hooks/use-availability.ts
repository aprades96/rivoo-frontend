"use client"

import { useQuery } from "@tanstack/react-query"
import { appointmentsApi } from "@/lib/api/appointments"
import { useAuth } from "@/hooks/use-auth"
import type { AvailabilityResponse } from "@/types/appointment"

export function useAvailability(
  employeeId: string | undefined,
  serviceId: string | undefined,
  date: string | undefined
) {
  const { accessToken, isAuthenticated } = useAuth()

  return useQuery<AvailabilityResponse>({
    queryKey: ["availability", employeeId, serviceId, date],
    queryFn: () =>
      appointmentsApi.getAvailability(
        { employeeId: employeeId!, date: date!, serviceId },
        accessToken!
      ),
    enabled: isAuthenticated && !!accessToken && !!employeeId && !!date,
    staleTime: 60 * 1000, // 1 minute
  })
}
