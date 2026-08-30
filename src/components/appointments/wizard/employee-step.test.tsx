import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import { EmployeeStep } from "./employee-step"
import { useWizardStore } from "@/lib/stores/wizard-store"
import { useEmployees, useEmployeesWorkingHours } from "@/hooks/use-staff"
import { useTodayAppointments } from "@/hooks/use-appointments"
import type { Employee, WorkingHoursResponse } from "@/types/employee"
import type { Appointment } from "@/types/appointment"
import type { Page } from "@/types/api"

vi.mock("@/hooks/use-staff", () => ({
  useEmployees: vi.fn(),
  useEmployeesWorkingHours: vi.fn(),
}))
vi.mock("@/hooks/use-appointments", () => ({
  useTodayAppointments: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}))

const mockUseEmployees = vi.mocked(useEmployees)
const mockUseEmployeesWorkingHours = vi.mocked(useEmployeesWorkingHours)
const mockUseTodayAppointments = vi.mocked(useTodayAppointments)

/** `matches: desktop` para simular `(min-width: 1024px)`; jsdom no tiene layout real. */
function mockMatchMedia(desktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: desktop,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

function page<T>(content: T[]): Page<T> {
  return {
    content,
    totalElements: content.length,
    totalPages: 1,
    size: content.length,
    number: 0,
    first: true,
    last: true,
    empty: content.length === 0,
  }
}

function employee(overrides: Partial<Employee>): Employee {
  return {
    id: "emp_x",
    firstName: "Nombre",
    lastName: "Apellido",
    email: "empleado@example.com",
    phone: null,
    jobTitle: "Estilista",
    colorHex: null,
    isActive: true,
    createdAt: "2026-01-01T00:00:00",
    ...overrides,
  }
}

function workingHours(dayOfWeek: number, isOpen: boolean): WorkingHoursResponse {
  return { dayOfWeek, isOpen, openTime: "09:00:00", closeTime: "20:00:00", breakStartTime: null, breakEndTime: null }
}

function appointment(overrides: Partial<Appointment>): Appointment {
  return {
    id: "apt_x",
    tenantId: "tenant_1",
    clientId: null,
    clientName: "Cliente",
    clientPhone: null,
    clientEmail: null,
    employeeId: "emp_laura",
    employeeName: "Laura Martinez",
    serviceId: "svc_1",
    serviceName: "Corte",
    servicePrice: 20,
    serviceDurationMinutes: 30,
    startTime: "2026-08-26T09:00:00",
    endTime: "2026-08-26T09:30:00",
    status: "CONFIRMED",
    source: "MANUAL",
    notes: null,
    reminderSent: false,
    createdAt: "2026-08-26T08:00:00",
    updatedAt: "2026-08-26T08:00:00",
    ...overrides,
  }
}

// Miercoles 26/08/2026 -- dayOfWeek 3 en el convenio de `WorkingHoursResponse`
// (lunes = 1 ... domingo = 7).
const TODAY = new Date(2026, 7, 26)
const TODAY_DAY_OF_WEEK = 3

const laura = employee({ id: "emp_laura", firstName: "Laura", lastName: "Martinez", jobTitle: "Estilista" })
const sofia = employee({ id: "emp_sofia", firstName: "Sofia", lastName: "Puig", jobTitle: "Manicurista" })
const marc = employee({ id: "emp_marc", firstName: "Marc", lastName: "Oliva", jobTitle: "Barbero" })
const julia = employee({ id: "emp_julia", firstName: "Julia", lastName: "Ventura", jobTitle: "Estilista" })

function mockEmployees(list: Employee[], isLoading = false) {
  mockUseEmployees.mockReturnValue({ data: page(list), isLoading } as unknown as ReturnType<typeof useEmployees>)
}

function mockWorkingHours(byEmployee: Record<string, WorkingHoursResponse[]>) {
  mockUseEmployeesWorkingHours.mockReturnValue({
    data: byEmployee,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useEmployeesWorkingHours>)
}

function mockTodayAppointments(list: Appointment[]) {
  mockUseTodayAppointments.mockReturnValue({ data: page(list), isLoading: false } as unknown as ReturnType<
    typeof useTodayAppointments
  >)
}

describe("EmployeeStep", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(TODAY)
    useWizardStore.getState().reset()
    mockMatchMedia(false)

    mockEmployees([laura, sofia, marc, julia])
    mockWorkingHours({
      emp_laura: [workingHours(TODAY_DAY_OF_WEEK, true)],
      emp_sofia: [workingHours(TODAY_DAY_OF_WEEK, true)],
      emp_marc: [workingHours(TODAY_DAY_OF_WEEK, true)],
      emp_julia: [workingHours(TODAY_DAY_OF_WEEK, false)],
    })
    mockTodayAppointments([
      appointment({ id: "apt_1", employeeId: "emp_laura", status: "CONFIRMED" }),
      appointment({ id: "apt_2", employeeId: "emp_laura", status: "COMPLETED" }),
      appointment({ id: "apt_3", employeeId: "emp_laura", status: "CANCELLED" }),
      appointment({ id: "apt_4", employeeId: "emp_sofia", status: "PENDING" }),
    ])
  })

  afterEach(() => {
    vi.useRealTimers()
    mockMatchMedia(false)
  })

  it("la lista sale en el orden del artboard, con 'Sin preferencia' primera", () => {
    render(<EmployeeStep />)

    const options = within(screen.getByTestId("employee-options")).getAllByRole("button")
    expect(options).toHaveLength(5)
    expect(options[0]).toHaveTextContent("Sin preferencia")
    expect(options[1]).toHaveTextContent("Laura Martinez")
    expect(options[2]).toHaveTextContent("Sofia Puig")
    expect(options[3]).toHaveTextContent("Marc Oliva")
    expect(options[4]).toHaveTextContent("Julia Ventura")
  })

  it("el que hoy no trabaja SI responde al clic y se pinta atenuado", () => {
    // `fireEvent`, no `userEvent`: `userEvent` programa su simulacion de
    // click con `setTimeout` interno, que se queda colgado combinado con
    // `vi.useFakeTimers()` (aqui activos para fijar "hoy") y cuelga la
    // prueba hasta el timeout de Vitest.
    render(<EmployeeStep />)

    const juliaButton = screen.getByRole("button", { name: /Julia Ventura/ })
    expect(juliaButton).toHaveClass("opacity-[0.55]")
    expect(juliaButton).toHaveTextContent("hoy no trabaja")

    fireEvent.click(juliaButton)

    const state = useWizardStore.getState()
    expect(state.selectedEmployee?.id).toBe("emp_julia")
    expect(state.anyEmployee).toBe(false)
    expect(state.step).toBe(2)
  })

  it("con mockMatchMedia(true) aparece 'citas hoy'", () => {
    mockMatchMedia(true)
    render(<EmployeeStep />)

    expect(screen.getAllByText("citas hoy").length).toBeGreaterThan(0)
  })

  it("con mockMatchMedia(false) no aparece 'citas hoy'", () => {
    mockMatchMedia(false)
    render(<EmployeeStep />)

    expect(screen.queryByText("citas hoy")).not.toBeInTheDocument()
  })

  it("'Sin preferencia' pone anyEmployee y avanza al paso 2", () => {
    render(<EmployeeStep />)

    fireEvent.click(screen.getByRole("button", { name: /Sin preferencia/ }))

    const state = useWizardStore.getState()
    expect(state.anyEmployee).toBe(true)
    expect(state.selectedEmployee).toBeNull()
    expect(state.step).toBe(2)
  })

  it("con preferredEmployeeId valido, selecciona ese empleado y avanza", () => {
    useWizardStore.setState({ preferredEmployeeId: "emp_sofia" })

    render(<EmployeeStep />)

    const state = useWizardStore.getState()
    expect(state.selectedEmployee?.id).toBe("emp_sofia")
    expect(state.anyEmployee).toBe(false)
    expect(state.step).toBe(2)
  })

  it("con preferredEmployeeId que no casa, limpia la preferencia y se queda en el paso 1", () => {
    useWizardStore.setState({ preferredEmployeeId: "emp_no_existe" })

    render(<EmployeeStep />)

    const state = useWizardStore.getState()
    expect(state.preferredEmployeeId).toBeNull()
    expect(state.selectedEmployee).toBeNull()
    expect(state.step).toBe(1)
  })
})
