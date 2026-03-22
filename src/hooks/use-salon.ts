"use client"

import { useQuery } from "@tanstack/react-query"
import { salonsApi } from "@/lib/api/salons"
import { useAuth } from "@/hooks/use-auth"
import type { Salon } from "@/types/salon"

export function useSalon() {
  const { accessToken, isAuthenticated } = useAuth()

  return useQuery<Salon>({
    queryKey: ["salon", "me"],
    queryFn: () => salonsApi.getMine(accessToken!),
    enabled: isAuthenticated && !!accessToken,
    staleTime: 5 * 60 * 1000, // 5 min — salon data rarely changes
  })
}
