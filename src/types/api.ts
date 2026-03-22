export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
  empty: boolean
}

export interface ProblemDetail {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  timestamp: string
  correlationId: string
}
