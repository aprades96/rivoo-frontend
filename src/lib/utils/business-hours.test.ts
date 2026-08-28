import { describe, it, expect } from "vitest"
import { dayName, groupBusinessHours } from "./business-hours"
import type { BusinessHoursResponse } from "@/types/salon"

function hours(dayOfWeek: number, isOpen: boolean, openTime = "09:00", closeTime = "20:00"): BusinessHoursResponse {
  return {
    dayOfWeek,
    isOpen,
    openTime,
    closeTime,
    breakStartTime: null,
    breakEndTime: null,
  }
}

describe("dayName", () => {
  it("maps 1-7 to the abbreviated Spanish day names", () => {
    expect(dayName(1)).toBe("Lun")
    expect(dayName(4)).toBe("Jue")
    expect(dayName(7)).toBe("Dom")
  })

  it("returns an empty string outside 1-7", () => {
    expect(dayName(0)).toBe("")
    expect(dayName(8)).toBe("")
  })
})

describe("groupBusinessHours", () => {
  it("groups consecutive days with an identical schedule into a range", () => {
    const week: BusinessHoursResponse[] = [
      hours(1, true, "09:00", "20:00"),
      hours(2, true, "09:00", "20:00"),
      hours(3, true, "09:00", "20:00"),
      hours(4, true, "09:00", "20:00"),
      hours(5, true, "09:00", "21:00"),
      hours(6, true, "09:00", "14:00"),
      hours(7, false, "09:00", "14:00"),
    ]

    expect(groupBusinessHours(week)).toEqual([
      { label: "Lun - Jue", isOpen: true, openTime: "09:00", closeTime: "20:00" },
      { label: "Viernes", isOpen: true, openTime: "09:00", closeTime: "21:00" },
      { label: "Sabado", isOpen: true, openTime: "09:00", closeTime: "14:00" },
      { label: "Domingo", isOpen: false, openTime: "09:00", closeTime: "14:00" },
    ])
  })

  it("does not group non-consecutive days that happen to share the same schedule", () => {
    const week: BusinessHoursResponse[] = [
      hours(1, true, "09:00", "20:00"),
      hours(2, true, "10:00", "18:00"),
      hours(3, true, "09:00", "20:00"),
    ]

    expect(groupBusinessHours(week)).toEqual([
      { label: "Lunes", isOpen: true, openTime: "09:00", closeTime: "20:00" },
      { label: "Martes", isOpen: true, openTime: "10:00", closeTime: "18:00" },
      { label: "Miercoles", isOpen: true, openTime: "09:00", closeTime: "20:00" },
    ])
  })

  it("cuts the group at a closed day in the middle of an otherwise identical schedule", () => {
    const week: BusinessHoursResponse[] = [
      hours(1, true, "09:00", "20:00"),
      hours(2, false, "09:00", "20:00"),
      hours(3, true, "09:00", "20:00"),
    ]

    expect(groupBusinessHours(week)).toEqual([
      { label: "Lunes", isOpen: true, openTime: "09:00", closeTime: "20:00" },
      { label: "Martes", isOpen: false, openTime: "09:00", closeTime: "20:00" },
      { label: "Miercoles", isOpen: true, openTime: "09:00", closeTime: "20:00" },
    ])
  })

  it("groups a fully closed week into a single row", () => {
    const week: BusinessHoursResponse[] = Array.from({ length: 7 }, (_, i) =>
      hours(i + 1, false, "09:00", "20:00")
    )

    expect(groupBusinessHours(week)).toEqual([
      { label: "Lun - Dom", isOpen: false, openTime: "09:00", closeTime: "20:00" },
    ])
  })
})
