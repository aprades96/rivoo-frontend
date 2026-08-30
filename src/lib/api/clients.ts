import { apiFetch } from "./client"
import type {
  Client,
  ClientAppointmentsPage,
  CreateClientRequest,
  UpdateClientRequest,
} from "@/types/client"
import type { Page } from "@/types/api"

export const clientsApi = {
  list: (params: { page?: number; size?: number; search?: string }, token: string) => {
    // `search` vacio se omite en vez de viajar como `search=`: el paso 4 del
    // asistente ya no exige un minimo de caracteres (`useClients`) y sin este
    // filtro cada tecla borrada mandaria un parametro vacio inutil.
    const qs = Object.entries(params)
      .filter(([, v]) => v != null && v !== "")
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

  // Historial de citas del cliente (D38). A diferencia de `/export`, este
  // endpoint NO se traga los errores del backend: un fallo se propaga como
  // `ApiError` y la pantalla pinta su propia rama de error.
  listAppointments: (id: string, params: { page?: number; size?: number }, token: string) =>
    apiFetch<ClientAppointmentsPage>(
      `/api/v1/clients/${id}/appointments?page=${params.page ?? 0}&size=${params.size ?? 10}`,
      { token }
    ),
}
