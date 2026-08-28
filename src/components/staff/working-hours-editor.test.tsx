import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import { WorkingHoursEditor } from "./working-hours-editor"
import type { WorkingHoursResponse } from "@/types/employee"

const serverHours: WorkingHoursResponse[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i + 1,
  isOpen: i < 5,
  openTime: "08:30",
  closeTime: "19:30",
  breakStartTime: null,
  breakEndTime: null,
}))

// What the server echoes back after a save that only carried the Monday edit:
// the Tuesday the user typed later never reached it.
const savedHours: WorkingHoursResponse[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i + 1,
  isOpen: i < 5,
  openTime: i === 0 ? "10:00" : "09:00",
  closeTime: "20:00",
  breakStartTime: null,
  breakEndTime: null,
}))

function renderEditor(hours: WorkingHoursResponse[] | undefined, isSaving = false) {
  const ui = (h: WorkingHoursResponse[] | undefined, saving: boolean) => (
    <WorkingHoursEditor
      hours={h}
      onSave={vi.fn().mockResolvedValue(undefined)}
      isSaving={saving}
    />
  )
  const utils = render(ui(hours, isSaving))
  const timeInputs = () =>
    Array.from(
      utils.container.querySelectorAll<HTMLInputElement>('input[type="time"]')
    )
  const dayCheckboxes = () =>
    Array.from(
      utils.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    )
  return {
    ...utils,
    timeInputs,
    dayCheckboxes,
    firstOpenTime: () => timeInputs()[0],
    // DEFAULT_HOURS opens Mon-Fri, so each open day contributes two time inputs:
    // index 2 is Tuesday's opening time.
    tuesdayOpenTime: () => timeInputs()[2],
    rerenderWith: (next: WorkingHoursResponse[] | undefined, saving = false) =>
      utils.rerender(ui(next, saving)),
  }
}

describe("WorkingHoursEditor", () => {
  it("adopts the stored schedule when it is already available on mount", () => {
    const { firstOpenTime } = renderEditor(serverHours)
    expect(firstOpenTime().value).toBe("08:30")
  })

  it("adopts the stored schedule when it arrives after mount", () => {
    const { firstOpenTime, rerenderWith } = renderEditor(undefined)
    expect(firstOpenTime().value).toBe("09:00") // defaults

    rerenderWith(serverHours)

    expect(firstOpenTime().value).toBe("08:30")
  })

  it("keeps the in-progress edit when a background refetch returns a new array", () => {
    const { firstOpenTime, rerenderWith } = renderEditor(serverHours)

    fireEvent.change(firstOpenTime(), { target: { value: "11:00" } })
    expect(firstOpenTime().value).toBe("11:00")

    // Same schedule, brand new array/objects: exactly what a refetch produces.
    rerenderWith(serverHours.map((h) => ({ ...h })))

    expect(firstOpenTime().value).toBe("11:00")
  })

  it("keeps an edit made while the post-save refetch is in flight", () => {
    // Fresh salon / brand new employee: the server has no rows yet.
    const { firstOpenTime, tuesdayOpenTime, rerenderWith } = renderEditor([])
    expect(firstOpenTime().value).toBe("09:00") // defaults

    // The user sets Monday and saves.
    fireEvent.change(firstOpenTime(), { target: { value: "10:00" } })
    rerenderWith([], true)

    // The mutation settles, its invalidation refetch is still in flight, and
    // the user carries on with Tuesday.
    rerenderWith([], false)
    fireEvent.change(tuesdayOpenTime(), { target: { value: "11:00" } })
    expect(tuesdayOpenTime().value).toBe("11:00")

    // The refetch lands with the seven saved rows.
    rerenderWith(savedHours)

    expect(tuesdayOpenTime().value).toBe("11:00")
  })

  it("keeps edits when the first payload arrives empty and a later one is populated", () => {
    const { firstOpenTime, rerenderWith } = renderEditor(undefined)

    // First payload: the salon has no stored schedule.
    rerenderWith([])
    expect(firstOpenTime().value).toBe("09:00") // defaults

    fireEvent.change(firstOpenTime(), { target: { value: "07:15" } })
    expect(firstOpenTime().value).toBe("07:15")

    // A later refetch is the first to come back populated.
    rerenderWith(serverHours)

    expect(firstOpenTime().value).toBe("07:15")
  })

  it("disables the day toggles and time inputs while saving", () => {
    const { timeInputs, dayCheckboxes } = renderEditor(serverHours, true)

    expect(timeInputs().length).toBeGreaterThan(0)
    expect(timeInputs().every((i) => i.disabled)).toBe(true)
    expect(dayCheckboxes().length).toBe(7)
    expect(dayCheckboxes().every((c) => c.disabled)).toBe(true)
  })

  it("leaves the day toggles and time inputs editable when not saving", () => {
    const { timeInputs, dayCheckboxes } = renderEditor(serverHours)

    expect(timeInputs().some((i) => i.disabled)).toBe(false)
    expect(dayCheckboxes().some((c) => c.disabled)).toBe(false)
  })
})
