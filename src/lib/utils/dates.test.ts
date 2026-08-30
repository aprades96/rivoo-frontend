import { describe, it, expect } from "vitest"
import {
  formatTime,
  formatDate,
  formatDateShort,
  formatDuration,
  formatDurationTight,
  formatTimeRange,
  formatDateLong,
  formatRelativeTime,
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

describe("formatDurationTight", () => {
  it("formats minutes under 60 without a space", () => {
    expect(formatDurationTight(45)).toBe("45min")
    expect(formatDurationTight(30)).toBe("30min")
  })

  it("matches formatDuration from 60 minutes up", () => {
    expect(formatDurationTight(90)).toBe("1h 30min")
    expect(formatDurationTight(120)).toBe("2h")
  })
})

describe("formatTimeRange", () => {
  it("formats start - end", () => {
    const result = formatTimeRange(RANGE_START, RANGE_END)
    expect(result).toBe("09:00 - 09:45")
  })
})

describe("formatDateLong", () => {
  it("formats weekday, day and month, capitalized (artboard: 'Martes, 27 de agosto')", () => {
    // 2026-03-22 falls on a Sunday.
    expect(formatDateLong(MORNING)).toBe("Domingo, 22 de marzo")
  })
})

describe("formatRelativeTime", () => {
  it("formats minutes below an hour", () => {
    const createdAt = "2026-03-22T09:00:00"
    const now = new Date(2026, 2, 22, 9, 40, 0)
    expect(formatRelativeTime(createdAt, now)).toBe("hace 40 min")
  })

  it("formats hours below a day", () => {
    const createdAt = "2026-03-22T09:00:00"
    const now = new Date(2026, 2, 22, 11, 0, 0)
    expect(formatRelativeTime(createdAt, now)).toBe("hace 2 h")
  })

  it("formats whole days", () => {
    const createdAt = "2026-03-20T09:00:00"
    const now = new Date(2026, 2, 23, 9, 0, 0)
    expect(formatRelativeTime(createdAt, now)).toBe("hace 3 d")
  })

  it("floors partial hours instead of rounding up", () => {
    const createdAt = "2026-03-22T09:00:00"
    const now = new Date(2026, 2, 22, 9, 59, 0)
    expect(formatRelativeTime(createdAt, now)).toBe("hace 59 min")
  })

  it("never produces a negative value if now is before the reference date", () => {
    const createdAt = "2026-03-22T09:00:00"
    const now = new Date(2026, 2, 22, 8, 0, 0)
    expect(formatRelativeTime(createdAt, now)).toBe("hace 0 min")
  })

  describe("unit boundaries (minute -> hour -> day)", () => {
    const createdAt = "2026-03-22T09:00:00"

    it("59 min stays in minutes", () => {
      const now = new Date(2026, 2, 22, 9, 59, 0)
      expect(formatRelativeTime(createdAt, now)).toBe("hace 59 min")
    })

    it("60 min exactos ya cuentan como 1 h, no como 60 min", () => {
      const now = new Date(2026, 2, 22, 10, 0, 0)
      expect(formatRelativeTime(createdAt, now)).toBe("hace 1 h")
    })

    it("61 min sigue siendo 1 h", () => {
      const now = new Date(2026, 2, 22, 10, 1, 0)
      expect(formatRelativeTime(createdAt, now)).toBe("hace 1 h")
    })

    it("23 h stays in hours", () => {
      const now = new Date(2026, 2, 23, 8, 0, 0)
      expect(formatRelativeTime(createdAt, now)).toBe("hace 23 h")
    })

    it("24 h exactas ya cuentan como 1 d, no como 24 h", () => {
      const now = new Date(2026, 2, 23, 9, 0, 0)
      expect(formatRelativeTime(createdAt, now)).toBe("hace 1 d")
    })

    it("25 h sigue siendo 1 d", () => {
      const now = new Date(2026, 2, 23, 10, 0, 0)
      expect(formatRelativeTime(createdAt, now)).toBe("hace 1 d")
    })
  })
})
