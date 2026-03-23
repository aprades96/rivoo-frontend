import { getSession } from "next-auth/react"

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
  _isRetry?: boolean
}

// Singleton: only one refresh in-flight at a time (prevents thundering herd
// with revokeRefreshToken=true in Keycloak)
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise

  refreshPromise = getSession()
    .then((session) => {
      refreshPromise = null
      return (session as { accessToken?: string })?.accessToken ?? null
    })
    .catch(() => {
      refreshPromise = null
      return null
    })

  return refreshPromise
}

export async function apiFetch<T>(path: string, options?: FetchOptions): Promise<T> {
  const { token, body, _isRetry, ...fetchOptions } = options ?? {}

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

  // 401 with token = likely expired → refresh and retry once
  if (response.status === 401 && token && !_isRetry) {
    const newToken = await refreshAccessToken()
    if (newToken && newToken !== token) {
      return apiFetch<T>(path, { ...options, token: newToken, _isRetry: true })
    }
  }

  // 401 after retry = session is dead
  if (response.status === 401 && _isRetry) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("rivoo:session-expired"))
    }
  }

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
