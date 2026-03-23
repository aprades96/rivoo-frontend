import { apiFetch } from "./client"
import type {
  Salon,
  SalonPublic,
  RegisterSalonRequest,
  RegisterSalonResponse,
  UpdateSalonRequest,
  BusinessHoursRequest,
  BusinessHoursResponse,
} from "@/types/salon"

export const salonsApi = {
  getMine: (token: string) =>
    apiFetch<Salon>("/api/v1/salons/me", { token }),

  getPublic: (slug: string) =>
    apiFetch<SalonPublic>(`/api/v1/salons/public/${slug}`),

  register: (data: RegisterSalonRequest) =>
    apiFetch<RegisterSalonResponse>("/api/v1/salons", { method: "POST", body: data }),

  update: (data: UpdateSalonRequest, token: string) =>
    apiFetch<Salon>("/api/v1/salons/me", { method: "PUT", body: data, token }),

  getBusinessHours: (token: string) =>
    apiFetch<BusinessHoursResponse[]>("/api/v1/salons/me/business-hours", { token }),

  updateBusinessHours: (data: BusinessHoursRequest[], token: string) =>
    apiFetch<BusinessHoursResponse[]>("/api/v1/salons/me/business-hours", {
      method: "PUT",
      body: data,
      token,
    }),
}
