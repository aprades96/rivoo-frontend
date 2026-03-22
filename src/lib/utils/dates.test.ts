import { describe, it, expect } from "vitest"
import {
  formatTime,
  formatDate,
  formatDateShort,
  formatDuration,
  formatTimeRange,
} from "./dates"

// Note: date-fns parseISO + format uses local timezone.
// Tests use non-UTC strings to avoid timezone offset issues.
const MORNING = "2026-03-22T09:30:00"
const AFTERNOON = "2026-03-22T14:00:00"
const RANGE_START = "2026-03-22T09:00:00"
const RANGE_END = "2026-03-22T09:45:00"

describe("formatTime", () => {
  it("extracts HH:mm from ISO string", () => {
    expect(formatTime(MORNING)).toBe("09:30")
    expect(formatTime(AFTERNOON)).toBe("14:00")
  })
})

describe("formatDate", () => {
  it("formats with day, month and year", () => {
    const result = formatDate(MORNING)
    expect(result).toMatch(/22/)
    expect(result).toMatch(/2026/)
  })
})

describe("formatDateShort", () => {
  it("formats with day and month", () => {
    const result = formatDateShort(MORNING)
    expect(result).toMatch(/22/)
  })
})

describe("formatDuration", () => {
  it("formats minutes under 60", () => {
    expect(formatDuration(30)).toBe("30 min")
    expect(formatDuration(45)).toBe("45 min")
  })

  it("formats exact hours", () => {
    expect(formatDuration(60)).toBe("1h")
    expect(formatDuration(120)).toBe("2h")
  })

  it("formats hours + minutes", () => {
    expect(formatDuration(90)).toBe("1h 30min")
    expect(formatDuration(75)).toBe("1h 15min")
  })
})

describe("formatTimeRange", () => {
  it("formats start - end", () => {
    const result = formatTimeRange(RANGE_START, RANGE_END)
    expect(result).toBe("09:00 - 09:45")
  })
})
