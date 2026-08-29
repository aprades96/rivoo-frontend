import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import CalendarPage from "./page"
import type { Appointment } from "@/types/appointment"
import type { Employee } from "@/types/employee"

/**
 * La pantalla se conduce por HOOKS MOCKEADOS, nunca por un `QueryClient` vivo:
 * asi cada caso es un render sincrono y no interviene el `notifyManager` de
 * React Query, cuyo macrotask deja pasar en verde pruebas que no prueban nada
 * (ver `AGENTS.md`). Mismo patron que `src/app/(app)/today/page.test.tsx`.
 */
const useAppointmentsMock = vi.fn()
const useEmployeesMock = vi.fn()
const useEmployeesWorkingHoursMock = vi.fn()
const pushMock = vi.fn()

vi.mock("@/hooks/use-appointments", () => ({
  useAppointments: (...args: unknown[]) => useAppointmentsMock(...args),
  useUpdateAppointmentStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useCancelAppointment: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock("@/hooks/use-staff", () => ({
  useEmployees: () => useEmployeesMock(),
  useEmployeesWorkingHours: (...args: unknown[]) => useEmployeesWorkingHoursMock(...args),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, back: vi.fn(), replace: vi.fn() }),
}))

/**
 * El polyfill de `src/test/setup.ts` devuelve SIEMPRE `matches: false`, o sea
 * movil. Escritorio hay que simularlo aqui, y devolverlo a movil en `afterEach`
 * para no contaminar al siguiente caso. Patron de
 * `src/components/booking/booking-step-shell.test.tsx:24`.
 */
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

// El dia visible sale de `new Date()` al montar: sin fijar el reloj, el titulo
// de escritorio cambiaria cada dia y la prueba se pondria roja sola.
const TODAY = new Date(2026, 7, 27, 10, 0) // jueves 27 de agosto de 2026
const TODAY_ISO = "2026-08-27"
const TODAY_LABEL = "Jueves, 27 de agosto"

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp_1",
    firstName: "Laura",
    lastName: "Martinez",
    email: "laura@salon.test",
    phone: null,
    jobTitle: null,
    colorHex: "#B4522F",
    isActive: true,
    createdAt: `${TODAY_ISO}T08:00:00`,
    ...overrides,
  }
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "apt_1",
    tenantId: "tenant_1",
    clientId: "cli_1",
    clientName: "Carla Ruiz",
    clientPhone: null,
    clientEmail: null,
    employeeId: "emp_1",
    employeeName: "Laura Martinez",
    serviceId: "svc_1",
    serviceName: "Corte y secado",
    servicePrice: 35,
    serviceDurationMinutes: 60,
    startTime: `${TODAY_ISO}T09:00:00`,
    endTime: `${TODAY_ISO}T10:00:00`,
    status: "CONFIRMED",
    source: "MANUAL",
    notes: null,
    reminderSent: false,
    createdAt: `${TODAY_ISO}T08:00:00`,
    updatedAt: `${TODAY_ISO}T08:00:00`,
    ...overrides,
  }
}

const EMPLOYEES: Employee[] = [
  makeEmployee(),
  makeEmployee({ id: "emp_2", firstName: "Sofia", lastName: "Puig", colorHex: null }),
]

const APPOINTMENTS: Appointment[] = [
  makeAppointment(),
  makeAppointment({
    id: "apt_2",
    clientName: "Ana Garcia",
    serviceName: "Manicura",
    employeeId: "emp_2",
    employeeName: "Sofia Puig",
    startTime: `${TODAY_ISO}T10:30:00`,
    endTime: `${TODAY_ISO}T12:00:00`,
  }),
  // La cancelada del artboard (`CalendarioDesktop.dc.html:225-228`).
  makeAppointment({
    id: "apt_3",
    clientName: "Nuria Sole",
    serviceName: "Color",
    startTime: `${TODAY_ISO}T12:30:00`,
    endTime: `${TODAY_ISO}T13:00:00`,
    status: "CANCELLED",
  }),
]

/** Los parametros de la ULTIMA llamada a `useAppointments`. */
function lastQueryParams(): Record<string, unknown> {
  const calls = useAppointmentsMock.mock.calls
  expect(calls.length).toBeGreaterThan(0)
  return calls[calls.length - 1][0] as Record<string, unknown>
}

/**
 * El nombre del cliente es el primer `<span>` del bloque
 * (`appointment-block.tsx:239`, `ClientName`).
 */
function clientNames(): string[] {
  return screen
    .getAllByTestId("appointment-block")
    .map((block) => block.querySelector("span")?.textContent ?? "")
}

describe("CalendarPage", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(TODAY)

    useAppointmentsMock.mockReset()
    useEmployeesMock.mockReset()
    useEmployeesWorkingHoursMock.mockReset()
    pushMock.mockReset()

    useAppointmentsMock.mockReturnValue({ data: { content: APPOINTMENTS }, isLoading: false })
    useEmployeesMock.mockReturnValue({ data: { content: EMPLOYEES } })
    useEmployeesWorkingHoursMock.mockReturnValue({
      data: {},
      isLoading: false,
      isError: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    mockMatchMedia(false)
  })

  // --- Titulo por ancho ----------------------------------------------------

  it("en movil el titulo es 'Citas' y la fecha vive en su propia fila", () => {
    mockMatchMedia(false)

    render(<CalendarPage />)

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Citas")
    // La fecha no esta en la cabecera (Calendario.dc.html:26): esta abajo, en
    // `DateNavigatorRow`, y una sola vez.
    expect(screen.getAllByText(TODAY_LABEL)).toHaveLength(1)
  })

  it("en escritorio el titulo ES la fecha", () => {
    mockMatchMedia(true)

    render(<CalendarPage />)

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(TODAY_LABEL)
    expect(screen.queryByRole("heading", { name: "Citas" })).not.toBeInTheDocument()
  })

  /**
   * REGRESION de la deuda del bloque anterior: el titulo de escritorio ya es
   * la fecha, asi que el navegador que va pegado a el NO puede repetirla y la
   * fila movil (que si la escribe) no se monta aqui. Sin este caso, basta con
   * que alguien vuelva a colar `DateNavigatorRow` en la rama de escritorio
   * para que la fecha salga dos veces sin que nada se ponga rojo.
   */
  it("en escritorio la fecha aparece UNA SOLA VEZ en toda la pantalla", () => {
    mockMatchMedia(true)

    render(<CalendarPage />)

    expect(screen.getAllByText(TODAY_LABEL)).toHaveLength(1)
  })

  // --- Cadena de alturas ---------------------------------------------------

  /**
   * REGRESION de la invariante de `FILL_ROUTES`: la rejilla tiene que colgar
   * DIRECTAMENTE del contenedor `flex min-h-0 flex-1 flex-col` de `PageShell`.
   * Cualquier envoltorio intermedio sin esas clases (el `flex flex-col gap-3`
   * que habia antes, por ejemplo) corta la cadena, `DayView` se pinta a sus
   * 1248px y el scroll se lo queda una pagina que ademas es `overflow-hidden`.
   */
  it("la rejilla cuelga directamente del contenedor de PageShell, sin envoltorio", () => {
    mockMatchMedia(true)

    const { container } = render(<CalendarPage />)

    const content = container.querySelector('[data-slot="page-shell-content"]')
    expect(content).not.toBeNull()
    expect(screen.getByTestId("day-view").parentElement).toBe(content)
  })

  // --- Canceladas ----------------------------------------------------------

  /**
   * REGRESION del filtro borrado: la pantalla escondia las canceladas
   * (`.filter(a => a.status !== "CANCELLED")`). El artboard las dibuja con su
   * color y su etiqueta (`CalendarioDesktop.dc.html:225-228`), y esconderlas
   * deja en la rejilla un hueco que parece libre y no lo esta.
   */
  it("pinta las citas canceladas en vez de esconderlas", () => {
    mockMatchMedia(true)

    render(<CalendarPage />)

    expect(screen.getAllByTestId("appointment-block")).toHaveLength(APPOINTMENTS.length)

    const cancelled = screen.getByText("Nuria Sole").closest('[data-testid="appointment-block"]')
    expect(cancelled).not.toBeNull()
    expect(cancelled).toHaveAttribute("data-status", "CANCELLED")
  })

  // --- Buscador ------------------------------------------------------------

  it("el buscador filtra por nombre de cliente", () => {
    mockMatchMedia(false)

    render(<CalendarPage />)
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar citas" }), {
      target: { value: "carla" },
    })

    expect(clientNames()).toEqual(["Carla Ruiz"])
  })

  it("el buscador filtra por nombre de servicio", () => {
    mockMatchMedia(false)

    render(<CalendarPage />)
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }))
    // "Manicura" es el servicio de Ana Garcia y no aparece en ningun otro
    // campo: si el filtro solo mirase el cliente, esto vaciaria la rejilla.
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar citas" }), {
      target: { value: "manicura" },
    })

    expect(clientNames()).toEqual(["Ana Garcia"])
  })

  it("Escape repliega el buscador y devuelve todas las citas", () => {
    mockMatchMedia(false)

    render(<CalendarPage />)
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }))
    const field = screen.getByRole("textbox", { name: "Buscar citas" })
    fireEvent.change(field, { target: { value: "carla" } })
    expect(screen.getAllByTestId("appointment-block")).toHaveLength(1)

    fireEvent.keyDown(field, { key: "Escape" })

    expect(screen.queryByRole("textbox", { name: "Buscar citas" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Buscar" })).toBeInTheDocument()
    expect(screen.getAllByTestId("appointment-block")).toHaveLength(APPOINTMENTS.length)
  })

  // --- La consulta cambia por ancho ----------------------------------------

  it("en movil la consulta lleva el employeeId del filtro de pildoras", () => {
    mockMatchMedia(false)

    render(<CalendarPage />)
    expect(lastQueryParams().employeeId).toBeUndefined()

    fireEvent.click(screen.getByRole("button", { name: /Sofia/ }))

    expect(lastQueryParams()).toMatchObject({ date: TODAY_ISO, employeeId: "emp_2" })
  })

  /**
   * En escritorio hay una columna POR empleado, no un filtro: mandar
   * `employeeId` vaciaria todas las demas columnas. El caso cruza los 1024px
   * con el filtro ya puesto porque es la unica forma de que el id exista en
   * escritorio -- `EmployeeFilter` no se monta alli, asi que sin el cruce la
   * prueba pasaria igual con la guarda quitada.
   */
  it("en escritorio la consulta va SIN employeeId aunque el filtro movil tuviera uno puesto", () => {
    mockMatchMedia(false)

    const { rerender } = render(<CalendarPage />)
    fireEvent.click(screen.getByRole("button", { name: /Sofia/ }))
    expect(lastQueryParams().employeeId).toBe("emp_2")

    mockMatchMedia(true)
    rerender(<CalendarPage />)

    expect(lastQueryParams().employeeId).toBeUndefined()
    expect(lastQueryParams()).toMatchObject({ date: TODAY_ISO })
  })

  // --- Franja vacia --------------------------------------------------------

  it("pulsar una franja vacia lleva al alta con el dia, la hora y el empleado", () => {
    mockMatchMedia(true)

    const { container } = render(<CalendarPage />)

    // Hay una franja de cada hora POR columna, y el `employeeId` esperado es
    // el de Laura: se acota a su columna. El nombre accesible tambien lleva el
    // de la columna -- sin el, las tres franjas de las 15:30 se anunciaban
    // exactamente igual.
    const column = container.querySelector(
      '[data-testid="day-view-column"][data-employee-id="emp_1"]'
    ) as HTMLElement
    fireEvent.click(
      within(column).getByRole("button", { name: "Crear cita a las 15:30 con Laura Martinez" })
    )

    expect(pushMock).toHaveBeenCalledTimes(1)
    const url = new URL(pushMock.mock.calls[0][0] as string, "http://localhost")
    expect(url.pathname).toBe("/appointments/new")
    expect(url.searchParams.get("date")).toBe(TODAY_ISO)
    expect(url.searchParams.get("time")).toBe("15:30")
    expect(url.searchParams.get("employeeId")).toBe("emp_1")
  })

  // --- Detalle -------------------------------------------------------------

  it("pulsar un bloque abre el detalle de esa cita", () => {
    mockMatchMedia(true)

    render(<CalendarPage />)
    fireEvent.click(screen.getByText("Ana Garcia"))

    expect(screen.getByText("Detalle de cita")).toBeInTheDocument()
    // El bloque de la rejilla y la hoja: dos apariciones del mismo nombre.
    expect(screen.getAllByText("Ana Garcia")).toHaveLength(2)
  })
})
