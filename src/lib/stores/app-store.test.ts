import { describe, it, expect, beforeEach } from "vitest"
import { useAppStore } from "./app-store"

describe("app-store", () => {
  beforeEach(() => {
    // Reset to defaults
    useAppStore.setState({
      selectedDate: new Date(),
      calendarView: "day",
    })
  })

  it("defaults to day view", () => {
    expect(useAppStore.getState().calendarView).toBe("day")
  })

  it("setCalendarView changes view", () => {
    useAppStore.getState().setCalendarView("week")
    expect(useAppStore.getState().calendarView).toBe("week")
  })

  it("setSelectedDate changes date", () => {
    const date = new Date("2026-04-01")
    useAppStore.getState().setSelectedDate(date)
    expect(useAppStore.getState().selectedDate).toEqual(date)
  })
})
