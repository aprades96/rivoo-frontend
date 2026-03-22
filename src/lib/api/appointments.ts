import { apiFetch } from "./client"
import type {
  Appointment,
  CreateAppointmentRequest,
  UpdateStatusRequest,
  CancelAppointmentRequest,
  PublicBookingRequest,
  PublicBookingResponse,
  AvailabilityResponse,
  AppointmentListParams,
} from "@/types/appointment"
import type { Page } from "@/types/api"

function toQueryString(params: object): string {
  const entries = Object.entries(params).filter(([, v]) => v != null)
  return entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")
}

export const appointmentsApi = {
  list: (params: AppointmentListParams, token: string) =>
    apiFetch<Page<Appointment>>(`/api/v1/appointments?${toQueryString(params)}`, { token }),

  getById: (id: string, token: string) =>
    apiFetch<Appointment>(`/api/v1/appointments/${id}`, { token }),

  create: (data: CreateAppointmentRequest, token: string) =>
    apiFetch<Appointment>("/api/v1/appointments", { method: "POST", body: data, token }),

  updateStatus: (id: string, data: UpdateStatusRequest, token: string) =>
    apiFetch<Appointment>(`/api/v1/appointments/${id}/status`, { method: "PUT", body: data, token }),

  cancel: (id: string, data: CancelAppointmentRequest, token: string) =>
    apiFetch<Appointment>(`/api/v1/appointments/${id}/cancel`, { method: "PUT", body: data, token }),

  getAvailability: (params: { employeeId: string; date: string; serviceId?: string }, token: string) =>
    apiFetch<AvailabilityResponse>(`/api/v1/appointments/availability?${toQueryString(params)}`, { token }),

  // Public booking — no auth
  bookPublic: (data: PublicBookingRequest) =>
    apiFetch<PublicBookingResponse>("/api/v1/appointments/book", { method: "POST", body: data }),
}
