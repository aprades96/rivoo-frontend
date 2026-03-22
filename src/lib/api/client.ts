const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export interface ProblemDetail {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  timestamp: string
  correlationId: string
}

export class ApiError extends Error {
  constructor(public problem: ProblemDetail) {
    super(problem.detail)
    this.name = "ApiError"
  }
}

interface FetchOptions extends Omit<RequestInit, "body"> {
  token?: string
  body?: unknown
}

export async function apiFetch<T>(path: string, options?: FetchOptions): Promise<T> {
  const { token, body, ...fetchOptions } = options ?? {}

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((fetchOptions.headers as Record<string, string>) ?? {}),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    let problem: ProblemDetail
    try {
      problem = await response.json()
    } catch {
      problem = {
        type: "about:blank",
        title: `HTTP ${response.status}`,
        status: response.status,
        detail: response.statusText,
        instance: path,
        timestamp: new Date().toISOString(),
        correlationId: "",
      }
    }
    throw new ApiError(problem)
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}
