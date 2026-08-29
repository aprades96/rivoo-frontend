import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import CalendarPage from "./page"
import type { Appointment } from "@/types/appointment"
import type { Employee, WorkingHoursResponse } from "@/types/employee"

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

/**
 * `TODAY` cae en JUEVES, asi que el dia siguiente es VIERNES. Los dos numeros
 * son los de `WorkingHoursResponse.dayOfWeek` (1 = lunes .. 7 = domingo, la
 * convencion de `getTodayBusinessHours`).
 */
const THURSDAY = 4
const FRIDAY = 5

const TOMORROW_ISO = "2026-08-28"
const TOMORROW_LABEL = "Viernes, 28 de agosto"

/**
 * Horarios REALES de un empleado, con el descanso que le toque a cada dia.
 * El backend serializa `LocalTime` con segundos ("13:00:00"), y asi es como
 * los recibe la pantalla: escribirlos aqui sin ellos probaria otra cosa.
 */
function makeWorkingHours(
  breaksByDay: Record<number, [string, string]> = {}
): WorkingHoursResponse[] {
  return [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => {
    const rest = breaksByDay[dayOfWeek]
    return {
      dayOfWeek,
      isOpen: true,
      openTime: "09:00:00",
      closeTime: "20:00:00",
      breakStartTime: rest ? `${rest[0]}:00` : null,
      breakEndTime: rest ? `${rest[1]}:00` : null,
    }
  })
}

/** El almuerzo del artboard (`CalendarioDesktop.dc.html:177-180`) el dia de hoy. */
const LUNCH_TODAY = makeWorkingHours({ [THURSDAY]: ["13:00", "14:00"] })

/**
 * Sustituye el mapa VACIO del `beforeEach`. Ese mapa es comodo pero deja sin
 * ejecutar todo el cableado de descansos: con el puesto se puede borrar
 * `breaks` de `DayView` y la suite sigue verde.
 */
function mockWorkingHours(byEmployee: Record<string, WorkingHoursResponse[]>) {
  useEmployeesWorkingHoursMock.mockReturnValue({
    data: byEmployee,
    isLoading: false,
    isError: false,
  })
}

/**
 * Pixeles desde el arranque de la rejilla (08:00) hasta una hora: 48px por
 * medio slot, o sea 1,6px por minuto. Escrito una vez para que las posiciones
 * esperadas se lean como horas y no como numeros magicos.
 */
function topOf(hours: number, minutes = 0): string {
  return `${(hours * 60 + minutes - 8 * 60) * 1.6}px`
}

/**
 * Una pildora del filtro de empleado por su NOMBRE, anclado al final. En la
 * pildora el empleado es solo su nombre ("Laura"), pero las franjas vacias de
 * la rejilla se anuncian con nombre y apellido ("Crear cita a las 08:00 con
 * Laura Martinez"): sin el ancla, `/Laura/` casa tambien con las dos docenas
 * de franjas de su columna.
 */
function pill(firstName: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`${firstName}$`) })
}

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
  /**
   * REGRESION actualizada por T10 (D2): con el panel de detalle, la rejilla ya
   * no cuelga DIRECTAMENTE del contenedor de `PageShell` en escritorio -- ahi
   * cuelga la FILA `flex min-h-0 flex-1` que `/calendar` monta para acoplar
   * rejilla y panel (`DetalleCitaDesktop.dc.html:108`), y `DayView` vive un
   * nivel dentro de ella, junto al panel. Antes de T10 la fila no existia.
   */
  it("en escritorio la FILA del panel cuelga directamente de PageShell; DayView vive dentro de ella", () => {
    mockMatchMedia(true)

    const { container } = render(<CalendarPage />)

    const content = container.querySelector('[data-slot="page-shell-content"]')
    expect(content).not.toBeNull()
    const dayView = screen.getByTestId("day-view")
    expect(dayView.parentElement).toHaveClass("flex", "min-h-0", "flex-1")
    expect(dayView.parentElement?.parentElement).toBe(content)
  })

  /**
   * La otra mitad de la invariante de `FILL_ROUTES`, y la que el caso de
   * arriba NO cubre: el parentesco (`DayView` hijo directo del contenido) es
   * cierto en las DOS ramas de `PageShell`, asi que se podia borrar
   * `layout="fill"` con la suite entera verde. Sin `fill` el cuerpo recupera
   * `px-7 py-6` y `max-w-[1084px]` y pierde la cadena `flex-1 min-h-0`; con el
   * `overflow-hidden` del chasis encima, la rejilla queda cortada e
   * inalcanzable. Por eso se afirma sobre el CONTENEDOR, no sobre el arbol.
   */
  it("el cuerpo va a alto completo y sin padding: la pantalla pide layout='fill'", () => {
    mockMatchMedia(true)

    const { container } = render(<CalendarPage />)

    const content = container.querySelector('[data-slot="page-shell-content"]') as HTMLElement
    expect(content).toHaveClass("flex", "min-h-0", "flex-1", "flex-col")
    // Los dos tokens de la rama `default`, que aqui no pueden estar: el ancho
    // de lectura (la rejilla va a ancho completo, `CalendarioDesktop:130`)...
    expect(content).not.toHaveClass("max-w-[1084px]")
    // ...y el padding exterior, que en `fill` lo trae cada franja.
    expect(content.parentElement).not.toHaveClass("px-7")
    expect(content.parentElement).toHaveClass("min-h-0", "flex-1")
  })

  /**
   * La rama de CARGA sostiene la misma cadena de alturas que la cargada.
   * `LoadingSkeleton` es compartido y no la trae (`space-y-3 p-4`), asi que
   * como hijo flex directo no crecia ni hacia scroll: en un movil de 560dvh
   * las franjas fijas mas el esqueleto pasaban de los 480px utiles y la ultima
   * fila quedaba recortada, sin forma de alcanzarla.
   */
  it("mientras carga, el esqueleto crece y hace scroll como lo hara la rejilla", () => {
    mockMatchMedia(false)
    useAppointmentsMock.mockReturnValue({ data: undefined, isLoading: true })

    const { container } = render(<CalendarPage />)

    const content = container.querySelector('[data-slot="page-shell-content"]')
    const loading = screen.getByTestId("calendar-loading")
    expect(loading.parentElement).toBe(content)
    expect(loading).toHaveClass("min-h-0", "flex-1", "overflow-y-auto")
    expect(screen.queryByTestId("day-view")).not.toBeInTheDocument()
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
    // "Manicura" es de Sofia y el filtro arranca en Laura: aqui interesa el
    // buscador sobre el dia ENTERO, asi que se pide "Todos" a proposito.
    fireEvent.click(pill("Todos"))
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
    // "Todos" para que "todas las citas" sean las del dia y no las de la
    // empleada con la que arranca el filtro.
    fireEvent.click(pill("Todos"))
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }))
    const field = screen.getByRole("textbox", { name: "Buscar citas" })
    fireEvent.change(field, { target: { value: "carla" } })
    expect(screen.getAllByTestId("appointment-block")).toHaveLength(1)

    fireEvent.keyDown(field, { key: "Escape" })

    expect(screen.queryByRole("textbox", { name: "Buscar citas" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Buscar" })).toBeInTheDocument()
    expect(screen.getAllByTestId("appointment-block")).toHaveLength(APPOINTMENTS.length)
  })

  /**
   * Plegar DESMONTA el campo que tenia el foco, y la lupa que lo sustituye es
   * un nodo NUEVO: sin devolverselo a mano el foco cae en `document.body` y
   * quien navega con teclado vuelve al principio del documento.
   */
  it("Escape devuelve el foco a la lupa, no al body", () => {
    mockMatchMedia(false)

    render(<CalendarPage />)
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }))
    const field = screen.getByRole("textbox", { name: "Buscar citas" })

    fireEvent.keyDown(field, { key: "Escape" })

    expect(screen.getByRole("button", { name: "Buscar" })).toHaveFocus()
    expect(document.body).not.toHaveFocus()
  })

  /**
   * El resumen de la cabecera ("4 citas · 5h 30min") es una afirmacion de
   * HECHO sobre la agenda del empleado, no una descripcion de lo que la vista
   * deja ver. Alimentado con la lista ya filtrada, buscar "corte" dejaba a
   * Sofia -- que tiene su dia -- anunciada como "Sin citas".
   */
  it("con el buscador activo la cabecera sigue contando el dia entero", () => {
    mockMatchMedia(true)

    const { container } = render(<CalendarPage />)
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar citas" }), {
      target: { value: "corte" },
    })

    // La rejilla SI se recorta: sin esto el caso pasaria con el buscador roto.
    expect(clientNames()).toEqual(["Carla Ruiz"])

    const header = container.querySelector(
      '[data-testid="employee-column-header"][data-employee-id="emp_2"]'
    ) as HTMLElement
    expect(within(header).queryByText("Sin citas")).not.toBeInTheDocument()
    // La cita de Sofia (10:30-12:00) sigue en su agenda aunque no se pinte.
    expect(within(header).getByText("1 cita · 1h 30min")).toBeInTheDocument()
  })

  // --- Filtro de empleado en movil -----------------------------------------

  /**
   * BLOQUEANTE cerrado: el filtro arrancaba en "Todos" y el artboard dice otra
   * cosa. `Calendario.dc.html:51` pinta la pildora "Todos" en REPOSO (blanco,
   * `font-weight: 500`) y `:52-55` a Laura SELECCIONADA (`#B4522F`,
   * `font-weight: 600`); y la rejilla de debajo (`:97-119`) lleva los TRES
   * bloques de la columna de Laura del artboard de escritorio
   * (`CalendarioDesktop.dc.html:162,168,177`: sus dos citas y el almuerzo) y
   * ninguno de los otros SEIS -- el canvas tiene nueve `.blk`, tres por
   * columna, ocho citas (2 + 3 + 3) y un descanso; movil solo suma el recuadro
   * "Libre" (`Calendario.dc.html:112`), que en escritorio no esta. Con "Todos"
   * esa columna llevaria las ocho citas de los tres empleados repartidas en
   * carriles.
   */
  it("en movil el filtro arranca en el primer empleado, no en 'Todos'", () => {
    mockMatchMedia(false)

    render(<CalendarPage />)

    expect(pill("Laura")).toHaveClass("bg-primary")
    expect(pill("Todos")).not.toHaveClass("bg-primary")
    expect(lastQueryParams()).toMatchObject({ date: TODAY_ISO, employeeId: "emp_1" })
    // Y lo que se PINTA es su columna: sus dos citas, ninguna de Sofia.
    expect(clientNames()).toHaveLength(2)
    expect(screen.queryByText("Ana Garcia")).not.toBeInTheDocument()
  })

  /**
   * El arranque depende de una lista que llega POR RED, y la de citas sale a
   * la vez. Si contesta primero, la pantalla llegaria a pintar el dia entero
   * fundido en una columna -- que no es lo que el artboard dibuja -- para
   * cambiarlo por el esqueleto en cuanto la lista de empleados moviera el
   * filtro: dato, esqueleto y dato otra vez. En movil se espera.
   */
  it("en movil no pinta agenda hasta saber de quien es", () => {
    mockMatchMedia(false)
    useEmployeesMock.mockReturnValue({ data: undefined, isLoading: true })

    render(<CalendarPage />)

    expect(screen.getByTestId("calendar-loading")).toBeInTheDocument()
    expect(screen.queryByTestId("day-view")).not.toBeInTheDocument()
  })

  /**
   * Y solo en movil: en escritorio la rejilla no depende de ningun filtro --
   * dibuja una columna por empleado y va apareciendo con ellos --, asi que
   * esperar alli seria una pantalla en blanco de mas.
   */
  it("en escritorio la rejilla no espera a la lista de empleados", () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: undefined, isLoading: true })

    render(<CalendarPage />)

    expect(screen.getByTestId("day-view")).toBeInTheDocument()
    expect(screen.queryByTestId("calendar-loading")).not.toBeInTheDocument()
  })

  /**
   * Si la lista FALLA, `isLoading` baja igual y la pantalla sigue: en "Todos",
   * sin pildoras de empleado, pero con la agenda del dia. Sin esto, esperar
   * "a que haya empleados" dejaria un esqueleto perpetuo.
   */
  it("si la lista de empleados falla, la agenda sigue saliendo", () => {
    mockMatchMedia(false)
    useEmployeesMock.mockReturnValue({ data: undefined, isLoading: false, isError: true })

    render(<CalendarPage />)

    expect(screen.getByTestId("day-view")).toBeInTheDocument()
    expect(screen.queryByTestId("calendar-loading")).not.toBeInTheDocument()
    expect(lastQueryParams().employeeId).toBeUndefined()
  })

  /**
   * El primero ACTIVO, no el primero de la lista: un empleado dado de baja no
   * tiene columna (`groupByEmployee` filtra por `isActive`) ni pildora
   * (`employee-filter.tsx:48`), asi que arrancar en el dejaria la agenda vacia
   * y sin ninguna pildora marcada.
   */
  it("si el primero de la lista esta de baja, arranca en el primero activo", () => {
    mockMatchMedia(false)
    useEmployeesMock.mockReturnValue({
      data: {
        content: [
          makeEmployee({ id: "emp_0", firstName: "Marc", lastName: "Oliva", isActive: false }),
          ...EMPLOYEES,
        ],
      },
    })

    render(<CalendarPage />)

    expect(lastQueryParams()).toMatchObject({ employeeId: "emp_1" })
    expect(pill("Laura")).toHaveClass("bg-primary")
  })

  /**
   * Salon recien creado: no hay a quien seleccionar, asi que el filtro se
   * queda en "Todos". Es el unico caso en que "Todos" es el arranque.
   */
  it("sin empleados activos el filtro se queda en 'Todos'", () => {
    mockMatchMedia(false)
    useEmployeesMock.mockReturnValue({ data: { content: [] } })

    render(<CalendarPage />)

    expect(pill("Todos")).toHaveClass("bg-primary")
    expect(lastQueryParams().employeeId).toBeUndefined()
  })

  /**
   * "Todos" sigue existiendo como ELECCION del usuario, y una vez elegida
   * manda sobre el arranque. Por eso el estado guarda la eleccion (que puede
   * ser `null` = "Todos") y no el id: sin esa distincion, elegir "Todos"
   * volveria a caer en el primer empleado en el render siguiente.
   */
  it("elegir 'Todos' a mano devuelve el dia entero y se queda puesto", () => {
    mockMatchMedia(false)

    render(<CalendarPage />)
    expect(lastQueryParams().employeeId).toBe("emp_1")

    fireEvent.click(pill("Todos"))

    expect(pill("Todos")).toHaveClass("bg-primary")
    expect(pill("Laura")).not.toHaveClass("bg-primary")
    expect(lastQueryParams().employeeId).toBeUndefined()
    expect(clientNames()).toHaveLength(APPOINTMENTS.length)
  })

  /**
   * El arranque depende de una lista que llega POR RED, y esa lista puede
   * volver a llegar (refetch, alta de empleado) despues de que el usuario haya
   * elegido. Recalcular el arranque entonces le pisaria la pildora: aqui la
   * lista vuelve con alguien NUEVO por delante y la eleccion tiene que
   * aguantar.
   */
  it("una recarga de la lista de empleados no pisa la pildora ya elegida", () => {
    mockMatchMedia(false)

    const { rerender } = render(<CalendarPage />)
    fireEvent.click(pill("Sofia"))
    expect(lastQueryParams().employeeId).toBe("emp_2")

    useEmployeesMock.mockReturnValue({
      data: {
        content: [
          makeEmployee({ id: "emp_0", firstName: "Marc", lastName: "Oliva" }),
          ...EMPLOYEES,
        ],
      },
    })
    rerender(<CalendarPage />)

    expect(pill("Sofia")).toHaveClass("bg-primary")
    expect(pill("Marc")).not.toHaveClass("bg-primary")
    expect(lastQueryParams().employeeId).toBe("emp_2")
  })

  // --- La consulta cambia por ancho ----------------------------------------

  it("en movil la consulta lleva el employeeId del filtro de pildoras", () => {
    mockMatchMedia(false)

    render(<CalendarPage />)
    expect(lastQueryParams().employeeId).toBe("emp_1")

    fireEvent.click(pill("Sofia"))

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
    fireEvent.click(pill("Sofia"))
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

  /**
   * El recorte de columnas de movil. En "Todos" la vista funde las columnas en
   * una sola, asi que quedarse con la del empleado elegido no cambia lo que se
   * VE -- pero si lo que se PULSA: sin el recorte `DayView` recibe N columnas,
   * no sabe a quien atribuir la franja y manda `null`, y el alta pierde el
   * profesional que el filtro ya habia elegido. El caso de escritorio de
   * arriba no lo cubre: alli esta logica ni se aplica.
   */
  it("en movil la franja pulsada conserva el empleado del filtro de pildoras", () => {
    mockMatchMedia(false)

    const { container } = render(<CalendarPage />)
    fireEvent.click(pill("Sofia"))

    const slot = container.querySelector(
      '[data-testid="slot-target"][data-time="15:30"]'
    ) as HTMLElement
    fireEvent.click(slot)

    expect(pushMock).toHaveBeenCalledTimes(1)
    const url = new URL(pushMock.mock.calls[0][0] as string, "http://localhost")
    expect(url.searchParams.get("time")).toBe("15:30")
    expect(url.searchParams.get("employeeId")).toBe("emp_2")
  })

  // --- Descanso ------------------------------------------------------------

  /**
   * El descanso es POR EMPLEADO, no del salon: el artboard lo pinta solo en la
   * columna de Laura (`CalendarioDesktop.dc.html:177-180`). Con el mapa de
   * horarios vacio -- como arranca el `beforeEach` -- todo este cableado no
   * llega a ejecutarse y se puede borrar `breaks` de `DayView` sin que nada se
   * ponga rojo.
   */
  it("pinta el descanso en la columna del empleado que lo tiene y solo en esa", () => {
    mockMatchMedia(true)
    mockWorkingHours({ emp_1: LUNCH_TODAY })

    const { container } = render(<CalendarPage />)

    const laura = container.querySelector(
      '[data-testid="day-view-column"][data-employee-id="emp_1"]'
    ) as HTMLElement
    const almuerzo = within(laura).getByTestId("break-block")
    expect(almuerzo).toHaveTextContent("13:00 - 14:00")
    expect(almuerzo).toHaveStyle({ top: topOf(13) })

    const sofia = container.querySelector(
      '[data-testid="day-view-column"][data-employee-id="emp_2"]'
    ) as HTMLElement
    expect(within(sofia).queryByTestId("break-block")).not.toBeInTheDocument()
  })

  /**
   * El descanso se resuelve contra el dia VISIBLE, no contra hoy: son dias de
   * la semana distintos y por tanto filas distintas del horario. Con
   * `new Date()` en vez de `currentDate`, manana se pintaria el almuerzo de
   * hoy -- y aqui no caen a la misma hora a proposito.
   */
  it("al cambiar de dia el descanso es el del dia visible, no el de hoy", () => {
    mockMatchMedia(true)
    mockWorkingHours({
      emp_1: makeWorkingHours({ [THURSDAY]: ["13:00", "14:00"], [FRIDAY]: ["15:00", "16:00"] }),
    })

    render(<CalendarPage />)
    expect(screen.getByTestId("break-block")).toHaveTextContent("13:00 - 14:00")

    fireEvent.click(screen.getByRole("button", { name: "Dia siguiente" }))

    expect(screen.getByTestId("break-block")).toHaveTextContent("15:00 - 16:00")
    expect(screen.getByTestId("break-block")).toHaveStyle({ top: topOf(15) })
  })

  // --- Hueco libre ---------------------------------------------------------

  /**
   * BLOQUEANTE cerrado: en movil con "Todos" la pantalla pintaba el descanso
   * pero calculaba el hueco sin el, asi que el recuadro "Libre · toca para
   * crear" caia ENCIMA del rayado del almuerzo e invitaba a crear una cita a
   * la hora de comer. Pintar y calcular tienen que leer el MISMO dato.
   *
   * "Todos" ya no es el arranque sino una eleccion, y por eso se pulsa: es el
   * caso en que `visibleBreak` tiene que resolver el descanso entre VARIAS
   * columnas, que es donde el hueco se descolgaba de lo pintado.
   */
  it("en movil y en 'Todos' el hueco libre no se ofrece encima del almuerzo", () => {
    mockMatchMedia(false)
    vi.setSystemTime(new Date(2026, 7, 27, 12, 45))
    useEmployeesMock.mockReturnValue({
      data: {
        content: [
          ...EMPLOYEES,
          makeEmployee({ id: "emp_3", firstName: "Marc", lastName: "Oliva", colorHex: null }),
        ],
      },
    })
    // Toda la plantilla almuerza a la vez, que es el caso normal del salon.
    mockWorkingHours({ emp_1: LUNCH_TODAY, emp_2: LUNCH_TODAY, emp_3: LUNCH_TODAY })
    // Nada despues de las 12:00: sin el descanso, el primer hueco desde las
    // 12:45 seria justo el de las 13:00.
    useAppointmentsMock.mockReturnValue({
      data: { content: APPOINTMENTS.slice(0, 2) },
      isLoading: false,
    })

    render(<CalendarPage />)
    fireEvent.click(pill("Todos"))

    expect(screen.getByTestId("break-block")).toHaveStyle({ top: topOf(13), height: "92px" })
    // 14:00, el primer tramo DESPUES del almuerzo -- no las 13:00.
    expect(screen.getByTestId("free-slot-hint")).toHaveStyle({ top: topOf(14) })
  })

  /**
   * El recuadro "Libre" del artboard movil (`Calendario.dc.html:112-114`).
   * Sin este caso se puede pasar `freeSlot={null}` a `DayView` y la suite
   * sigue verde.
   */
  it("en movil ofrece el primer hueco libre desde ahora", () => {
    mockMatchMedia(false)

    render(<CalendarPage />)

    // A las 10:00 la cita de Carla acaba justo y la de Ana empieza a y media.
    expect(screen.getByTestId("free-slot-hint")).toHaveStyle({ top: topOf(10) })
  })

  /**
   * El buscador cambia lo que se PINTA, no lo que esta OCUPADO. Calculando el
   * hueco con la lista recortada, esconder la cita de las 09:00 ofreceria como
   * libre una franja que ya tiene cita.
   */
  it("el buscador no mueve el hueco libre", () => {
    mockMatchMedia(false)
    vi.setSystemTime(new Date(2026, 7, 27, 9, 0))

    render(<CalendarPage />)
    // El dia entero: la cita que el buscador dejara ver es de Sofia, y el
    // filtro arranca en Laura.
    fireEvent.click(pill("Todos"))
    expect(screen.getByTestId("free-slot-hint")).toHaveStyle({ top: topOf(10) })

    // "manicura" deja fuera la cita de las 09:00-10:00, que es justo la que
    // impide ofrecer las 09:00.
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar citas" }), {
      target: { value: "manicura" },
    })

    expect(clientNames()).toEqual(["Ana Garcia"])
    expect(screen.getByTestId("free-slot-hint")).toHaveStyle({ top: topOf(10) })
  })

  /**
   * El "ahora" se congela al montar. Si se leyera el reloj en cada render, el
   * recuadro saltaria de sitio a mitad de una interaccion -- basta teclear en
   * el buscador para provocar un render -- y lo que se pulsa no seria lo que
   * se vio.
   */
  it("el hueco libre no se mueve por el paso del tiempo dentro de la misma sesion", () => {
    mockMatchMedia(false)

    render(<CalendarPage />)
    expect(screen.getByTestId("free-slot-hint")).toHaveStyle({ top: topOf(10) })

    // 40 minutos despues, un render cualquiera: leyendo el reloj de nuevo el
    // hueco se iria a las 12:00.
    vi.setSystemTime(new Date(2026, 7, 27, 10, 40))
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar citas" }), {
      target: { value: " " },
    })

    expect(screen.getByTestId("free-slot-hint")).toHaveStyle({ top: topOf(10) })
  })

  it("pulsar el hueco libre lleva al alta a esa HORA y con el empleado del filtro", () => {
    mockMatchMedia(false)

    render(<CalendarPage />)
    fireEvent.click(screen.getByTestId("free-slot-hint"))

    expect(pushMock).toHaveBeenCalledTimes(1)
    const url = new URL(pushMock.mock.calls[0][0] as string, "http://localhost")
    expect(url.searchParams.get("date")).toBe(TODAY_ISO)
    // La hora, no los cinco primeros caracteres del ISO ("2026-").
    expect(url.searchParams.get("time")).toBe("10:00")
    // Con el filtro arrancando en un empleado, el hueco ya no llega al alta
    // sin profesional: es el que esta seleccionado.
    expect(url.searchParams.get("employeeId")).toBe("emp_1")
  })

  // --- Navegacion de dia ---------------------------------------------------

  /**
   * `date-navigator.test.tsx` prueba que los callbacks se disparan; nadie
   * probaba que la PANTALLA cambie de dia. Con `subDays` en `goToNextDay` el
   * boton "Dia siguiente" retrocedia y pasaba CI limpio.
   */
  it("'Dia siguiente' avanza el dia visible y la consulta", () => {
    mockMatchMedia(true)

    render(<CalendarPage />)
    fireEvent.click(screen.getByRole("button", { name: "Dia siguiente" }))

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(TOMORROW_LABEL)
    expect(lastQueryParams()).toMatchObject({ date: TOMORROW_ISO })
  })

  it("'Hoy' devuelve el dia visible a hoy", () => {
    mockMatchMedia(true)

    render(<CalendarPage />)
    fireEvent.click(screen.getByRole("button", { name: "Dia siguiente" }))
    fireEvent.click(screen.getByRole("button", { name: "Dia siguiente" }))
    expect(lastQueryParams()).toMatchObject({ date: "2026-08-29" })

    fireEvent.click(screen.getByRole("button", { name: "Hoy" }))

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(TODAY_LABEL)
    expect(lastQueryParams()).toMatchObject({ date: TODAY_ISO })
  })

  // --- CTA -----------------------------------------------------------------

  /**
   * `CalendarioDesktop.dc.html:96` dibuja `gap: 8px` entre el "+" y el rotulo.
   * La talla `action` trae `gap-1.5` (6px), que es la del resto de controles
   * de cabecera; la desviacion decidida para este boton cubre el `padding`, no
   * el `gap`. Se corrige en la llamada, no en la primitiva compartida.
   */
  it("el CTA 'Nueva cita' separa icono y rotulo los 8px del artboard", () => {
    mockMatchMedia(true)

    render(<CalendarPage />)

    const cta = screen.getByRole("link", { name: /Nueva cita/ })
    expect(cta).toHaveClass("gap-2")
    expect(cta).not.toHaveClass("gap-1.5")
  })

  // --- Detalle -------------------------------------------------------------

  /**
   * RESIGNIFICADO por T10 (D1, D2): antes del panel acoplado, este caso abria
   * la HOJA -- el unico detalle que existia, en cualquier ancho. Ahora, en
   * escritorio, es el PANEL quien monta ese mismo rotulo ("Detalle de cita",
   * §1.2): el caso podia seguir en verde por COINCIDENCIA sin probar nada
   * nuevo. Se revisa a proposito, afirmando sobre `appointment-detail-panel`
   * en vez de sobre el texto suelto, y sobre la AUSENCIA de la hoja (D9): los
   * dos NUNCA se montan a la vez.
   */
  it("en escritorio pulsar un bloque abre el PANEL de detalle, no la hoja", () => {
    mockMatchMedia(true)

    render(<CalendarPage />)
    fireEvent.click(screen.getByText("Ana Garcia"))

    const panel = screen.getByTestId("appointment-detail-panel")
    expect(within(panel).getByText("Detalle de cita")).toBeInTheDocument()
    // El bloque de la rejilla y el panel: dos apariciones del mismo nombre.
    expect(screen.getAllByText("Ana Garcia")).toHaveLength(2)
    expect(screen.queryByTestId("detail-sheet-grabber")).not.toBeInTheDocument()
  })

  it("en movil pulsar un bloque abre la HOJA de detalle, no el panel", () => {
    mockMatchMedia(false)

    render(<CalendarPage />)
    // Carla Ruiz es de Laura (`emp_1`), el empleado en el que arranca el
    // filtro de pildoras: visible sin tocar nada.
    fireEvent.click(screen.getByText("Carla Ruiz"))

    expect(screen.getByTestId("detail-sheet-grabber")).toBeInTheDocument()
    expect(screen.getByText("Detalle de cita")).toBeInTheDocument()
    expect(screen.queryByTestId("appointment-detail-panel")).not.toBeInTheDocument()
  })

  /**
   * El MODO ESTRECHO (§1.3): abrir el panel no solo pinta un anillo, redibuja
   * la rejilla entera para caber en menos ancho. Se comprueba con el marco de
   * `DayView` (`FRAME_PADDING_CLASSNAME`, `day-view.tsx:34-38`): `px-6` normal,
   * `px-5` con el panel abierto. Cerrar el panel lo devuelve.
   */
  it("en escritorio abrir el panel estrecha la rejilla; cerrarlo la devuelve", () => {
    mockMatchMedia(true)

    render(<CalendarPage />)
    expect(screen.getByTestId("day-view")).toHaveClass("px-6")
    expect(screen.getByTestId("day-view")).not.toHaveClass("px-5")

    fireEvent.click(screen.getByText("Ana Garcia"))

    expect(screen.getByTestId("day-view")).toHaveClass("px-5")
    expect(screen.getByTestId("day-view")).not.toHaveClass("px-6")

    fireEvent.click(screen.getByTestId("appointment-panel-close"))

    expect(screen.queryByTestId("appointment-detail-panel")).not.toBeInTheDocument()
    expect(screen.getByTestId("day-view")).toHaveClass("px-6")
    expect(screen.getByTestId("day-view")).not.toHaveClass("px-5")
  })

  /**
   * D16, EL TEST QUE SEPARA DERIVAR DE CAPTURAR. Si la pagina capturase el
   * OBJETO al pulsar (el codigo de antes de T10), este caso se queda en ROJO:
   * el objeto capturado no cambia aunque `useAppointments` devuelva datos
   * nuevos. Derivando por id (D16) el panel refleja el estado que trae la
   * consulta en cada render -- exactamente lo que hace `onSettled` al
   * invalidar `["appointments"]` tras una mutacion real
   * (`use-appointments.ts:128-130`).
   */
  it("D16: confirmar la cita deriva el nuevo estado en el panel sin cerrarlo", () => {
    mockMatchMedia(true)

    const pending = makeAppointment({ status: "PENDING" })
    useAppointmentsMock.mockReturnValue({ data: { content: [pending] }, isLoading: false })

    const { rerender } = render(<CalendarPage />)
    fireEvent.click(screen.getByText("Carla Ruiz"))

    expect(
      within(screen.getByTestId("appointment-detail-panel")).getByTestId("appointment-panel-status")
    ).toHaveTextContent("Pendiente de confirmar")

    // Lo que hace una mutacion real al asentarse: `["appointments"]` se
    // invalida y el refetch trae la MISMA cita con el estado nuevo -- un
    // objeto NUEVO, no el mismo mutado in place (`use-appointments.ts:103-111`).
    useAppointmentsMock.mockReturnValue({
      data: { content: [{ ...pending, status: "CONFIRMED" as const }] },
      isLoading: false,
    })
    rerender(<CalendarPage />)

    const panel = screen.getByTestId("appointment-detail-panel")
    expect(within(panel).getByTestId("appointment-panel-status")).toHaveTextContent("Confirmada")
    expect(within(panel).getByText("Carla Ruiz")).toBeInTheDocument()
  })
})
