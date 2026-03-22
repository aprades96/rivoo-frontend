import { describe, it, expect } from "vitest"
import {
  generateTimeLabels,
  calculateBlockPosition,
  GRID_START_HOUR,
  GRID_END_HOUR,
  SLOT_HEIGHT_PX,
  SLOT_MINUTES,
  TOTAL_SLOTS,
} from "./calendar"

describe("generateTimeLabels", () => {
  const labels = generateTimeLabels()

  it("starts at 08:00", () => {
    expect(labels[0]).toBe("08:00")
  })

  it("ends at 20:30", () => {
    expect(labels[labels.length - 1]).toBe("20:30")
  })

  it("generates correct number of slots", () => {
    expect(labels).toHaveLength(TOTAL_SLOTS)
  })

  it("alternates between :00 and :30", () => {
    expect(labels[0]).toBe("08:00")
    expect(labels[1]).toBe("08:30")
    expect(labels[2]).toBe("09:00")
  })
})

describe("calculateBlockPosition", () => {
  it("returns correct top for appointment at grid start", () => {
    const pos = calculateBlockPosition(
      "2026-03-22T08:00:00",
      "2026-03-22T08:30:00"
    )
    expect(pos).not.toBeNull()
    expect(pos!.top).toBe(0)
    expect(pos!.height).toBe(SLOT_HEIGHT_PX)
  })

  it("calculates correct top for 09:00 appointment", () => {
    const pos = calculateBlockPosition(
      "2026-03-22T09:00:00",
      "2026-03-22T09:30:00"
    )
    expect(pos).not.toBeNull()
    // 09:00 is 60 min after 08:00 = 2 slots
    expect(pos!.top).toBe(2 * SLOT_HEIGHT_PX)
  })

  it("calculates correct height for 1h appointment", () => {
    const pos = calculateBlockPosition(
      "2026-03-22T10:00:00",
      "2026-03-22T11:00:00"
    )
    expect(pos).not.toBeNull()
    expect(pos!.height).toBe(2 * SLOT_HEIGHT_PX) // 60min = 2 slots
  })

  it("returns null for appointment outside grid", () => {
    const pos = calculateBlockPosition(
      "2026-03-22T06:00:00",
      "2026-03-22T07:00:00"
    )
    expect(pos).toBeNull()
  })

  it("clamps appointment that starts before grid", () => {
    const pos = calculateBlockPosition(
      "2026-03-22T07:30:00",
      "2026-03-22T08:30:00"
    )
    expect(pos).not.toBeNull()
    expect(pos!.top).toBe(0) // clamped to 08:00
    expect(pos!.height).toBe(SLOT_HEIGHT_PX) // 30 min visible
  })

  it("clamps appointment that ends after grid", () => {
    const pos = calculateBlockPosition(
      "2026-03-22T20:30:00",
      "2026-03-22T21:30:00"
    )
    expect(pos).not.toBeNull()
    // 20:30 to 21:00 = 30 min visible
    expect(pos!.height).toBe(SLOT_HEIGHT_PX)
  })

  it("enforces minimum height", () => {
    const pos = calculateBlockPosition(
      "2026-03-22T10:00:00",
      "2026-03-22T10:10:00"
    )
    expect(pos).not.toBeNull()
    expect(pos!.height).toBeGreaterThanOrEqual(SLOT_HEIGHT_PX / 2)
  })
})
