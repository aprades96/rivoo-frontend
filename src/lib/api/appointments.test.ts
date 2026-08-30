import { describe, it, expect, vi, beforeEach } from "vitest"
import { appointmentsApi } from "./appointments"

const apiFetchMock = vi.fn()

vi.mock("./client", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}))

/**
 * `vitest.config.ts` pins `process.env.TZ` to `Europe/Madrid` for the whole
 * suite, precisely so these assertions are deterministic on any runner
 * (including a UTC CI container) instead of only on a machine that happens
 * to already run in that zone. Europe/Madrid is also the zone with a
 * DST-shifting, non-zero offset needed to actually distinguish the decided
 * local-time conversion from a fixed-UTC-offset one -- with `TZ=UTC` both
 * implementations produce the same instants and no test here could fail.
 *
 * Builds the expected `startDate`/`endDate` pair with the SAME arithmetic
 * `appointmentsApi.list` is meant to use: local midnight of `date`, and
 * local midnight of the day after, both then read as instants.
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

    // 24h is NOT an invariant of the function -- it is a property of this
    // particular day, which crosses no DST transition in Europe/Madrid. See
    // the two tests below for the days where the range is legitimately
    // 23h or 25h long.
    expect(endDate.getTime() - startDate.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it("on the day Europe/Madrid springs forward (2026-03-29), the range is 23h long", async () => {
    await appointmentsApi.list({ date: "2026-03-29", page: 0, size: 100 }, "token")

    const params = queryParamsOf(calledUrl())

    // Literal instants, not derived from the same arithmetic as production:
    // 2026-03-29 00:00 Europe/Madrid is still CET (UTC+1) since the clocks
    // do not jump forward to CEST (UTC+2) until 02:00 that day; 2026-03-30
    // 00:00 is already CEST. 23:00Z -> 22:00Z next day is 23h, one hour
    // short of a full day.
    expect(params.get("startDate")).toBe("2026-03-28T23:00:00.000Z")
    expect(params.get("endDate")).toBe("2026-03-29T22:00:00.000Z")

    const startDate = new Date(params.get("startDate")!)
    const endDate = new Date(params.get("endDate")!)
    expect(endDate.getTime() - startDate.getTime()).toBe(23 * 60 * 60 * 1000)
  })

  it("on the day Europe/Madrid falls back (2026-10-25), the range is 25h long", async () => {
    await appointmentsApi.list({ date: "2026-10-25", page: 0, size: 100 }, "token")

    const params = queryParamsOf(calledUrl())

    // Literal instants: 2026-10-25 00:00 Europe/Madrid is still CEST
    // (UTC+2) since the clocks do not fall back to CET (UTC+1) until 03:00
    // that day; 2026-10-26 00:00 is already CET. 22:00Z -> 23:00Z next day
    // is 25h, one hour more than a full day.
    expect(params.get("startDate")).toBe("2026-10-24T22:00:00.000Z")
    expect(params.get("endDate")).toBe("2026-10-25T23:00:00.000Z")

    const startDate = new Date(params.get("startDate")!)
    const endDate = new Date(params.get("endDate")!)
    expect(endDate.getTime() - startDate.getTime()).toBe(25 * 60 * 60 * 1000)
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
