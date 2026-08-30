import { describe, it, expect, vi, beforeEach } from "vitest"
import { appointmentsApi } from "./appointments"

const apiFetchMock = vi.fn()

vi.mock("./client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}))

/**
 * Builds the expected `startDate`/`endDate` pair with the SAME arithmetic
 * `appointmentsApi.list` is meant to use: local midnight of `date`, and
 * local midnight of the day after, both then read as instants. A literal
 * UTC string here would only match on a machine running in `Europe/Madrid`
 * (or another zone with the same offset on that date) and would fail on
 * any other -- this must hold regardless of the machine's timezone.
 */
function expectedDateRange(date: string): { startDate: string; endDate: string } {
  const startOfDay = new Date(`${date}T00:00:00`)
  const endOfDay = new Date(startOfDay)
  endOfDay.setDate(endOfDay.getDate() + 1)
  return { startDate: startOfDay.toISOString(), endDate: endOfDay.toISOString() }
}

function calledUrl(): string {
  expect(apiFetchMock).toHaveBeenCalledTimes(1)
  return apiFetchMock.mock.calls[0][0] as string
}

function queryParamsOf(url: string): URLSearchParams {
  const [, query] = url.split("?")
  return new URLSearchParams(query ?? "")
}

describe("appointmentsApi.list", () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    apiFetchMock.mockResolvedValue({ content: [], totalElements: 0 })
  })

  it("translates `date` into `startDate`/`endDate` and never sends `date`", async () => {
    await appointmentsApi.list({ date: "2026-08-30", page: 0, size: 100 }, "token")

    const params = queryParamsOf(calledUrl())
    const expected = expectedDateRange("2026-08-30")

    expect(params.has("date")).toBe(false)
    expect(params.get("startDate")).toBe(expected.startDate)
    expect(params.get("endDate")).toBe(expected.endDate)
  })

  it("sets `endDate` to midnight of the day AFTER `date`, not 23:59:59 of the same day", async () => {
    await appointmentsApi.list({ date: "2026-08-30", page: 0, size: 100 }, "token")

    const params = queryParamsOf(calledUrl())
    const startDate = new Date(params.get("startDate")!)
    const endDate = new Date(params.get("endDate")!)

    expect(endDate.getTime() - startDate.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it("uses the device's LOCAL timezone to compute the range, not a fixed offset", async () => {
    await appointmentsApi.list({ date: "2026-08-30", page: 0, size: 100 }, "token")

    const params = queryParamsOf(calledUrl())
    const expected = expectedDateRange("2026-08-30")

    // `expectedDateRange` and the implementation must both go through
    // `new Date("YYYY-MM-DDT00:00:00")`, i.e. the runtime's local zone.
    // Pinning this against a hardcoded UTC literal would pass only on a
    // machine whose local offset happens to match Europe/Madrid that day.
    expect(params.get("startDate")).toBe(expected.startDate)
    expect(params.get("endDate")).toBe(expected.endDate)
  })

  it("keeps employeeId, status, page and size intact", async () => {
    await appointmentsApi.list(
      { date: "2026-08-30", employeeId: "emp_1", status: "CONFIRMED", page: 2, size: 50 },
      "token"
    )

    const params = queryParamsOf(calledUrl())

    expect(params.get("employeeId")).toBe("emp_1")
    expect(params.get("status")).toBe("CONFIRMED")
    expect(params.get("page")).toBe("2")
    expect(params.get("size")).toBe("50")
  })

  it("does not invent a date range when `date` is absent", async () => {
    await appointmentsApi.list({ employeeId: "emp_1", page: 0, size: 100 }, "token")

    const params = queryParamsOf(calledUrl())

    expect(params.has("date")).toBe(false)
    expect(params.has("startDate")).toBe(false)
    expect(params.has("endDate")).toBe(false)
    expect(params.get("employeeId")).toBe("emp_1")
  })
})
