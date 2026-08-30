import { describe, it, expect, vi, beforeEach } from "vitest"
import { clientsApi } from "./clients"

// Mockea `fetch`, NO el modulo de API (AGENTS.md): este fichero no tenia
// ningun test (§1.9), y mockear `clientsApi`/`apiFetch` en vez de `fetch`
// esconde exactamente el tipo de bug (URL mal formada, query mal construida)
// que este fichero existe para atrapar.
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
  })
})

function calledWith(): [string, RequestInit] {
  expect(mockFetch).toHaveBeenCalledTimes(1)
  return mockFetch.mock.calls[0] as [string, RequestInit]
}

describe("clientsApi.list", () => {
  it("omits `search` entirely when empty, instead of sending search=", async () => {
    await clientsApi.list({ page: 0, size: 50 }, "token")

    const [url] = calledWith()
    expect(url).not.toContain("search=")
    expect(url).toContain("page=0")
    expect(url).toContain("size=50")
  })

  it("sends search, page and size when all are provided", async () => {
    await clientsApi.list({ search: "ana", page: 1, size: 10 }, "token")

    const [url] = calledWith()
    const params = new URLSearchParams(url.split("?")[1])
    expect(params.get("search")).toBe("ana")
    expect(params.get("page")).toBe("1")
    expect(params.get("size")).toBe("10")
  })
})

describe("clientsApi.getById", () => {
  it("hits GET /api/v1/clients/{id}", async () => {
    await clientsApi.getById("cli_1", "token")

    const [url, options] = calledWith()
    expect(url).toContain("/api/v1/clients/cli_1")
    expect(options.method).toBeUndefined()
  })
})

describe("clientsApi.create", () => {
  it("POSTs the request body as-is", async () => {
    await clientsApi.create({ firstName: "Ana", lastName: "Garcia" }, "token")

    const [url, options] = calledWith()
    expect(url).toContain("/api/v1/clients")
    expect(options.method).toBe("POST")
    expect(options.body).toBe(JSON.stringify({ firstName: "Ana", lastName: "Garcia" }))
  })
})

describe("clientsApi.update", () => {
  it("PUTs to /api/v1/clients/{id}", async () => {
    await clientsApi.update("cli_1", { phone: "600000000" }, "token")

    const [url, options] = calledWith()
    expect(url).toContain("/api/v1/clients/cli_1")
    expect(options.method).toBe("PUT")
    expect(options.body).toBe(JSON.stringify({ phone: "600000000" }))
  })
})

describe("clientsApi.anonymize", () => {
  it("POSTs to /api/v1/clients/{id}/anonymize with no body", async () => {
    await clientsApi.anonymize("cli_1", "token")

    const [url, options] = calledWith()
    expect(url).toContain("/api/v1/clients/cli_1/anonymize")
    expect(options.method).toBe("POST")
    expect(options.body).toBeUndefined()
  })
})

describe("clientsApi.exportData", () => {
  it("hits GET /api/v1/clients/{id}/export", async () => {
    await clientsApi.exportData("cli_1", "token")

    const [url] = calledWith()
    expect(url).toContain("/api/v1/clients/cli_1/export")
  })
})

describe("clientsApi.listAppointments", () => {
  it("hits GET /api/v1/clients/{id}/appointments with page and size (D38)", async () => {
    await clientsApi.listAppointments("cli_1", { page: 1, size: 7 }, "token")

    const [url] = calledWith()
    expect(url).toContain("/api/v1/clients/cli_1/appointments")
    const params = new URLSearchParams(url.split("?")[1])
    expect(params.get("page")).toBe("1")
    expect(params.get("size")).toBe("7")
  })

  it("defaults to page=0, size=10 when not provided", async () => {
    await clientsApi.listAppointments("cli_1", {}, "token")

    const [url] = calledWith()
    const params = new URLSearchParams(url.split("?")[1])
    expect(params.get("page")).toBe("0")
    expect(params.get("size")).toBe("10")
  })

  it("propagates a failed response as ApiError instead of swallowing it (D38, unlike /export)", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        detail: "appointment-service unavailable",
        instance: "/api/v1/clients/cli_1/appointments",
        timestamp: "2026-08-30T00:00:00Z",
        correlationId: "abc",
      }),
    })

    await expect(clientsApi.listAppointments("cli_1", {}, "token")).rejects.toThrow(
      "appointment-service unavailable"
    )
  })
})
