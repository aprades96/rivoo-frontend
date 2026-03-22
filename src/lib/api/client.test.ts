import { describe, it, expect, vi, beforeEach } from "vitest"
import { apiFetch, ApiError } from "./client"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe("apiFetch", () => {
  it("makes GET request and returns JSON", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "1", name: "Test" }),
    })

    const result = await apiFetch<{ id: string; name: string }>("/api/v1/test")

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(result).toEqual({ id: "1", name: "Test" })

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toContain("/api/v1/test")
    expect(options.headers["Content-Type"]).toBe("application/json")
  })

  it("adds Authorization header when token provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({}),
    })

    await apiFetch("/api/v1/test", { token: "my-jwt-token" })

    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers["Authorization"]).toBe("Bearer my-jwt-token")
  })

  it("sends JSON body for POST requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: "new" }),
    })

    await apiFetch("/api/v1/test", {
      method: "POST",
      body: { name: "New Item" },
      token: "tok",
    })

    const [, options] = mockFetch.mock.calls[0]
    expect(options.method).toBe("POST")
    expect(options.body).toBe('{"name":"New Item"}')
  })

  it("returns undefined for 204 No Content", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
    })

    const result = await apiFetch<void>("/api/v1/test", { method: "DELETE" })
    expect(result).toBeUndefined()
  })

  it("throws ApiError with ProblemDetail on error response", async () => {
    const problem = {
      type: "https://rivoo.com/errors/not-found",
      title: "Not Found",
      status: 404,
      detail: "Salon not found",
      instance: "/api/v1/salons/me",
      timestamp: "2026-03-22T10:00:00Z",
      correlationId: "abc-123",
    }

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => problem,
    })

    try {
      await apiFetch("/api/v1/salons/me")
      expect.fail("Should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.problem.status).toBe(404)
      expect(apiErr.problem.detail).toBe("Salon not found")
      expect(apiErr.message).toBe("Salon not found")
    }
  })

  it("handles non-JSON error responses gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      json: async () => { throw new Error("not json") },
    })

    try {
      await apiFetch("/api/v1/test")
      expect.fail("Should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      const apiErr = err as ApiError
      expect(apiErr.problem.status).toBe(502)
      expect(apiErr.problem.title).toBe("HTTP 502")
    }
  })
})
