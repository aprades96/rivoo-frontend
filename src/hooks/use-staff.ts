"use client"

import { useQuery } from "@tanstack/react-query"
import { staffApi } from "@/lib/api/staff"
import { useAuth } from "@/hooks/use-auth"
import type { Employee } from "@/types/employee"
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

export function useEmployeeServices(employeeId: string | undefined) {
  const { accessToken, isAuthenticated } = useAuth()

  return useQuery({
    queryKey: ["employee-services", employeeId],
    queryFn: () => staffApi.getEmployeeServices(employeeId!, accessToken!),
    enabled: isAuthenticated && !!accessToken && !!employeeId,
  })
}
