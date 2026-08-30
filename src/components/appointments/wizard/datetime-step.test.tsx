import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { addDays, format } from "date-fns"
import { DateTimeStep } from "./datetime-step"
import { formatWizardDayFooter } from "./wizard-summary"
import { useWizardStore } from "@/lib/stores/wizard-store"
import { useEmployees, useEmployeesServices, useEmployeesWorkingHours } from "@/hooks/use-staff"
import { useWizardAvailability, type WizardSlot } from "@/hooks/use-wizard-availability"
import type { Employee, EmployeeServiceResponse, WorkingHoursResponse } from "@/types/employee"
import type { ServiceOffering } from "@/types/service"

vi.mock("@/hooks/use-staff", () => ({
  useEmployees: vi.fn(),
  useEmployeesServices: vi.fn(),
  useEmployeesWorkingHours: vi.fn(),
}))

vi.mock("@/hooks/use-wizard-availability", () => ({ useWizardAvailability: vi.fn() }))

// `useWizardNavigation` llama a `useRouter()`: sin `AppRouterContext` montado
// lanza "invariant expected app router to be mounted" -- mismo mock que
// `service-step.test.tsx:20-22`.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}))

const useEmployeesMock = vi.mocked(useEmployees)
const useEmployeesServicesMock = vi.mocked(useEmployeesServices)
const useEmployeesWorkingHoursMock = vi.mocked(useEmployeesWorkingHours)
const useWizardAvailabilityMock = vi.mocked(useWizardAvailability)

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

const laura: Employee = {
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

const mia: Employee = {
  id: "emp_2",
  firstName: "Mia",
  lastName: "Soler",
  email: "mia@example.com",
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

function assignedTo(serviceId: string, employeeId = "emp_1"): EmployeeServiceResponse {
  return { employeeId, serviceId, customDurationMinutes: null, customPrice: null }
}

function mockEmployees(list: Employee[], isLoading = false) {
  useEmployeesMock.mockReturnValue({ data: { content: list }, isLoading } as unknown as ReturnType<
    typeof useEmployees
  >)
}

function mockEmployeesServices(data: Record<string, EmployeeServiceResponse[]>, isLoading = false) {
  useEmployeesServicesMock.mockReturnValue({ data, isLoading, isError: false } as unknown as ReturnType<
    typeof useEmployeesServices
  >)
}

function mockWorkingHours(data: Record<string, WorkingHoursResponse[]>, isLoading = false) {
  useEmployeesWorkingHoursMock.mockReturnValue({ data, isLoading, isError: false } as unknown as ReturnType<
    typeof useEmployeesWorkingHours
  >)
}

function mockAvailability(slots: WizardSlot[], isLoading = false) {
  useWizardAvailabilityMock.mockReturnValue({ slots, isLoading, isError: false } as unknown as ReturnType<
    typeof useWizardAvailability
  >)
}

describe("DateTimeStep", () => {
  beforeEach(() => {
    useWizardStore.getState().reset()
    mockMatchMedia(false)
    mockEmployees([laura])
    mockEmployeesServices({})
    mockWorkingHours({})
    mockAvailability([])
  })

  afterEach(() => {
    mockMatchMedia(false)
  })

  it("reparte los huecos entre Mañana y Tarde segun AFTERNOON_HOUR", () => {
    useWizardStore.setState({ selectedEmployee: laura, selectedService: service })
    mockAvailability([
      { startTime: "09:00:00", endTime: "09:30:00", employeeId: "emp_1" },
      { startTime: "15:00:00", endTime: "15:30:00", employeeId: "emp_1" },
    ])

    render(<DateTimeStep />)

    expect(screen.getByText("Mañana")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "09:00" })).toBeInTheDocument()
    expect(screen.getByText("Tarde")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "15:00" })).toBeInTheDocument()
  })

  it("un dia en que nadie del subconjunto trabaja no es pulsable", () => {
    const tomorrow = addDays(new Date(), 1)
    const jsDay = tomorrow.getDay()
    const closedDayOfWeek = jsDay === 0 ? 7 : jsDay // convenio WorkingHoursResponse: Lunes=1..Domingo=7

    useWizardStore.setState({ selectedEmployee: laura, selectedService: service })
    mockWorkingHours({
      emp_1: [
        {
          dayOfWeek: closedDayOfWeek,
          isOpen: false,
          openTime: "09:00",
          closeTime: "20:00",
          breakStartTime: null,
          breakEndTime: null,
        },
      ],
    })

    render(<DateTimeStep />)

    expect(screen.getByTestId("mobile-day-1")).toBeDisabled()
  })

  it("con 'Sin preferencia' consulta disponibilidad solo de quien ofrece el servicio, nunca sin filtrar", () => {
    useWizardStore.setState({ anyEmployee: true, selectedEmployee: null, selectedService: service })
    mockEmployees([laura, mia])
    mockEmployeesServices({ emp_1: [assignedTo(service.id)], emp_2: [] })

    render(<DateTimeStep />)

    expect(useWizardAvailabilityMock).toHaveBeenCalledWith(
      expect.objectContaining({ employeeIds: ["emp_1"] })
    )
  })

  it("elegir hueco con 'Sin preferencia' guarda fecha, hora y el employeeId del hueco", async () => {
    const user = userEvent.setup()
    const todayStr = format(new Date(), "yyyy-MM-dd")

    useWizardStore.setState({ anyEmployee: true, selectedEmployee: null, selectedService: service })
    mockEmployees([laura, mia])
    mockEmployeesServices({ emp_1: [assignedTo(service.id)], emp_2: [] })
    mockAvailability([{ startTime: "09:00:00", endTime: "09:30:00", employeeId: "emp_1" }])

    render(<DateTimeStep />)

    await user.click(screen.getByRole("button", { name: "09:00" }))

    const state = useWizardStore.getState()
    expect(state.selectedDate).toBe(todayStr)
    expect(state.selectedSlot).toBe(`${todayStr}T09:00:00`)
    expect(state.selectedSlotEmployeeId).toBe("emp_1")
  })

  it("el resumen del pie (dia completo + rango horario + precio) solo aparece en movil", () => {
    useWizardStore.setState({
      selectedEmployee: laura,
      selectedService: service,
      selectedDate: "2026-08-28",
      selectedSlot: "2026-08-28T09:00:00",
    })
    mockAvailability([{ startTime: "09:00:00", endTime: "09:30:00", employeeId: "emp_1" }])

    render(<DateTimeStep />)

    expect(screen.getByText(formatWizardDayFooter("2026-08-28"), { exact: false })).toBeInTheDocument()
  })

  it("el resumen del pie no aparece en escritorio (vive en el aside)", () => {
    mockMatchMedia(true)
    useWizardStore.setState({
      selectedEmployee: laura,
      selectedService: service,
      selectedDate: "2026-08-28",
      selectedSlot: "2026-08-28T09:00:00",
    })
    mockAvailability([{ startTime: "09:00:00", endTime: "09:30:00", employeeId: "emp_1" }])

    render(<DateTimeStep />)

    expect(screen.queryByText(formatWizardDayFooter("2026-08-28"), { exact: false })).not.toBeInTheDocument()
  })

  it("aplica preferredDate/preferredSlot si el hueco preferido sigue en la lista", () => {
    const preferredDate = format(addDays(new Date(), 2), "yyyy-MM-dd")
    const preferredSlot = `${preferredDate}T09:00:00`

    useWizardStore.setState({
      selectedEmployee: laura,
      selectedService: service,
      preferredDate,
      preferredSlot,
    })
    mockAvailability([{ startTime: "09:00:00", endTime: "09:30:00", employeeId: "emp_1" }])

    render(<DateTimeStep />)

    const state = useWizardStore.getState()
    expect(state.selectedDate).toBe(preferredDate)
    expect(state.selectedSlot).toBe(preferredSlot)
    expect(state.selectedSlotEmployeeId).toBe("emp_1")
    expect(state.preferredSlot).toBeNull()
  })

  it("descarta preferredSlot si ya no esta en la lista, pero abre ese dia sin hueco elegido", () => {
    const preferredDate = format(addDays(new Date(), 2), "yyyy-MM-dd")
    const preferredSlot = `${preferredDate}T10:00:00`

    useWizardStore.setState({
      selectedEmployee: laura,
      selectedService: service,
      preferredDate,
      preferredSlot,
    })
    mockAvailability([{ startTime: "09:00:00", endTime: "09:30:00", employeeId: "emp_1" }])

    render(<DateTimeStep />)

    const state = useWizardStore.getState()
    expect(state.selectedDate).toBeNull()
    expect(state.selectedSlot).toBeNull()
    expect(screen.getByTestId("mobile-day-2").className).toMatch(/bg-primary/)
  })

  it("la tira movil llega a 30 dias de horizonte", () => {
    useWizardStore.setState({ selectedEmployee: laura, selectedService: service })

    render(<DateTimeStep />)

    expect(screen.getByTestId("mobile-day-29")).toBeInTheDocument()
    expect(screen.queryByTestId("mobile-day-30")).not.toBeInTheDocument()
  })

  it("escritorio navega semanas: la primera pagina no retrocede y 'siguiente' avanza 7 dias", async () => {
    mockMatchMedia(true)
    const user = userEvent.setup()
    useWizardStore.setState({ selectedEmployee: laura, selectedService: service })

    render(<DateTimeStep />)

    expect(screen.getByRole("button", { name: "Semana anterior" })).toBeDisabled()
    expect(screen.queryByTestId("desktop-day-7")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Semana siguiente" }))

    expect(screen.getByTestId("desktop-day-7")).toBeInTheDocument()
  })

  it("pinta el vacio cuando ningun empleado del subconjunto ofrece el servicio", () => {
    useWizardStore.setState({ anyEmployee: true, selectedEmployee: null, selectedService: service })
    mockEmployees([laura, mia])
    mockEmployeesServices({ emp_1: [], emp_2: [] })

    render(<DateTimeStep />)

    expect(screen.getByText("Ningún profesional ofrece este servicio")).toBeInTheDocument()
    expect(screen.queryByTestId("mobile-day-0")).not.toBeInTheDocument()
  })

  it("el boton 'Volver' del vacio retrocede al paso 2", async () => {
    const user = userEvent.setup()
    useWizardStore.setState({
      step: 3,
      anyEmployee: true,
      selectedEmployee: null,
      selectedService: service,
    })
    mockEmployees([laura, mia])
    mockEmployeesServices({ emp_1: [], emp_2: [] })

    render(<DateTimeStep />)

    await user.click(screen.getByRole("button", { name: "Volver a servicios" }))

    expect(useWizardStore.getState().step).toBe(2)
  })

  it("sigue mostrando el vacio de huecos cuando el backend devuelve slots: []", () => {
    useWizardStore.setState({ selectedEmployee: laura, selectedService: service })
    mockAvailability([])

    render(<DateTimeStep />)

    expect(screen.getByText("No hay huecos disponibles este dia.")).toBeInTheDocument()
  })

  it("el aside dice 'Resumen' y no lleva la nota de confianza de la reserva publica", () => {
    mockMatchMedia(true)
    useWizardStore.setState({ selectedEmployee: laura, selectedService: service })

    render(<DateTimeStep />)

    expect(screen.getByText("Resumen")).toBeInTheDocument()
    expect(screen.queryByText("Tu reserva")).not.toBeInTheDocument()
    expect(screen.queryByText(/Sin registro/)).not.toBeInTheDocument()
  })

  it("con 'Sin preferencia' pinta el spinner (no 'No hay huecos') mientras useEmployeesServices sigue cargando", () => {
    useWizardStore.setState({ anyEmployee: true, selectedEmployee: null, selectedService: service })
    mockEmployees([laura, mia])
    // Cache fria: el paso 2 con "Sin preferencia" llama `useEmployeeServices(undefined)`
    // (deshabilitado), asi que al montar el paso 3 esta consulta sigue en vuelo.
    mockEmployeesServices({}, true)

    const { container } = render(<DateTimeStep />)

    expect(screen.queryByText("No hay huecos disponibles este dia.")).not.toBeInTheDocument()
    expect(container.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("al volver al paso 3, el calendario abre en selectedDate y no salta a hoy", () => {
    const offset = 5
    const chosenDate = format(addDays(new Date(), offset), "yyyy-MM-dd")

    useWizardStore.setState({
      selectedEmployee: laura,
      selectedService: service,
      selectedDate: chosenDate,
      selectedSlot: `${chosenDate}T11:00:00`,
      selectedSlotEmployeeId: "emp_1",
      preferredDate: null,
      preferredSlot: null,
    })
    mockAvailability([{ startTime: "11:00:00", endTime: "12:30:00", employeeId: "emp_1" }])

    render(<DateTimeStep />)

    expect(screen.getByTestId(`mobile-day-${offset}`).className).toMatch(/bg-primary/)
    expect(screen.getByTestId("mobile-day-0").className).not.toMatch(/bg-primary/)
  })

  it("el nombre del dia de una celda movil abierta y no seleccionada usa el color atenuado", () => {
    useWizardStore.setState({ selectedEmployee: laura, selectedService: service })

    render(<DateTimeStep />)

    const dayNameSpan = screen.getByTestId("mobile-day-2").querySelectorAll("span")[0]
    expect(dayNameSpan.className).toMatch(/text-muted-foreground\b/)
    expect(dayNameSpan.className).toMatch(/leading-none/)
  })

  it("el nombre del dia de una celda de escritorio abierta y no seleccionada usa el color atenuado", () => {
    mockMatchMedia(true)
    useWizardStore.setState({ selectedEmployee: laura, selectedService: service })

    render(<DateTimeStep />)

    const dayNameSpan = screen.getByTestId("desktop-day-2").querySelectorAll("span")[0]
    expect(dayNameSpan.className).toMatch(/text-muted-foreground\b/)
    expect(dayNameSpan.className).toMatch(/leading-none/)
  })

  it("el numero de dia en escritorio usa 21px y tipografia display", () => {
    mockMatchMedia(true)
    useWizardStore.setState({ selectedEmployee: laura, selectedService: service })

    render(<DateTimeStep />)

    const numberSpan = screen.getByTestId("desktop-day-0").querySelectorAll("span")[1]
    expect(numberSpan.className).toMatch(/text-\[21px\]/)
    expect(numberSpan.className).toMatch(/font-heading/)
    expect(numberSpan.className).toMatch(/tracking-display/)
  })

  it("el numero de dia en movil sigue en 20px (text-xl) pero ya lleva tipografia display", () => {
    useWizardStore.setState({ selectedEmployee: laura, selectedService: service })

    render(<DateTimeStep />)

    const numberSpan = screen.getByTestId("mobile-day-0").querySelectorAll("span")[1]
    expect(numberSpan.className).toMatch(/text-xl\b/)
    expect(numberSpan.className).not.toMatch(/text-\[21px\]/)
    expect(numberSpan.className).toMatch(/font-heading/)
    expect(numberSpan.className).toMatch(/tracking-display/)
  })

  it("la tercera linea ('Cerrado') de una celda de escritorio cerrada lleva leading-none", () => {
    mockMatchMedia(true)
    const tomorrow = addDays(new Date(), 1)
    const jsDay = tomorrow.getDay()
    const closedDayOfWeek = jsDay === 0 ? 7 : jsDay

    useWizardStore.setState({ selectedEmployee: laura, selectedService: service })
    mockWorkingHours({
      emp_1: [
        {
          dayOfWeek: closedDayOfWeek,
          isOpen: false,
          openTime: "09:00",
          closeTime: "20:00",
          breakStartTime: null,
          breakEndTime: null,
        },
      ],
    })

    render(<DateTimeStep />)

    const thirdSpan = screen.getByTestId("desktop-day-1").querySelectorAll("span")[2]
    expect(thirdSpan.textContent).toBe("Cerrado")
    expect(thirdSpan.className).toMatch(/leading-none/)
  })

  it("SlotSection usa 10px de espaciado vertical en movil (gap-2.5)", () => {
    useWizardStore.setState({ selectedEmployee: laura, selectedService: service })
    mockAvailability([{ startTime: "09:00:00", endTime: "09:30:00", employeeId: "emp_1" }])

    render(<DateTimeStep />)

    expect(screen.getByText("Mañana").parentElement?.className).toMatch(/gap-2\.5/)
  })

  it("SlotSection usa 12px de espaciado vertical en escritorio (gap-3)", () => {
    mockMatchMedia(true)
    useWizardStore.setState({ selectedEmployee: laura, selectedService: service })
    mockAvailability([{ startTime: "09:00:00", endTime: "09:30:00", employeeId: "emp_1" }])

    render(<DateTimeStep />)

    expect(screen.getByText("Mañana").parentElement?.className).toMatch(/gap-3\b/)
  })

  it("con 'Sin preferencia' y hueco ya elegido, el aside nombra al profesional del hueco", () => {
    mockMatchMedia(true)
    const todayStr = format(new Date(), "yyyy-MM-dd")

    useWizardStore.setState({
      anyEmployee: true,
      selectedEmployee: null,
      selectedService: service,
      selectedDate: todayStr,
      selectedSlot: `${todayStr}T09:00:00`,
      selectedSlotEmployeeId: "emp_2",
    })
    mockEmployees([laura, mia])
    mockEmployeesServices({ emp_1: [assignedTo(service.id)], emp_2: [assignedTo(service.id, "emp_2")] })
    mockAvailability([{ startTime: "09:00:00", endTime: "09:30:00", employeeId: "emp_2" }])

    render(<DateTimeStep />)

    expect(screen.getByText("Mia Soler")).toBeInTheDocument()
    expect(screen.queryByText("Sin preferencia")).not.toBeInTheDocument()
  })

  it("con dos empleados de horarios mixtos (uno cerrado, otro abierto), el dia sigue pulsable", () => {
    const tomorrow = addDays(new Date(), 1)
    const jsDay = tomorrow.getDay()
    const dow = jsDay === 0 ? 7 : jsDay

    useWizardStore.setState({ anyEmployee: true, selectedEmployee: null, selectedService: service })
    mockEmployees([laura, mia])
    mockEmployeesServices({ emp_1: [assignedTo(service.id)], emp_2: [assignedTo(service.id, "emp_2")] })
    mockWorkingHours({
      emp_1: [
        { dayOfWeek: dow, isOpen: false, openTime: "09:00", closeTime: "20:00", breakStartTime: null, breakEndTime: null },
      ],
      emp_2: [
        { dayOfWeek: dow, isOpen: true, openTime: "09:00", closeTime: "20:00", breakStartTime: null, breakEndTime: null },
      ],
    })

    render(<DateTimeStep />)

    expect(screen.getByTestId("mobile-day-1")).not.toBeDisabled()
  })
})
