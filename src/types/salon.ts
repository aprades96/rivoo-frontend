export type SalonStatus = "ONBOARDING" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED"

export interface Salon {
  id: string
  name: string
  slug: string
  ownerUserId: string
  email: string
  phone: string
  description: string | null
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
  slug: string
  ownerEmail: string
  phone: string
  description?: string
  addressStreet: string
  addressCity: string
  addressPostalCode: string
  timezone?: string
  currency?: string
}

export interface UpdateSalonRequest {
  name?: string
  phone?: string
  description?: string
}
