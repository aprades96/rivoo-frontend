export interface Client {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  gender: string | null
  notes: string | null
  source: string | null
  totalVisits: number
  lastVisitAt: string | null
  gdprConsentAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateClientRequest {
  firstName: string
  lastName: string
  email?: string
  phone?: string
  gender?: string
  notes?: string
}

export interface UpdateClientRequest {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  gender?: string
  notes?: string
}

/**
 * `GET /api/v1/clients/{id}/appointments` (D38, client-service). El endpoint
 * NO se traga los errores (a diferencia de `/export`): un fallo del backend
 * se propaga y la pantalla pinta su propia rama de error en vez de
 * confundirlo con "sin citas".
 */
export interface ClientAppointment {
  id: string
  startTime: string
  serviceName: string
  employeeName: string
  price: number
  status: string
}

/**
 * `totalAppointments` cuenta TODAS las citas (cualquier estado);
 * `billedAmount` solo suma las `COMPLETED` ("facturados" = cobrado).
 * `completedCount`/`lastCompletedAt` alimentan los KPIs de la ficha de
 * cliente (D36): la ficha deriva sus KPIs del resumen del historial, no del
 * contador almacenado en `Client.totalVisits`/`lastVisitAt`.
 */
export interface ClientAppointmentsSummary {
  totalAppointments: number
  billedAmount: number
  completedCount: number
  lastCompletedAt: string | null
}

export interface ClientAppointmentsPage {
  content: ClientAppointment[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  summary: ClientAppointmentsSummary
}
