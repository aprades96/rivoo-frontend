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

export interface RegisterSalonResponse {
  id: string
  slug: string
  status: string
}

export interface UpdateSalonRequest {
  name?: string
  phone?: string
  description?: string
  logoUrl?: string
  primaryColor?: string
}
