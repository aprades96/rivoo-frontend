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

export interface AvailabilityResponse {
  availableSlots: string[]
}

export interface AppointmentListParams {
  date?: string
  startDate?: string
  endDate?: string
  employeeId?: string
  status?: AppointmentStatus
  page?: number
  size?: number
}
