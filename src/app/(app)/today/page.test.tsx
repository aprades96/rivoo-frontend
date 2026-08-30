import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import TodayPage from "./page"
import type { Appointment } from "@/types/appointment"
import type { Employee, WorkingHoursResponse } from "@/types/employee"
import type { ServiceOffering } from "@/types/service"

// Driving the page through mocked hooks (never a live QueryClient) keeps every
// case below a plain, synchronous render: no react-query notifyManager
// macrotask involved anywhere in this file (see AGENTS.md).
const useTodayAppointmentsMock = vi.fn()
const useServicesMock = vi.fn()
const useAuthMock = vi.fn()
const useSalonMock = vi.fn()

vi.mock("@/hooks/use-appointments", () => ({
  useTodayAppointments: (...args: unknown[]) => useTodayAppointmentsMock(...args),
  useUpdateAppointmentStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useCancelAppointment: () => ({ mutate: vi.fn(), isPending: false }),
}))

// TRAMPA 15: `vi.mock` sustituye el modulo `@/hooks/use-staff` ENTERO -- todo
// hook que no aparezca aqui vale `undefined` para CUALQUIER componente
// montado por esta pagina, se use o no en cada caso. `TodayPage` (T8) llama a
// `useEmployees()` y `useEmployeesWorkingHours()` directamente (para
// `getNowRows`), y `AppointmentCard`/`AppointmentDetailSheet` llaman a
// `useEmployees()` por su cuenta (D11) -- los TRES tienen que estar
// sembrados o hasta los casos que no tocan empleados revientan con un
// `TypeError` en cuanto se monte cualquier fila.
const useEmployeesMock = vi.fn()
const useEmployeesWorkingHoursMock = vi.fn()

vi.mock("@/hooks/use-staff", () => ({
  useServices: (...args: unknown[]) => useServicesMock(...args),
  useEmployees: (...args: unknown[]) => useEmployeesMock(...args),
  useEmployeesWorkingHours: (...args: unknown[]) => useEmployeesWorkingHoursMock(...args),
}))

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock("@/hooks/use-salon", () => ({
  useSalon: () => useSalonMock(),
}))

// TodayPage now mounts PageShell (T7a), which calls `useRouter()`
// unconditionally for its back-navigation defaults even though this page
// passes neither `back` nor `desktopBack`. `PendingOnlineCard` (escritorio,
// D17) tambien llama a `useRouter()` para navegar a `/calendar`. Same mock
// shape already used by every other page that renders PageShell/router.back(),
// e.g. src/app/(app)/settings/salon/page.test.tsx and
// src/app/(app)/staff/[id]/page.test.tsx.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}))

/**
 * El polyfill de `src/test/setup.ts` devuelve SIEMPRE `matches: false`, o sea
 * movil. Escritorio hay que simularlo aqui, y devolverlo a movil en
 * `afterEach` para no contaminar el siguiente caso. Patron de
 * `src/app/(app)/calendar/page.test.tsx:39-50`.
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

// Reloj fijo: `now` (D33) es estado inicializado con `new Date()` al montar,
// y el saludo/la fecha tambien leen el reloj real -- sin fijarlo, cualquier
// asercion sobre esos textos seria fragil segun la hora/dia en que corra la
// suite. Jueves 27 de agosto de 2026, 10:15 -> "Buenos dias" (hora < 12) y
// dayOfWeek jueves = 4 (lunes=1..domingo=7, `dates.ts:91-94`).
const TODAY_ISO = "2026-08-27"
const NOW = new Date(2026, 7, 27, 10, 15)

function appointmentsResult(overrides: Partial<ReturnType<typeof defaultAppointments>> = {}) {
  return { ...defaultAppointments(), ...overrides }
}

function defaultAppointments() {
  return {
    data: { content: [] as Appointment[] },
    isLoading: false,
    isRefetching: false,
    refetch: vi.fn(),
  }
}

function servicesResult(overrides: Partial<ReturnType<typeof defaultServices>> = {}) {
  return { ...defaultServices(), ...overrides }
}

function defaultServices() {
  return {
    data: { content: [] as ServiceOffering[] },
    isLoading: false,
    error: null as unknown,
  }
}

const oneService: ServiceOffering = {
  id: "svc_1",
  name: "Corte hombre",
  description: null,
  durationMinutes: 30,
  price: 15,
  category: null,
  isActive: true,
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "apt_1",
    tenantId: "tenant_1",
    clientId: "client_1",
    clientName: "Marta Ruiz",
    clientPhone: null,
    clientEmail: null,
    employeeId: "emp_1",
    employeeName: "Laura Martinez",
    serviceId: "svc_1",
    serviceName: "Corte hombre",
    servicePrice: 40,
    serviceDurationMinutes: 30,
    startTime: `${TODAY_ISO}T09:00:00`,
    endTime: `${TODAY_ISO}T09:30:00`,
    status: "CONFIRMED",
    source: "MANUAL",
    notes: null,
    reminderSent: false,
    createdAt: `${TODAY_ISO}T08:00:00`,
    updatedAt: `${TODAY_ISO}T08:00:00`,
    ...overrides,
  }
}

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

// dayOfWeek 4 = jueves (lunes=1..domingo=7), el mismo dia que `NOW`.
function offHours(overrides: Partial<WorkingHoursResponse> = {}): WorkingHoursResponse[] {
  return [
    {
      dayOfWeek: 4,
      isOpen: false,
      openTime: "00:00:00",
      closeTime: "00:00:00",
      breakStartTime: null,
      breakEndTime: null,
      ...overrides,
    },
  ]
}

describe("TodayPage", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)

    useTodayAppointmentsMock.mockReset()
    useServicesMock.mockReset()
    useAuthMock.mockReset()
    useAuthMock.mockReturnValue({ user: { name: "Ana Garcia" } })
    useSalonMock.mockReset()
    useSalonMock.mockReturnValue({ data: { name: "Salon Ejemplo" } })
    useEmployeesMock.mockReset()
    useEmployeesMock.mockReturnValue({ data: { content: [] } })
    useEmployeesWorkingHoursMock.mockReset()
    useEmployeesWorkingHoursMock.mockReturnValue({ data: {}, isLoading: false, isError: false })
    mockMatchMedia(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    mockMatchMedia(false)
  })

  it("muestra el aviso de servicios cuando el salon no tiene ninguno, en vez del vacio de citas", () => {
    useTodayAppointmentsMock.mockReturnValue(appointmentsResult())
    useServicesMock.mockReturnValue(servicesResult({ data: { content: [] } }))

    render(<TodayPage />)

    expect(screen.getByText("Aun no tienes servicios")).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "Crear servicio" })
    // /staff abre por defecto en Empleados (defaultValue="employees"); sin la
    // query el dueño aterriza donde no hay nada que crear para este flujo.
    expect(link).toHaveAttribute("href", "/staff?tab=services")

    // El vacio generico de citas no debe convivir con este aviso: serian dos
    // mensajes contradictorios (uno dice "sin servicios", el otro "crea una
    // cita") para el mismo motivo real.
    expect(screen.queryByText("No hay citas para hoy")).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Crear cita" })).not.toBeInTheDocument()
  })

  it("no muestra el aviso de servicios mientras la lista de servicios todavia esta cargando", () => {
    useTodayAppointmentsMock.mockReturnValue(appointmentsResult({ isLoading: true }))
    useServicesMock.mockReturnValue(servicesResult({ data: undefined, isLoading: true }))

    const { container } = render(<TodayPage />)

    expect(screen.queryByText("Aun no tienes servicios")).not.toBeInTheDocument()

    // Positive assertion, not just absence: without it, a page that returns
    // `null` while loading (blank screen) would still make the line above
    // pass. The appointments timeline is `isLoading`, so its skeleton is
    // what proves the normal agenda actually rendered.
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
  })

  it("muestra el flujo normal de citas cuando el salon ya tiene al menos un servicio", () => {
    useTodayAppointmentsMock.mockReturnValue(appointmentsResult({ data: { content: [] } }))
    useServicesMock.mockReturnValue(servicesResult({ data: { content: [oneService] } }))

    render(<TodayPage />)

    expect(screen.queryByText("Aun no tienes servicios")).not.toBeInTheDocument()
    expect(screen.getByText("No hay citas para hoy")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Crear cita" })).toHaveAttribute(
      "href",
      "/appointments/new"
    )
  })

  it("no confunde un fallo de red de useServices con un salon sin servicios: mantiene la agenda normal", () => {
    // Lo que react-query deja tras un 5xx/red: isLoading vuelve a false y
    // data se queda undefined, exactamente igual que "todavia no hay
    // catalogo" si no se mira tambien el error.
    useTodayAppointmentsMock.mockReturnValue(appointmentsResult({ data: { content: [] } }))
    useServicesMock.mockReturnValue(
      servicesResult({ data: undefined, isLoading: false, error: new Error("network down") })
    )

    render(<TodayPage />)

    // La agenda del dia no puede desaparecer por esto: nada de aviso de "sin
    // servicios" tapando las citas de hoy.
    expect(screen.queryByText("Aun no tienes servicios")).not.toBeInTheDocument()
    expect(screen.getByText("No hay citas para hoy")).toBeInTheDocument()

    // El aviso de fallo es aparte, nunca sustituye al cuerpo de la pagina.
    expect(
      screen.getByText("No se ha podido comprobar tu catalogo de servicios")
    ).toBeInTheDocument()
  })

  it("en escritorio, con la lista cargando, tambien se muestra el esqueleto (no solo en movil)", () => {
    mockMatchMedia(true)
    useTodayAppointmentsMock.mockReturnValue(appointmentsResult({ isLoading: true }))
    useServicesMock.mockReturnValue(servicesResult({ data: { content: [oneService] } }))

    const { container } = render(<TodayPage />)

    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
  })

  it("en escritorio, sin citas hoy, tambien se muestra el vacio de agenda (no solo en movil)", () => {
    mockMatchMedia(true)
    useTodayAppointmentsMock.mockReturnValue(appointmentsResult({ data: { content: [] } }))
    useServicesMock.mockReturnValue(servicesResult({ data: { content: [oneService] } }))

    render(<TodayPage />)

    expect(screen.getByText("No hay citas para hoy")).toBeInTheDocument()
  })

  it("muestra el saludo con el nombre de pila del usuario", () => {
    useTodayAppointmentsMock.mockReturnValue(appointmentsResult())
    useServicesMock.mockReturnValue(servicesResult({ data: { content: [oneService] } }))

    render(<TodayPage />)

    expect(screen.getByText("Buenos dias, Ana")).toBeInTheDocument()
  })

  it("D5: no monta la tarjeta 'Proxima cita' -- el diseno la sustituyo por 'Ahora mismo'", () => {
    const future = makeAppointment({
      startTime: `${TODAY_ISO}T11:00:00`,
      endTime: `${TODAY_ISO}T11:30:00`,
      status: "CONFIRMED",
    })
    useTodayAppointmentsMock.mockReturnValue(appointmentsResult({ data: { content: [future] } }))
    useServicesMock.mockReturnValue(servicesResult({ data: { content: [oneService] } }))

    render(<TodayPage />)

    expect(screen.queryByText("Proxima cita")).not.toBeInTheDocument()
  })

  it("en movil hay exactamente UN boton 'Actualizar' en el DOM", () => {
    useTodayAppointmentsMock.mockReturnValue(appointmentsResult())
    useServicesMock.mockReturnValue(servicesResult({ data: { content: [oneService] } }))

    render(<TodayPage />)

    expect(screen.getAllByRole("button", { name: "Actualizar" })).toHaveLength(1)
  })

  it("en escritorio hay exactamente UN boton 'Actualizar' en el DOM", () => {
    mockMatchMedia(true)
    useTodayAppointmentsMock.mockReturnValue(appointmentsResult())
    useServicesMock.mockReturnValue(servicesResult({ data: { content: [oneService] } }))

    render(<TodayPage />)

    expect(screen.getAllByRole("button", { name: "Actualizar" })).toHaveLength(1)
  })

  // D10 + PRUEBA DE MUTACION obligatoria: en movil se montan TRES KPIs y el
  // cuarto (Facturacion prevista) NO esta en el DOM -- no que este presente
  // pero oculto por CSS. Ver informe de mutacion en el mensaje final.
  it("en movil monta TRES KPIs; 'Facturacion prevista' no esta en el DOM", () => {
    useTodayAppointmentsMock.mockReturnValue(
      appointmentsResult({ data: { content: [makeAppointment({ servicePrice: 40 })] } })
    )
    useServicesMock.mockReturnValue(servicesResult({ data: { content: [oneService] } }))

    render(<TodayPage />)

    expect(screen.getAllByTestId("kpi-card")).toHaveLength(3)
    expect(screen.queryByText("Facturacion prevista")).not.toBeInTheDocument()
  })

  it("en escritorio monta CUATRO KPIs, incluida 'Facturacion prevista' formateada entera", () => {
    mockMatchMedia(true)
    useTodayAppointmentsMock.mockReturnValue(
      appointmentsResult({ data: { content: [makeAppointment({ servicePrice: 40 })] } })
    )
    useServicesMock.mockReturnValue(servicesResult({ data: { content: [oneService] } }))

    render(<TodayPage />)

    expect(screen.getAllByTestId("kpi-card")).toHaveLength(4)
    expect(screen.getByText("Facturacion prevista")).toBeInTheDocument()
    // `formatCurrencyRounded`, no `formatCurrency`: "40 €" ENTERO, no
    // "40,00 €" -- ningun otro test lo cazaria salvo este.
    expect(screen.getByText("40 €")).toBeInTheDocument()
  })

  // D37, caso 1: sin empleados activos no hay nada que decir sobre "ahora".
  it("D37: sin empleados activos no se monta el panel 'Ahora mismo'", () => {
    useEmployeesMock.mockReturnValue({ data: { content: [] } })
    useTodayAppointmentsMock.mockReturnValue(appointmentsResult({ data: { content: [] } }))
    useServicesMock.mockReturnValue(servicesResult({ data: { content: [oneService] } }))

    render(<TodayPage />)

    expect(screen.queryByTestId("now-panel")).not.toBeInTheDocument()
    expect(screen.queryByText("Ahora mismo")).not.toBeInTheDocument()
  })

  // D37, caso 2 (el mas frecuente): salon cerrado con empleados que hoy
  // libran. Las filas "off" NO sostienen el panel por si solas -- sin esta
  // guarda, un salon cerrado a las 20:00 pintaria "Ahora mismo" con una
  // lista de ausencias.
  it("D37: con el salon cerrado y empleados que hoy libran, las filas 'off' no sostienen el panel", () => {
    useEmployeesMock.mockReturnValue({ data: { content: [makeEmployee()] } })
    useEmployeesWorkingHoursMock.mockReturnValue({
      data: { emp_1: offHours() },
      isLoading: false,
      isError: false,
    })
    useTodayAppointmentsMock.mockReturnValue(appointmentsResult({ data: { content: [] } }))
    useServicesMock.mockReturnValue(servicesResult({ data: { content: [oneService] } }))

    render(<TodayPage />)

    expect(screen.queryByTestId("now-panel")).not.toBeInTheDocument()
  })

  // Control de los dos casos D37 de arriba: con una cita EN CURSO el panel
  // si se monta -- sin este control, las dos pruebas de arriba pasarian
  // igual con un `showNowPanel` roto en `false` a secas.
  it("D37 (control): con una cita en curso, el panel 'Ahora mismo' si se monta", () => {
    const current = makeAppointment({
      employeeId: "emp_1",
      startTime: `${TODAY_ISO}T09:45:00`,
      endTime: `${TODAY_ISO}T10:45:00`,
      status: "CONFIRMED",
    })
    useEmployeesMock.mockReturnValue({ data: { content: [makeEmployee()] } })
    useTodayAppointmentsMock.mockReturnValue(appointmentsResult({ data: { content: [current] } }))
    useServicesMock.mockReturnValue(servicesResult({ data: { content: [oneService] } }))

    render(<TodayPage />)

    expect(screen.getByTestId("now-panel")).toBeInTheDocument()
  })

  // D33 + PRUEBA DE MUTACION: el boton "Actualizar" re-siembra `now`, no
  // solo `refetch()`. El rotulo de hora del panel movil de `NowPanel` es
  // propiedad DE `NowPanel`, no de esta pagina -- que avance solo tras
  // pulsar prueba que `setNow` se llamo de verdad.
  it("D33: el boton 'Actualizar' re-siembra `now` ademas de refrescar los datos", () => {
    const refetch = vi.fn()
    const current = makeAppointment({
      employeeId: "emp_1",
      startTime: `${TODAY_ISO}T09:45:00`,
      endTime: `${TODAY_ISO}T10:45:00`,
      status: "CONFIRMED",
    })
    useEmployeesMock.mockReturnValue({ data: { content: [makeEmployee()] } })
    useTodayAppointmentsMock.mockReturnValue(
      appointmentsResult({ data: { content: [current] }, refetch })
    )
    useServicesMock.mockReturnValue(servicesResult({ data: { content: [oneService] } }))

    render(<TodayPage />)

    expect(screen.getByTestId("now-panel-current-time")).toHaveTextContent("10:15")

    // El reloj del sistema avanza SIN que nadie pulse nada -- si `now` se
    // releyera en cada render (en vez de vivir en estado), esta prueba no
    // distinguiria nada.
    vi.setSystemTime(new Date(2026, 7, 27, 10, 40))

    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }))

    expect(refetch).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("now-panel-current-time")).toHaveTextContent("10:40")
  })
})
