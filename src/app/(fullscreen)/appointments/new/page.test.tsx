import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, act } from "@testing-library/react"
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

  it("con estado sucio de una sesion anterior del asistente (singleton de Zustand), montar la pagina deja el estado inicial COMPLETO", () => {
    // El store es un singleton: abrir el asistente una segunda vez en la
    // misma sesion de la app no vuelve a crearlo, asi que si algo en la
    // cadena de montaje no llama a `reset()` (o llama a algo mas debil, como
    // `setState`), el paso/profesional/servicio/hueco de la vez anterior se
    // arrastran. Comprobar solo `preferredEmployeeId`/`preferredDate` (como
    // hacian las pruebas de arriba) no lo detecta.
    useWizardStore.setState({
      step: 4,
      selectedEmployee: { id: "emp_1", firstName: "Laura", lastName: "M" } as unknown as ReturnType<
        typeof useWizardStore.getState
      >["selectedEmployee"],
      anyEmployee: true,
      selectedService: { id: "svc_1" } as unknown as ReturnType<typeof useWizardStore.getState>["selectedService"],
      selectedDate: "2026-08-20",
      selectedSlot: "2026-08-20T10:00:00",
      selectedSlotEmployeeId: "emp_1",
      selectedClient: { id: "cli_1" } as unknown as ReturnType<typeof useWizardStore.getState>["selectedClient"],
      newClientData: { firstName: "N", lastName: "C", email: "", phone: "" },
      notes: "notas sucias",
    })

    render(<NewAppointmentPage />)

    const state = useWizardStore.getState()
    expect(state.step).toBe(1)
    expect(state.selectedEmployee).toBeNull()
    expect(state.anyEmployee).toBe(false)
    expect(state.selectedService).toBeNull()
    expect(state.selectedDate).toBeNull()
    expect(state.selectedSlot).toBeNull()
    expect(state.selectedSlotEmployeeId).toBeNull()
    expect(state.selectedClient).toBeNull()
    expect(state.newClientData).toBeNull()
    expect(state.notes).toBe("")
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

  it.each([
    [2, "service-step"],
    [3, "datetime-step"],
    [4, "client-step"],
    [5, "confirmation-step"],
  ])("step %i monta %s y solo ese", (step, expectedText) => {
    // Los cinco pasos van mockeados a un `<div>` con su propio texto: si el
    // dispatcher cablea un paso al componente equivocado (o mutan el `step
    // === N` de otro), esta prueba lo distingue por texto -- montar siempre
    // `ServiceStep` para 2..5 solo pasaria la variante `step === 2`.
    //
    // El cambio de paso se hace DESPUES de montar (no antes): el efecto de
    // siembra de `NewAppointmentPageContent` corre al montar y fuerza
    // `step` a 1 (arreglo del "segundo uso"), asi que sembrar `step` antes
    // de `render` quedaria pisado por ese mismo efecto.
    render(<NewAppointmentPage />)
    act(() => {
      useWizardStore.setState({ step })
    })

    expect(screen.getByText(expectedText)).toBeInTheDocument()
    for (const text of ["employee-step", "service-step", "datetime-step", "client-step", "confirmation-step"]) {
      if (text === expectedText) continue
      expect(screen.queryByText(text)).not.toBeInTheDocument()
    }
  })

  it("con date pero sin time, no siembra un preferredSlot mal formado (\"...Tnull:00\")", () => {
    // La condicion es `date && time ? ... : null`; mutarla a solo `date`
    // sobrevive porque nadie prueba el caso `?date=` sin `?time=`, que
    // sembraria el string invalido "2026-08-28Tnull:00".
    setSearchParams("date=2026-08-28")

    render(<NewAppointmentPage />)

    const state = useWizardStore.getState()
    expect(state.preferredDate).toBe("2026-08-28")
    expect(state.preferredSlot).toBeNull()
  })
})
