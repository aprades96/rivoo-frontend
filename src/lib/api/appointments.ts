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

/**
 * `date` is a SCREEN concept ("show me this one day"); the server has no
 * such parameter. `AppointmentController` (appointment-service) only accepts
 * `employeeId`, `startDate`, `endDate`, `status` and `Pageable` -- sending
 * `date` verbatim is silently dropped by Spring, and
 * `AppointmentJpaRepository.findByFilters` (appointment-service, lines
 * 57-70) then runs with no date filter at all, `ORDER BY a.startTime DESC`,
 * returning the N farthest-future appointments of any day instead of the
 * requested one.
 *
 * `endDate` is midnight of the FOLLOWING day, not 23:59:59 of the same day:
 * that repository query filters with a half-open interval
 * (`startTime >= :startDate AND startTime < :endDate`), so an appointment
 * starting in the last second of the requested day would be excluded by a
 * same-day 23:59:59 cutoff.
 *
 * Both instants are computed in the browser's LOCAL timezone -- the same
 * `new Date("YYYY-MM-DDT00:00:00")` assumption the rest of this screen
 * already makes -- not a fixed zone: `TIMEZONE` in `src/lib/utils/dates.ts`
 * is exported but never used to convert anywhere, and introducing a second
 * source of truth for timezone here would contradict it.
 */
function toDateRange(date: string): { startDate: string; endDate: string } {
  const startOfDay = new Date(`${date}T00:00:00`)
  const endOfDay = new Date(startOfDay)
  endOfDay.setDate(endOfDay.getDate() + 1)
  return { startDate: startOfDay.toISOString(), endDate: endOfDay.toISOString() }
}

export const appointmentsApi = {
  /**
   * The translation from `date` to `startDate`/`endDate` lives HERE, in the
   * API layer, and not in the screens that call `useAppointments` /
   * `useTodayAppointments`. Reasons: (1) the React Query `queryKey` in
   * `use-appointments.ts` still contains `date`, so its cache semantics and
   * `differsOnlyByDate` day-borrowing keep working untouched; (2) this fixes
   * `/calendar` too without touching that screen; (3) the screens keep
   * reasoning about "one day", which is their own concept, not the server's.
   */
  list: (params: AppointmentListParams, token: string) => {
    const { date, ...rest } = params
    const queryParams = date ? { ...rest, ...toDateRange(date) } : rest
    return apiFetch<Page<Appointment>>(`/api/v1/appointments?${toQueryString(queryParams)}`, { token })
  },

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

  getPublicAvailability: (params: {
    salonSlug: string
    employeeId: string
    date: string
    serviceId?: string
  }) =>
    apiFetch<AvailabilityResponse>(
      `/api/v1/appointments/public/availability?${toQueryString(params)}`
    ),
}
