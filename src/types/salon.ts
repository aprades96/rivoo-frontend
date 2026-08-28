export type SalonStatus = "ONBOARDING" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED"

export interface Salon {
  id: string
  name: string
  slug: string
  ownerUserId: string
  email: string
  phone: string
  description: string | null
  logoUrl: string | null
  primaryColor: string | null
  addressStreet: string
  addressCity: string
  addressPostalCode: string
  timezone: string
  currency: string
  subscriptionPlan: string
  status: SalonStatus
  createdAt: string
  updatedAt: string
}

export interface EmployeePublic {
  id: string
  firstName: string
  lastName: string
  jobTitle: string | null
  serviceIds: string[]
}

export interface ServicePublic {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  price: number
  currency: string
}

export interface SalonPublic {
  name: string
  slug: string
  phone: string
  description: string | null
  logoUrl: string | null
  primaryColor: string | null
  addressStreet: string
  addressCity: string
  addressPostalCode: string
  businessHours: BusinessHoursResponse[]
  services: ServicePublic[]
  employees: EmployeePublic[]
  /**
   * True cuando salon-service no pudo leer la lista de servicios de
   * staff-service (red, 5xx, cuerpo ilegible). En ese caso `services` llega
   * vacio pero NO significa "este salon no tiene servicios". Independiente de
   * `employeesUnavailable`: las dos llamadas fallan por separado.
   *
   * Nombre exacto del componente del record SalonPublicResponse (Jackson 3, sin
   * PropertyNamingStrategy ni @JsonProperty en salon-service, asi que el nombre
   * de cable es literalmente el del componente). No renombrar: `apiFetch` es un
   * cast sin validacion y un nombre erroneo se leeria como `undefined` (falsy)
   * en silencio.
   */
  servicesUnavailable: boolean
  /** Igual que `servicesUnavailable`, pero para `employees`. */
  employeesUnavailable: boolean
}

export interface BusinessHoursResponse {
  dayOfWeek: number
  isOpen: boolean
  openTime: string
  closeTime: string
  breakStartTime: string | null
  breakEndTime: string | null
}

export interface BusinessHoursRequest {
  dayOfWeek: number
  isOpen: boolean
  openTime: string
  closeTime: string
  breakStartTime?: string
  breakEndTime?: string
}

export interface RegisterSalonRequest {
  name: string
  email: string
  phone: string
  description?: string
  addressStreet: string
  addressCity?: string
  addressPostalCode: string
  ownerFirstName: string
  ownerLastName: string
  ownerPassword: string
}

/**
 * Deliberately just a message. The endpoint answers identically for an address that is free and
 * one that already has an account, so it can no longer return an id, a slug or a status: those
 * exist only when a salon was actually created, and any of them would tell an anonymous caller
 * which of the two happened. Nothing here is meant to be rendered - the client shows its own copy.
 */
export interface RegisterSalonResponse {
  message: string
}

export interface UpdateSalonRequest {
  name?: string
  phone?: string
  description?: string
  logoUrl?: string
  primaryColor?: string
}
