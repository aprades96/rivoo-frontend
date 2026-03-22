export interface ServiceOffering {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  price: number
  category: string | null
  isActive: boolean
}

export interface CreateServiceRequest {
  name: string
  description?: string
  durationMinutes: number
  price: number
  category?: string
}

export interface UpdateServiceRequest {
  name?: string
  description?: string
  durationMinutes?: number
  price?: number
  category?: string
}
