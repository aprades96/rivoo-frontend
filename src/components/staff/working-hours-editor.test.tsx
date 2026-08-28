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

function renderEditor(hours: WorkingHoursResponse[] | undefined) {
  const ui = (h: WorkingHoursResponse[] | undefined) => (
    <WorkingHoursEditor hours={h} onSave={vi.fn().mockResolvedValue(undefined)} />
  )
  const utils = render(ui(hours))
  const timeInputs = () =>
    Array.from(
      utils.container.querySelectorAll<HTMLInputElement>('input[type="time"]')
    )
  return {
    ...utils,
    timeInputs,
    firstOpenTime: () => timeInputs()[0],
    rerenderWith: (next: WorkingHoursResponse[] | undefined) =>
      utils.rerender(ui(next)),
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
})
