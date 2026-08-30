import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { WizardContextPills } from "./wizard-context-pills"
import { useWizardStore } from "@/lib/stores/wizard-store"
import { useEmployees } from "@/hooks/use-staff"
import type { Employee } from "@/types/employee"
import type { ServiceOffering } from "@/types/service"

vi.mock("@/hooks/use-staff", () => ({ useEmployees: vi.fn() }))

const useEmployeesMock = vi.mocked(useEmployees)

const employee: Employee = {
  id: "emp_1",
  firstName: "Laura",
  lastName: "Martinez",
  email: "laura@example.com",
  phone: null,
  jobTitle: "Estilista",
  colorHex: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00",
}

const service: ServiceOffering = {
  id: "svc_1",
  name: "Corte + Tinte",
  description: null,
  durationMinutes: 90,
  price: 65,
  category: null,
  isActive: true,
}

describe("WizardContextPills", () => {
  beforeEach(() => {
    useWizardStore.getState().reset()
    useEmployeesMock.mockReturnValue({ data: { content: [employee] } } as unknown as ReturnType<
      typeof useEmployees
    >)
  })

  it("no pinta nada sin ninguna eleccion", () => {
    const { container } = render(<WizardContextPills />)
    expect(container).toBeEmptyDOMElement()
  })

  it("con solo profesional elegido pinta una unica pildora", () => {
    useWizardStore.setState({ selectedEmployee: employee })
    render(<WizardContextPills />)

    expect(screen.getByText("Laura")).toBeInTheDocument()
    expect(screen.queryByText(/Corte \+ Tinte/)).not.toBeInTheDocument()
  })

  it("con profesional y servicio pinta dos pildoras, la de servicio con icono y duracion", () => {
    useWizardStore.setState({ selectedEmployee: employee, selectedService: service })
    render(<WizardContextPills />)

    expect(screen.getByText("Laura")).toBeInTheDocument()
    expect(screen.getByText("Corte + Tinte · 1h 30min")).toBeInTheDocument()
  })

  it("con fecha y hora elegidas pinta las tres, la de servicio SIN duracion y una tercera 'dia · hora'", () => {
    useWizardStore.setState({
      selectedEmployee: employee,
      selectedService: service,
      selectedDate: "2026-08-28",
      selectedSlot: "2026-08-28T11:00:00",
    })
    render(<WizardContextPills />)

    expect(screen.getByText("Laura")).toBeInTheDocument()
    expect(screen.getByText("Corte + Tinte")).toBeInTheDocument()
    expect(screen.queryByText(/1h 30min/)).not.toBeInTheDocument()
    expect(screen.getByText("28 · 11:00")).toBeInTheDocument()
  })

  it("con un empleado sin colorHex que ya no esta en la lista activa, cae en el indice de paleta 0", () => {
    useEmployeesMock.mockReturnValue({ data: { content: [] } } as unknown as ReturnType<
      typeof useEmployees
    >)
    useWizardStore.setState({ selectedEmployee: employee })
    render(<WizardContextPills />)

    expect(screen.getByText("LM")).toBeInTheDocument()
  })
})
