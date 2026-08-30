import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useAppointments, useTodayAppointments } from "./use-appointments"
import type { Appointment, AppointmentListParams } from "@/types/appointment"
import type { Page } from "@/types/api"

const useAuthMock = vi.fn()

vi.mock("@/hooks/use-auth", () => ({
  useAuth: (...args: unknown[]) => useAuthMock(...args),
}))

const list = vi.fn()

vi.mock("@/lib/api/appointments", () => ({
  appointmentsApi: {
    list: (...args: unknown[]) => list(...args),
  },
}))

const TODAY = "2026-08-25"
const TOMORROW = "2026-08-26"

function makeAppointment(id: string): Appointment {
  return {
    id,
    tenantId: "tenant_1",
    clientId: null,
    clientName: "Carla Ruiz",
    clientPhone: null,
    clientEmail: null,
    employeeId: "emp_1",
    employeeName: "Laura Martinez",
    serviceId: "svc_1",
    serviceName: "Corte",
    servicePrice: 35,
    serviceDurationMinutes: 60,
    startTime: `${TODAY}T09:00:00`,
    endTime: `${TODAY}T10:00:00`,
    status: "CONFIRMED",
    source: "MANUAL",
    notes: null,
    reminderSent: false,
    createdAt: `${TODAY}T08:00:00`,
    updatedAt: `${TODAY}T08:00:00`,
  }
}

function page(count: number): Page<Appointment> {
  const content = Array.from({ length: count }, (_, i) => makeAppointment(`apt_${i}`))
  return {
    content,
    totalElements: count,
    totalPages: 1,
    size: 200,
    number: 0,
    first: true,
    last: true,
    empty: count === 0,
  }
}

/** Las dos dimensiones que el calendario mueve en la `queryKey`. */
interface ProbeQuery {
  date: string
  employeeId?: string
}

/**
 * La sonda escribe lo que el calendario mira para decidir si desmonta la
 * rejilla: `isLoading`, cuantas citas tiene a mano y si lo que ve es la
 * consulta anterior mientras llega la nueva.
 */
function Probe({ date, employeeId }: ProbeQuery) {
  const { data, isLoading, isPlaceholderData } = useAppointments({
    date,
    employeeId,
    page: 0,
    size: 200,
  })

  return (
    <ul>
      <li>{`citas: ${data?.content.length ?? "-"}`}</li>
      <li>{`cargando: ${isLoading}`}</li>
      <li>{`previo: ${isPlaceholderData}`}</li>
    </ul>
  )
}

function renderProbe(query: ProbeQuery) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const tree = (value: ProbeQuery) => (
    <QueryClientProvider client={client}>
      <Probe {...value} />
    </QueryClientProvider>
  )

  const { rerender } = render(tree(query))
  return { show: (value: ProbeQuery) => rerender(tree(value)) }
}

/** La misma sonda para `/today`, que no elige empleado. */
function TodayProbe({ date }: { date: string }) {
  const { data, isLoading, isPlaceholderData } = useTodayAppointments(date)

  return (
    <ul>
      <li>{`citas: ${data?.content.length ?? "-"}`}</li>
      <li>{`cargando: ${isLoading}`}</li>
      <li>{`previo: ${isPlaceholderData}`}</li>
    </ul>
  )
}

function renderTodayProbe(date: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const tree = (value: string) => (
    <QueryClientProvider client={client}>
      <TodayProbe date={value} />
    </QueryClientProvider>
  )

  const { rerender } = render(tree(date))
  return { show: (value: string) => rerender(tree(value)) }
}

describe("useAppointments", () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    useAuthMock.mockReturnValue({ accessToken: "token", isAuthenticated: true })
    list.mockReset()
  })

  it("mantiene el dia anterior en pantalla mientras llega el siguiente", async () => {
    // `date` va dentro de la `queryKey`, asi que cada dia es una query propia:
    // sin prestar los datos previos, avanzar de dia levanta `isLoading`, el calendario
    // desmonta la rejilla, monta el esqueleto y al volver el `overflow-y-auto`
    // ha perdido el scroll y reaparece en las 08:00.
    let deliverTomorrow: (value: Page<Appointment>) => void = () => {}
    list.mockImplementation((params: AppointmentListParams) =>
      params.date === TODAY
        ? Promise.resolve(page(2))
        : new Promise<Page<Appointment>>((resolve) => {
            deliverTomorrow = resolve
          })
    )

    const { show } = renderProbe({ date: TODAY })
    expect(await screen.findByText("citas: 2")).toBeInTheDocument()

    show({ date: TOMORROW })

    // `previo: true` es lo que el componente NO tenia antes del cambio de dia:
    // esperar por ello prueba que el render nuevo ya ha ocurrido, en vez de
    // aseverar sobre el anterior (el aviso de `AGENTS.md`).
    expect(await screen.findByText("previo: true")).toBeInTheDocument()
    // Y con el dia de manana aun en vuelo, la rejilla sigue teniendo datos.
    expect(screen.getByText("citas: 2")).toBeInTheDocument()
    expect(screen.getByText("cargando: false")).toBeInTheDocument()

    deliverTomorrow(page(5))

    expect(await screen.findByText("citas: 5")).toBeInTheDocument()
    expect(screen.getByText("previo: false")).toBeInTheDocument()
  })

  it("cambiar de EMPLEADO no presta el dia del anterior: vuelve a cargar", async () => {
    // La `queryKey` no solo lleva la fecha: lleva tambien `employeeId`, que el
    // calendario cambia cada vez que se toca una pildora del filtro de movil.
    // Prestando ahi, `isLoading` no se levanta y la pantalla filtra por el id
    // NUEVO la lista VIEJA: la columna sale vacia y la agenda AFIRMA "Sin
    // citas" sin haberlo comprobado.
    let deliverSofia: (value: Page<Appointment>) => void = () => {}
    list.mockImplementation((params: AppointmentListParams) =>
      params.employeeId === "emp_1"
        ? Promise.resolve(page(2))
        : new Promise<Page<Appointment>>((resolve) => {
            deliverSofia = resolve
          })
    )

    const { show } = renderProbe({ date: TODAY, employeeId: "emp_1" })
    expect(await screen.findByText("citas: 2")).toBeInTheDocument()

    show({ date: TODAY, employeeId: "emp_2" })

    // `cargando: true` es lo que el componente NO tenia antes del cambio:
    // esperarlo prueba que el render nuevo ya ha ocurrido (el aviso de
    // `AGENTS.md`), en vez de aseverar sobre el anterior.
    expect(await screen.findByText("cargando: true")).toBeInTheDocument()
    expect(screen.getByText("citas: -")).toBeInTheDocument()
    expect(screen.getByText("previo: false")).toBeInTheDocument()

    deliverSofia(page(5))

    expect(await screen.findByText("citas: 5")).toBeInTheDocument()
  })

  it("salir a 'Todos' tampoco presta: un dia incompleto no se da por completo", async () => {
    // La direccion contraria y la mas peligrosa: la lista de UNA empleada le
    // faltan las citas de las demas, y darla por buena hace que el recuadro
    // "Libre" ofrezca una franja que las que faltan ya tienen ocupada.
    let deliverAll: (value: Page<Appointment>) => void = () => {}
    list.mockImplementation((params: AppointmentListParams) =>
      params.employeeId === "emp_1"
        ? Promise.resolve(page(2))
        : new Promise<Page<Appointment>>((resolve) => {
            deliverAll = resolve
          })
    )

    const { show } = renderProbe({ date: TODAY, employeeId: "emp_1" })
    expect(await screen.findByText("citas: 2")).toBeInTheDocument()

    show({ date: TODAY })

    expect(await screen.findByText("cargando: true")).toBeInTheDocument()
    expect(screen.getByText("citas: -")).toBeInTheDocument()

    deliverAll(page(8))

    expect(await screen.findByText("citas: 8")).toBeInTheDocument()
  })

  it("con el mismo empleado, cambiar de dia SI sigue prestando", async () => {
    // El recorte es a la dimension de la fecha, no un "no prestar nunca": con
    // el filtro puesto, avanzar de dia tiene que seguir sin desmontar la
    // rejilla. Sin este caso se puede devolver `undefined` siempre y la suite
    // sigue verde.
    let deliverTomorrow: (value: Page<Appointment>) => void = () => {}
    list.mockImplementation((params: AppointmentListParams) =>
      params.date === TODAY
        ? Promise.resolve(page(3))
        : new Promise<Page<Appointment>>((resolve) => {
            deliverTomorrow = resolve
          })
    )

    const { show } = renderProbe({ date: TODAY, employeeId: "emp_1" })
    expect(await screen.findByText("citas: 3")).toBeInTheDocument()

    show({ date: TOMORROW, employeeId: "emp_1" })

    expect(await screen.findByText("previo: true")).toBeInTheDocument()
    expect(screen.getByText("citas: 3")).toBeInTheDocument()
    expect(screen.getByText("cargando: false")).toBeInTheDocument()

    deliverTomorrow(page(1))

    expect(await screen.findByText("citas: 1")).toBeInTheDocument()
  })

  it("no pide nada sin sesion", () => {
    useAuthMock.mockReturnValue({ accessToken: null, isAuthenticated: false })

    renderProbe({ date: TODAY })

    expect(list).not.toHaveBeenCalled()
  })
})

describe("useTodayAppointments", () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    useAuthMock.mockReturnValue({ accessToken: "token", isAuthenticated: true })
    list.mockReset()
  })

  it("consulta el dia sin employeeId y conserva el prestamo entre dias", async () => {
    // `/today` hereda el `placeholderData` recortado de `useAppointments`. Le
    // es inocuo porque su clave es ESTABLE: sin `employeeId`, la unica
    // dimension que puede moverse es la fecha -- pasar de medianoche --, que
    // es justo la que sigue prestando.
    let deliverTomorrow: (value: Page<Appointment>) => void = () => {}
    list.mockImplementation((params: AppointmentListParams) =>
      params.date === TODAY
        ? Promise.resolve(page(4))
        : new Promise<Page<Appointment>>((resolve) => {
            deliverTomorrow = resolve
          })
    )

    const { show } = renderTodayProbe(TODAY)
    expect(await screen.findByText("citas: 4")).toBeInTheDocument()
    // `date` here is the SCREEN-level concept (D1): this test mocks the
    // whole `@/lib/api/appointments` module (see `vi.mock` above), so
    // `appointmentsApi.list` never runs and `date` reaches the mock as-is,
    // by design -- it is what lets `differsOnlyByDate` and the day-borrowing
    // this test exercises stay decoupled from the wire format. The
    // translation of `date` into `startDate`/`endDate` is implemented and
    // tested at the API layer, in `src/lib/api/appointments.test.ts`.
    expect(list.mock.calls[0][0]).toEqual({ date: TODAY, page: 0, size: 100 })

    show(TOMORROW)

    // `previo: true` es lo que el componente NO tenia antes del cambio de dia:
    // esperarlo prueba que el render nuevo ya ha ocurrido (el aviso de
    // `AGENTS.md`), en vez de aseverar sobre el render anterior -- donde el
    // texto seria identico y el caso pasaria sin probar nada.
    expect(await screen.findByText("previo: true")).toBeInTheDocument()
    expect(screen.getByText("citas: 4")).toBeInTheDocument()
    expect(screen.getByText("cargando: false")).toBeInTheDocument()

    deliverTomorrow(page(6))

    expect(await screen.findByText("citas: 6")).toBeInTheDocument()
  })
})
