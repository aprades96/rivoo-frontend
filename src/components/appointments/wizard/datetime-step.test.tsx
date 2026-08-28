import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DateTimeStep } from "./datetime-step"
import { useWizardStore } from "@/lib/stores/wizard-store"
import { useAvailability } from "@/hooks/use-availability"
import type { AvailabilityResponse } from "@/types/appointment"

vi.mock("@/hooks/use-availability", () => ({ useAvailability: vi.fn() }))

const mockUseAvailability = vi.mocked(useAvailability)

/**
 * Forma real del cuerpo que devuelve GET /api/v1/appointments/availability.
 * Verificada serializando el record AvailabilityResponse/AvailableSlot con
 * el mismo Jackson 3 (tools.jackson 3.0.4) que usa Spring Boot 4.0.3:
 * {"date":"2026-08-28","employeeId":"emp_1","slots":[{"startTime":"09:00:00","endTime":"09:30:00"}]}
 */
const availability: AvailabilityResponse = {
  date: "2026-08-28",
  employeeId: "emp_1",
  slots: [
    { startTime: "09:00:00", endTime: "09:30:00" },
    { startTime: "13:15:00", endTime: "13:45:00" },
  ],
}

function mockAvailability(data: AvailabilityResponse | undefined, isLoading = false) {
  mockUseAvailability.mockReturnValue({ data, isLoading } as unknown as ReturnType<
    typeof useAvailability
  >)
}

describe("DateTimeStep", () => {
  beforeEach(() => {
    useWizardStore.getState().reset()
    mockAvailability(availability)
  })

  it("pinta las horas que llegan en el campo 'slots' del backend", () => {
    render(<DateTimeStep />)

    expect(screen.getByRole("button", { name: "09:00" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "13:15" })).toBeInTheDocument()
    expect(screen.queryByText("No hay huecos disponibles este dia.")).not.toBeInTheDocument()
  })

  it("guarda el hueco elegido como fecha+hora que el endpoint de creacion acepta", async () => {
    const user = userEvent.setup()
    render(<DateTimeStep />)

    await user.click(screen.getByRole("button", { name: "09:00" }))

    const state = useWizardStore.getState()
    expect(state.selectedDate).toBe("2026-08-28")
    // CreateAppointmentRequest.startTime es LocalDateTime: una hora suelta
    // ("09:00:00") la rechaza Jackson con 400.
    expect(state.selectedSlot).toBe("2026-08-28T09:00:00")
    expect(state.step).toBe(2)
  })

  it("sigue mostrando el vacio cuando el backend devuelve slots: []", () => {
    mockAvailability({ ...availability, slots: [] })

    render(<DateTimeStep />)

    expect(screen.getByText("No hay huecos disponibles este dia.")).toBeInTheDocument()
  })
})
