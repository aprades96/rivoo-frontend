import { describe, it, expect, vi, beforeEach } from "vitest"
import { staffApi } from "./staff"

// Mockea `fetch`, NO el modulo de API: mockear `staffApi`/`apiFetch` es
// exactamente lo que le impidio a `use-clients.test.tsx:17-21` ver una URL
// mal formada (AGENTS.md). Aqui se llama al `staffApi` real para que la
// construccion real de la URL y del cuerpo pase por el mock.
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ([]),
  })
})

function calledWith(): [string, RequestInit] {
  expect(mockFetch).toHaveBeenCalledTimes(1)
  return mockFetch.mock.calls[0] as [string, RequestInit]
}

describe("staffApi.assignServices", () => {
  it("sends { services: [{ serviceId }] }, NOT the old { serviceIds } shape (§1.11.1)", async () => {
    await staffApi.assignServices("emp_1", { services: [{ serviceId: "svc_1" }] }, "token")

    const [url, options] = calledWith()

    expect(url).toContain("/api/v1/staff/employees/emp_1/services")
    expect(options.method).toBe("POST")
    expect(options.body).toBe(JSON.stringify({ services: [{ serviceId: "svc_1" }] }))
  })

  it("lets an empty list through the body -- desassigning the last service is legitimate (D16b)", async () => {
    await staffApi.assignServices("emp_1", { services: [] }, "token")

    const [, options] = calledWith()
    expect(options.body).toBe(JSON.stringify({ services: [] }))
  })

  it("forwards optional customDuration/customPrice per service", async () => {
    await staffApi.assignServices(
      "emp_1",
      { services: [{ serviceId: "svc_1", customDuration: 45, customPrice: 30 }] },
      "token"
    )

    const [, options] = calledWith()
    expect(options.body).toBe(
      JSON.stringify({ services: [{ serviceId: "svc_1", customDuration: 45, customPrice: 30 }] })
    )
  })
})

describe("staffApi.listEmployees", () => {
  it("defaults to size=100 and omits includeInactive (D11, D35)", async () => {
    await staffApi.listEmployees("token")

    const [url] = calledWith()
    const params = new URLSearchParams(url.split("?")[1])

    expect(params.get("size")).toBe("100")
    expect(params.has("includeInactive")).toBe(false)
  })

  it("sends includeInactive=true only when explicitly requested", async () => {
    await staffApi.listEmployees("token", { includeInactive: true })

    const [url] = calledWith()
    const params = new URLSearchParams(url.split("?")[1])

    expect(params.get("includeInactive")).toBe("true")
  })

  it("honours a custom size when passed", async () => {
    await staffApi.listEmployees("token", { size: 20 })

    const [url] = calledWith()
    const params = new URLSearchParams(url.split("?")[1])

    expect(params.get("size")).toBe("20")
  })
})

describe("staffApi.listServices", () => {
  it("defaults to size=100 (D11)", async () => {
    await staffApi.listServices("token")

    const [url] = calledWith()
    const params = new URLSearchParams(url.split("?")[1])

    expect(params.get("size")).toBe("100")
  })
})
