"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useSalon } from "@/hooks/use-salon"
import { useAuth } from "@/hooks/use-auth"
import { staffApi } from "@/lib/api/staff"
import { ApiError } from "@/lib/api/client"
import { Loader2 } from "lucide-react"
import type { ReactNode } from "react"
import type { Page } from "@/types/api"
import type { Employee } from "@/types/employee"
import type { ServiceOffering } from "@/types/service"

export function OnboardingGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, accessToken } = useAuth()
  const { data: salon, isLoading: salonLoading, error: salonError } = useSalon()

  const { data: employees, isLoading: empLoading } = useQuery<Page<Employee>>({
    queryKey: ["employees"],
    queryFn: () => staffApi.listEmployees(accessToken!),
    enabled: isAuthenticated && !!accessToken && !!salon,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const { data: services, isLoading: svcLoading } = useQuery<Page<ServiceOffering>>({
    queryKey: ["services"],
    queryFn: () => staffApi.listServices(accessToken!),
    enabled: isAuthenticated && !!accessToken && !!salon,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const isLoading = authLoading || salonLoading || (!!salon && (empLoading || svcLoading))

  // Salon not found (404) or no employees/services → needs onboarding
  const salonNotFound = !salonLoading && !salon && salonError instanceof ApiError && salonError.problem.status === 404
  const hasEmployees = (employees?.content?.length ?? 0) > 0
  const hasServices = (services?.content?.length ?? 0) > 0
  const needsOnboarding = !isLoading && (salonNotFound || (salon && (!hasEmployees || !hasServices)))

  useEffect(() => {
    if (isLoading) return
    if (needsOnboarding) {
      router.replace("/welcome")
    }
  }, [isLoading, needsOnboarding, router])

  if (isLoading || needsOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <>{children}</>
}
