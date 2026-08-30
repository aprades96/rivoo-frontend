export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"

export type AppointmentSource = "ONLINE" | "PHONE" | "WALK_IN" | "MANUAL"
export type CancelledBy = "CLIENT" | "SALON"

export interface Appointment {
  id: string
  tenantId: string
  clientId: string | null
  clientName: string
  clientPhone: string | null
  clientEmail: string | null
  employeeId: string
  employeeName: string
  serviceId: string
  serviceName: string
  servicePrice: number
  serviceDurationMinutes: number
  startTime: string
  endTime: string
  status: AppointmentStatus
  source: AppointmentSource
  notes: string | null
  reminderSent: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateAppointmentRequest {
  clientId?: string
  clientName?: string
  clientPhone?: string
  clientEmail?: string
  employeeId: string
  serviceId: string
  startTime: string
  notes?: string
}

export interface UpdateStatusRequest {
  status: AppointmentStatus
}

export interface CancelAppointmentRequest {
  reason?: string
  cancelledBy: CancelledBy
}

export interface PublicBookingRequest {
  salonSlug: string
  employeeExternalId?: string
  serviceExternalId: string
  clientFirstName: string
  clientLastName: string
  clientEmail: string
  clientPhone: string
  requestedTime: string
  honeypot?: string
}

export interface PublicBookingResponse {
  id: string
  clientName: string
  employeeId: string
  serviceId: string
  startTime: string
  endTime: string
  status: AppointmentStatus
  confirmationToken: string
}

/**
 * Un hueco libre tal y como lo serializa el backend: el record
 * `AvailableSlot(LocalTime startTime, LocalTime endTime)`. Jackson 3 escribe
 * `LocalTime` con ISO_LOCAL_TIME, que siempre incluye los segundos
 * ("09:00:00"), no "09:00".
 */
export interface AvailableSlot {
  startTime: string
  endTime: string
}

/**
 * Cuerpo de GET /api/v1/appointments/availability y de
 * GET /api/v1/appointments/public/availability. Nombres exactos de los
 * componentes del record `AvailabilityResponse(LocalDate date, String
 * employeeId, List<AvailableSlot> slots)`: en ese repo no hay ninguna
 * `PropertyNamingStrategy`, asi que el nombre del componente es el del JSON.
 *
 * Ejemplo real:
 * {"date":"2026-08-28","employeeId":"emp_1","slots":[{"startTime":"09:00:00","endTime":"09:30:00"}]}
 */
export interface AvailabilityResponse {
  date: string
  employeeId: string
  slots: AvailableSlot[]
}

/**
 * `date` is a SCREEN-level concept: "show me this one day" (local
 * calendar date, `YYYY-MM-DD`). It is NOT sent to the server as-is --
 * `appointmentsApi.list` (`src/lib/api/appointments.ts`) translates it into
 * `startDate`/`endDate`, the two instants the server actually understands,
 * before building the request. `startDate`/`endDate` here document that
 * server-side shape (a half-open UTC instant range); they are not meant to
 * be filled in alongside `date` by a caller -- `date`, when present, wins
 * and overwrites whatever `startDate`/`endDate` would have been sent.
 */
export interface AppointmentListParams {
  date?: string
  startDate?: string
  endDate?: string
  employeeId?: string
  status?: AppointmentStatus
  page?: number
  size?: number
}
