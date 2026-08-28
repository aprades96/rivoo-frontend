import { describe, it, expect, vi, beforeEach } from "vitest"
import { salonsApi } from "./salons"

// `salonsApi` is mocked in every consumer test (business-hours pages,
// onboarding-gate, complete/page, ...), so a wrong method or path here would
// reach production untouched by the other 191 tests: they only assert the
// *mock* was called, never the real fetch. This file is the one place that
// spies on `fetch` itself and pins the exact wire contract.
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe("salonsApi.completeOnboarding", () => {
  it("sends POST to /api/v1/salons/me/onboarding/complete", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "sal_1" }),
    })

    await salonsApi.completeOnboarding("tok")

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, options] = mockFetch.mock.calls[0]
    // Contrasted against the backend controller at the time of writing:
    // salon-service/src/main/java/com/rivoo/salon/infrastructure/adapter/in/web/
    // SalonController.java:103-105 -- `@PostMapping("/api/v1/salons/me/onboarding/complete")`
    // `public ResponseEntity<SalonResponse> completeOnboarding()`.
    expect(url).toContain("/api/v1/salons/me/onboarding/complete")
    expect(options.method).toBe("POST")
    expect(options.headers["Authorization"]).toBe("Bearer tok")
  })
})
