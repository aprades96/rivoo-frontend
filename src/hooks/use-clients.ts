"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { clientsApi } from "@/lib/api/clients"
import { useAuth } from "@/hooks/use-auth"
import type { Client, CreateClientRequest } from "@/types/client"
import type { Page } from "@/types/api"

export function useClients(search: string) {
  const { accessToken, isAuthenticated } = useAuth()

  return useQuery<Page<Client>>({
    queryKey: ["clients", { search }],
    queryFn: () => clientsApi.list({ search, page: 0, size: 10 }, accessToken!),
    enabled: isAuthenticated && !!accessToken && search.length >= 2,
    staleTime: 10 * 1000,
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()

  return useMutation({
    mutationFn: (data: CreateClientRequest) =>
      clientsApi.create(data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
    },
  })
}
