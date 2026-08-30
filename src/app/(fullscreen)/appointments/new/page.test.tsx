import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import NewAppointmentPage from "./page"
import { useWizardStore } from "@/lib/stores/wizard-store"

const { getSearchParams, setSearchParams } = vi.hoisted(() => {
  let query = ""
  return {
    getSearchParams: () => new URLSearchParams(query),
    setSearchParams: (next: string) => {
      query = next
    },
  }
})

vi.mock("next/navigation", () => ({
  useSearchParams: () => getSearchParams(),
}))

// La pagina es un dispatcher puro: se acota a comprobar que siembra el store
// y elige el paso, no lo que cada paso pinta -- de ahi el doble ligero.
vi.mock("@/components/appointments/wizard/employee-step", () => ({
  EmployeeStep: () => <div>employee-step</div>,
}))
vi.mock("@/components/appointments/wizard/service-step", () => ({
  ServiceStep: () => <div>service-step</div>,
}))
vi.mock("@/components/appointments/wizard/datetime-step", () => ({
  DateTimeStep: () => <div>datetime-step</div>,
}))
vi.mock("@/components/appointments/wizard/client-step", () => ({
  ClientStep: () => <div>client-step</div>,
}))
vi.mock("@/components/appointments/wizard/confirmation-step", () => ({
  ConfirmationStep: () => <div>confirmation-step</div>,
}))

describe("NewAppointmentPage", () => {
  beforeEach(() => {
    setSearchParams("")
    useWizardStore.getState().reset()
  })

  it("sin parametros, el store queda en el estado inicial y arranca en el paso 1", () => {
    render(<NewAppointmentPage />)

    expect(screen.getByText("employee-step")).toBeInTheDocument()
    const state = useWizardStore.getState()
    expect(state.step).toBe(1)
    expect(state.preferredEmployeeId).toBeNull()
    expect(state.preferredDate).toBeNull()
    expect(state.preferredSlot).toBeNull()
  })

  it("con employeeId, siembra preferredEmployeeId y SIGUE en el paso 1", () => {
    setSearchParams("employeeId=emp_1")
    render(<NewAppointmentPage />)

    expect(screen.getByText("employee-step")).toBeInTheDocument()
    expect(useWizardStore.getState().preferredEmployeeId).toBe("emp_1")
    expect(useWizardStore.getState().step).toBe(1)
  })

  it("con date y time, siembra preferredDate y preferredSlot", () => {
    setSearchParams("date=2026-08-28&time=11:00")
    render(<NewAppointmentPage />)

    const state = useWizardStore.getState()
    expect(state.preferredDate).toBe("2026-08-28")
    expect(state.preferredSlot).toBe("2026-08-28T11:00:00")
    expect(state.step).toBe(1)
  })

  it("con rescheduleId, no cambia nada -- se ignora a proposito", () => {
    setSearchParams("rescheduleId=appt_1&date=2026-08-28&time=11:00&employeeId=emp_1")
    render(<NewAppointmentPage />)

    const state = useWizardStore.getState()
    expect(state.preferredDate).toBe("2026-08-28")
    expect(state.preferredSlot).toBe("2026-08-28T11:00:00")
    expect(state.preferredEmployeeId).toBe("emp_1")
    expect(state.step).toBe(1)
    expect(state.selectedEmployee).toBeNull()
  })
})
