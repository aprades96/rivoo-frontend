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

export interface SalonPublic {
  id: string
  name: string
  slug: string
  phone: string
  description: string | null
  logoUrl: string | null
  primaryColor: string | null
  address: string
  businessHours: BusinessHoursResponse[]
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
