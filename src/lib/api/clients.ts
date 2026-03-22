import { apiFetch } from "./client"
import type { Client, CreateClientRequest, UpdateClientRequest } from "@/types/client"
import type { Page } from "@/types/api"

export const clientsApi = {
  list: (params: { page?: number; size?: number; search?: string }, token: string) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join("&")
    return apiFetch<Page<Client>>(`/api/v1/clients?${qs}`, { token })
  },

  getById: (id: string, token: string) =>
    apiFetch<Client>(`/api/v1/clients/${id}`, { token }),

  create: (data: CreateClientRequest, token: string) =>
    apiFetch<Client>("/api/v1/clients", { method: "POST", body: data, token }),

  update: (id: string, data: UpdateClientRequest, token: string) =>
    apiFetch<Client>(`/api/v1/clients/${id}`, { method: "PUT", body: data, token }),

  anonymize: (id: string, token: string) =>
    apiFetch<void>(`/api/v1/clients/${id}/anonymize`, { method: "POST", token }),

  exportData: (id: string, token: string) =>
    apiFetch<unknown>(`/api/v1/clients/${id}/export`, { token }),
}
