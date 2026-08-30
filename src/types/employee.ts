export interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  jobTitle: string | null
  colorHex: string | null
  isActive: boolean
  createdAt: string
}

export interface WorkingHoursResponse {
  dayOfWeek: number
  isOpen: boolean
  openTime: string
  closeTime: string
  breakStartTime: string | null
  breakEndTime: string | null
}

export interface WorkingHoursRequest {
  dayOfWeek: number
  isOpen: boolean
  openTime: string
  closeTime: string
  breakStartTime?: string
  breakEndTime?: string
}

export interface CreateEmployeeRequest {
  firstName: string
  lastName: string
  email: string
  phone?: string
  jobTitle?: string
  colorHex?: string
  createKeycloakAccount?: boolean
  password?: string
}

export interface UpdateEmployeeRequest {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  jobTitle?: string
  colorHex?: string
}

export interface EmployeeServiceResponse {
  serviceId: string
  serviceName: string
  effectiveDuration: number
  effectivePrice: number
  customDuration: number | null
  customPrice: number | null
}

export interface AssignServicesRequest {
  services: { serviceId: string; customDuration?: number; customPrice?: number }[]
}
