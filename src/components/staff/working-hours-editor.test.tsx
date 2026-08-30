import { createRef } from "react"
import { describe, it, expect, vi } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import { WorkingHoursEditor, type WorkingHoursEditorHandle } from "./working-hours-editor"
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

function renderEditor(
  hours: WorkingHoursResponse[] | undefined,
  isSaving = false,
  showSaveButton?: boolean
) {
  const onSave = vi.fn().mockResolvedValue(undefined)
  const ui = (h: WorkingHoursResponse[] | undefined, saving: boolean) => (
    <WorkingHoursEditor
      hours={h}
      onSave={onSave}
      isSaving={saving}
      showSaveButton={showSaveButton}
    />
  )
  const utils = render(ui(hours, isSaving))
  const timeInputs = () =>
    Array.from(
      utils.container.querySelectorAll<HTMLInputElement>('input[type="time"]')
    )
  // The day toggle is now the Switch primitive: an accessible `role="switch"`
  // element, not a raw checkbox (base-ui does render a hidden, aria-hidden
  // checkbox behind it for form purposes, but that is an implementation
  // detail -- assert against the actual interactive/accessible node instead).
  const daySwitches = () =>
    Array.from(utils.container.querySelectorAll<HTMLElement>('[role="switch"]'))
  return {
    ...utils,
    onSave,
    timeInputs,
    daySwitches,
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
    const { timeInputs, daySwitches } = renderEditor(serverHours, true)

    expect(timeInputs().length).toBeGreaterThan(0)
    expect(timeInputs().every((i) => i.disabled)).toBe(true)
    expect(daySwitches().length).toBe(7)
    expect(daySwitches().every((s) => s.getAttribute("aria-disabled") === "true")).toBe(true)
  })

  it("leaves the day toggles and time inputs editable when not saving", () => {
    const { timeInputs, daySwitches } = renderEditor(serverHours)

    expect(timeInputs().some((i) => i.disabled)).toBe(false)
    expect(daySwitches().some((s) => s.getAttribute("aria-disabled") === "true")).toBe(false)
  })

  // #17 (audit residue, block 6): a `text-[Npx]` without its own `leading-*`
  // inherits preflight's `line-height: 1.5`, where the artboard draws no
  // explicit value at all for this flex-centered control -- an explicit
  // `leading-*` removes that mismatch instead of leaving it to chance.
  it("#17: each time input declares its own leading-*", () => {
    const { timeInputs } = renderEditor(serverHours)

    const inputs = timeInputs()
    expect(inputs.length).toBeGreaterThan(0)
    expect(inputs.every((i) => /text-\[13px\] leading-\S+/.test(i.className))).toBe(true)
  })

  it("shows the internal save button by default", () => {
    const { getByRole } = renderEditor(serverHours)

    expect(getByRole("button", { name: /guardar horarios/i })).toBeInTheDocument()
  })

  it("hides the internal save button when showSaveButton is false", () => {
    const { queryByRole } = renderEditor(serverHours, false, false)

    expect(queryByRole("button", { name: /guardar horarios/i })).not.toBeInTheDocument()
  })

  it("renders closed days (isOpen=false) with the muted 'Cerrado' state instead of time fields", () => {
    const { getAllByText, queryByText } = renderEditor(serverHours)

    // serverHours opens Mon-Fri (i < 5): Saturday and Sunday (dayOfWeek 6-7)
    // are closed, but DO carry stored times ("08:30"/"19:30") -- the label
    // must not claim they are missing.
    expect(getAllByText("Cerrado")).toHaveLength(2)
    expect(queryByText(/sin horas guardadas/)).not.toBeInTheDocument()
  })

  // D13: the three states of a day, and the freeze that only lives on this
  // component's OWN button.
  describe("D13: the three states of a day", () => {
    it("closed (loaded), genuinely no stored hours: no time fields, and the muted label names the missing hours", () => {
      const closedSunday: WorkingHoursResponse[] = [
        {
          dayOfWeek: 7,
          isOpen: false,
          openTime: null as unknown as string,
          closeTime: null as unknown as string,
          breakStartTime: null,
          breakEndTime: null,
        },
      ]
      const { getByText, container } = renderEditor(closedSunday)

      expect(getByText("Cerrado · sin horas guardadas")).toBeInTheDocument()
      expect(container.querySelectorAll('input[type="time"]')).toHaveLength(0)
    })

    // LOW: a day toggled off does not necessarily mean its schedule was
    // erased -- the owner may have simply closed a day that still carries a
    // previously saved range. Claiming "sin horas guardadas" there would be
    // a fact about the database this component never checked.
    it("closed (loaded), WITH previously stored hours: the muted label does not claim they are missing", () => {
      const closedSunday: WorkingHoursResponse[] = [
        { dayOfWeek: 7, isOpen: false, openTime: "09:00", closeTime: "20:00", breakStartTime: null, breakEndTime: null },
      ]
      const { getByText, queryByText, container } = renderEditor(closedSunday)

      expect(getByText("Cerrado")).toBeInTheDocument()
      expect(queryByText(/sin horas guardadas/)).not.toBeInTheDocument()
      expect(container.querySelectorAll('input[type="time"]')).toHaveLength(0)
    })

    it("recently activated, no hours: empty '--:--' fields, the attention border, and the banner -- CTA disabled", () => {
      // What the backend actually writes for a freshly created employee's
      // Sunday (EmployeeService.java): open, both times null. The type in
      // src/types/employee.ts lies and calls them non-nullable strings.
      const freshSunday: WorkingHoursResponse[] = [
        {
          dayOfWeek: 7,
          isOpen: true,
          openTime: null as unknown as string,
          closeTime: null as unknown as string,
          breakStartTime: null,
          breakEndTime: null,
        },
      ]
      const { getByRole, getByText, timeInputs } = renderEditor(freshSunday)

      const inputs = timeInputs()
      expect(inputs).toHaveLength(2)
      expect(inputs.every((i) => i.value === "")).toBe(true)
      expect(inputs.every((i) => i.getAttribute("placeholder") === "--:--")).toBe(true)
      expect(inputs.every((i) => i.className.includes("border-input-border-attention"))).toBe(true)

      expect(
        getByText(
          "El domingo llega sin horas guardadas. Al activarlo hay que escribirlas antes de guardar."
        )
      ).toBeInTheDocument()

      expect(getByRole("button", { name: /guardar horarios/i })).toBeDisabled()
    })

    // ALTO: every incomplete fixture in this file sets BOTH times to null.
    // The whole reason `isIncomplete` reads `!openTime || !closeTime` (an OR)
    // instead of an AND is the far more likely slip: writing the opening
    // time and forgetting the closing one. With an AND, that half-written
    // day would stop counting as incomplete -- no banner, no attention
    // border, and the CTA would unfreeze and save a half schedule.
    it("open with ONLY one time written (the other still blank): still counts as incomplete -- banner shown, CTA disabled", () => {
      const halfWrittenSunday: WorkingHoursResponse[] = [
        {
          dayOfWeek: 7,
          isOpen: true,
          openTime: "09:00",
          closeTime: null as unknown as string,
          breakStartTime: null,
          breakEndTime: null,
        },
      ]
      const { getByRole, getByText } = renderEditor(halfWrittenSunday)

      expect(
        getByText(
          "El domingo llega sin horas guardadas. Al activarlo hay que escribirlas antes de guardar."
        )
      ).toBeInTheDocument()
      expect(getByRole("button", { name: /guardar horarios/i })).toBeDisabled()
    })

    // MEDIO: a brand new employee arrives with Saturday/Sunday CLOSED and
    // both times null (EmployeeService.java) -- `isIncomplete` must not flag
    // a closed day at all, no matter what its times are. Without the
    // `day.isOpen` guard, this genuinely-fine fixture would freeze the CTA
    // and show a banner about a day that isn't even open.
    it("closed, no stored hours: does NOT count as incomplete -- no banner, CTA stays enabled", () => {
      const closedSunday: WorkingHoursResponse[] = [
        {
          dayOfWeek: 7,
          isOpen: false,
          openTime: null as unknown as string,
          closeTime: null as unknown as string,
          breakStartTime: null,
          breakEndTime: null,
        },
      ]
      const { getByRole, queryByText } = renderEditor(closedSunday)

      expect(queryByText(/llega sin horas guardadas/i)).not.toBeInTheDocument()
      expect(getByRole("button", { name: /guardar horarios/i })).toBeEnabled()
    })

    it("open with hours: no banner, CTA enabled", () => {
      const openSunday: WorkingHoursResponse[] = [
        { dayOfWeek: 7, isOpen: true, openTime: "10:00", closeTime: "14:00", breakStartTime: null, breakEndTime: null },
      ]
      const { getByRole, queryByText } = renderEditor(openSunday)

      expect(
        queryByText(/el domingo llega sin horas guardadas/i)
      ).not.toBeInTheDocument()
      expect(getByRole("button", { name: /guardar horarios/i })).toBeEnabled()
    })

    // LOW: a freshly created employee has BOTH Saturday and Sunday unset. The
    // banner used to hard-code "El domingo" no matter which day(s) were
    // actually incomplete -- activating Saturday made it incomplete too,
    // silently unnamed.
    it("names every incomplete day, not just one, when more than one is incomplete", () => {
      const freshWeekend: WorkingHoursResponse[] = [
        {
          dayOfWeek: 6,
          isOpen: true,
          openTime: null as unknown as string,
          closeTime: null as unknown as string,
          breakStartTime: null,
          breakEndTime: null,
        },
        {
          dayOfWeek: 7,
          isOpen: true,
          openTime: null as unknown as string,
          closeTime: null as unknown as string,
          breakStartTime: null,
          breakEndTime: null,
        },
      ]
      const { getByText } = renderEditor(freshWeekend)

      expect(
        getByText(
          "El sábado y el domingo llegan sin horas guardadas. Al activarlos hay que escribirlas antes de guardar."
        )
      ).toBeInTheDocument()
    })
  })

  // D13: the obvious "fix" -- making `save()` itself refuse -- silently
  // strands settings/business-hours (mobile's only save path) and
  // (onboarding)/business-hours: their `handleContinue` is
  // `try { await save(); router.push(...) } catch {}`, and the toast comes
  // from `mutation.onError`, which only runs once the mutation actually
  // starts. A regression here would mean "Continuar" does nothing at all.
  it("D13 regression: save() via the ref still calls onSave even with an incomplete day, exactly like today", async () => {
    const incompleteSunday: WorkingHoursResponse[] = [
      {
        dayOfWeek: 7,
        isOpen: true,
        openTime: null as unknown as string,
        closeTime: null as unknown as string,
        breakStartTime: null,
        breakEndTime: null,
      },
    ]
    const onSave = vi.fn().mockResolvedValue(undefined)
    const ref = createRef<WorkingHoursEditorHandle>()
    render(
      <WorkingHoursEditor ref={ref} hours={incompleteSunday} onSave={onSave} showSaveButton={false} />
    )

    await ref.current?.save()

    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
