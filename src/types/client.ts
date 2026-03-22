export interface Client {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  gender: string | null
  dateOfBirth: string | null
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
  dateOfBirth?: string
  notes?: string
}

export interface UpdateClientRequest {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  gender?: string
  dateOfBirth?: string
  notes?: string
}
