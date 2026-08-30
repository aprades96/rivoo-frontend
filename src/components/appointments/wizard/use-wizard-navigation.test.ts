import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useWizardNavigation } from "./use-wizard-navigation"
import { useWizardStore } from "@/lib/stores/wizard-store"

const backMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: backMock, push: vi.fn() }),
}))

describe("useWizardNavigation", () => {
  beforeEach(() => {
    backMock.mockClear()
    useWizardStore.getState().reset()
  })

  it("onClose desde un paso avanzado limpia el store al completo (singleton de Zustand, segundo uso en la misma sesion)", () => {
    // Cerrar el asistente en el paso 4 con seleccion completa: si `onClose`
    // dejara de llamar a `reset()` (o llamara a algo mas debil como
    // `setState`), la proxima vez que se abra el asistente en la misma
    // sesion de la app arrastraria este estado, porque el store es un
    // singleton.
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
      preferredEmployeeId: "emp_9",
      preferredDate: "2026-08-20",
      preferredSlot: "2026-08-20T10:00:00",
    })

    const { result } = renderHook(() => useWizardNavigation())
    act(() => {
      result.current.onClose()
    })

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
    expect(state.preferredEmployeeId).toBeNull()
    expect(state.preferredDate).toBeNull()
    expect(state.preferredSlot).toBeNull()
    expect(backMock).toHaveBeenCalledOnce()
  })

  it("onBack delega en prevStep del store", () => {
    useWizardStore.setState({ step: 3 })

    const { result } = renderHook(() => useWizardNavigation())
    act(() => {
      result.current.onBack()
    })

    expect(useWizardStore.getState().step).toBe(2)
  })
})
