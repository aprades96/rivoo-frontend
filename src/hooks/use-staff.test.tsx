import type { ReactElement } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useEmployees, useEmployeesWorkingHours, useEmployeesServices } from "./use-staff"
import type { WorkingHoursResponse, EmployeeServiceResponse } from "@/types/employee"

const useAuthMock = vi.fn()

vi.mock("@/hooks/use-auth", () => ({
  useAuth: (...args: unknown[]) => useAuthMock(...args),
}))

const getWorkingHours = vi.fn()
const getEmployeeServices = vi.fn()
const listEmployees = vi.fn()

vi.mock("@/lib/api/staff", () => ({
  staffApi: {
    getWorkingHours: (...args: unknown[]) => getWorkingHours(...args),
    getEmployeeServices: (...args: unknown[]) => getEmployeeServices(...args),
    listEmployees: (...args: unknown[]) => listEmployees(...args),
  },
}))

function renderWithClient(ui: ReactElement, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  return { client }
}

function EmployeesProbe({ includeInactive }: { includeInactive?: boolean }) {
  const { data } = useEmployees(includeInactive === undefined ? undefined : { includeInactive })
  return <div>{`empleados: ${data?.content.length ?? "-"}`}</div>
}

describe("useEmployees", () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    useAuthMock.mockReturnValue({ accessToken: "token", isAuthenticated: true })
    listEmployees.mockReset()
    listEmployees.mockResolvedValue({ content: [{ id: "emp_1" }], totalElements: 1 })
  })

  it("calls listEmployees without includeInactive by default (D35: consumers keep seeing only active employees)", async () => {
    renderWithClient(<EmployeesProbe />)

    expect(await screen.findByText("empleados: 1")).toBeInTheDocument()
    expect(listEmployees).toHaveBeenCalledWith("token", { includeInactive: false })
  })

  it("keeps includeInactive:true and includeInactive:false in separate cache entries (D34)", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    renderWithClient(<EmployeesProbe includeInactive={false} />, client)

    expect(await screen.findByText("empleados: 1")).toBeInTheDocument()

    // A DIFFERENT payload for the "includeInactive: true" query key: proves
    // the two do not collide (a deeply-equal payload would prove nothing --
    // `structuralSharing` would hand back the same object either way).
    listEmployees.mockResolvedValue({ content: [{ id: "emp_1" }, { id: "emp_2" }], totalElements: 2 })
    renderWithClient(<EmployeesProbe includeInactive={true} />, client)

    expect(await screen.findByText("empleados: 2")).toBeInTheDocument()
    expect(listEmployees).toHaveBeenLastCalledWith("token", { includeInactive: true })

    expect(
      client.getQueryData(["employees", { includeInactive: false }])
    ).toEqual({ content: [{ id: "emp_1" }], totalElements: 1 })
  })
})

/** El horario de un empleado, distinguible por su hora de apertura. */
function hoursOpeningAt(openTime: string): WorkingHoursResponse[] {
  return [
    {
      dayOfWeek: 2,
      isOpen: true,
      openTime,
      closeTime: "20:00:00",
      breakStartTime: "13:00:00",
      breakEndTime: "14:00:00",
    },
  ]
}

const HOURS: Record<string, WorkingHoursResponse[]> = {
  emp_1: hoursOpeningAt("09:00:00"),
  emp_2: hoursOpeningAt("11:00:00"),
  emp_3: hoursOpeningAt("13:00:00"),
}

/**
 * Escribe el mapa que devuelve el hook, una linea por empleado. Es lo que hace
 * asertable la parte que de verdad importa: QUE horario le toca a QUE
 * empleado, no cuantos horarios han llegado.
 */
function Probe({ employeeIds }: { employeeIds: string[] }) {
  const { data, isLoading, isError } = useEmployeesWorkingHours(employeeIds)

  return (
    <ul>
      {employeeIds.map((employeeId) => (
        <li key={employeeId}>{`${employeeId} abre a ${data[employeeId]?.[0]?.openTime ?? "-"}`}</li>
      ))}
      <li>{`cargando: ${isLoading}`}</li>
      <li>{`error: ${isError}`}</li>
    </ul>
  )
}

/**
 * Monta la sonda y devuelve un `show` que la vuelve a renderizar con otra
 * lista SIN cambiar de `QueryClient`: el caso real es una misma pantalla cuya
 * plantilla cambia, no una aplicacion nueva.
 */
function renderProbe(employeeIds: string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const tree = (ids: string[]) => (
    <QueryClientProvider client={client}>
      <Probe employeeIds={ids} />
    </QueryClientProvider>
  )

  const { rerender } = render(tree(employeeIds))

  return { show: (ids: string[]) => rerender(tree(ids)) }
}

describe("useEmployeesWorkingHours", () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    useAuthMock.mockReturnValue({ accessToken: "token", isAuthenticated: true })
    getWorkingHours.mockReset()
    getWorkingHours.mockImplementation((id: string) =>
      HOURS[id] ? Promise.resolve(HOURS[id]) : Promise.reject(new Error("sin horario"))
    )
  })

  it("indexa por id el horario de cada empleado", async () => {
    renderProbe(["emp_1", "emp_2", "emp_3"])

    expect(await screen.findByText("emp_1 abre a 09:00:00")).toBeInTheDocument()
    expect(screen.getByText("emp_2 abre a 11:00:00")).toBeInTheDocument()
    expect(screen.getByText("emp_3 abre a 13:00:00")).toBeInTheDocument()
    expect(screen.getByText("cargando: false")).toBeInTheDocument()
    expect(screen.getByText("error: false")).toBeInTheDocument()
  })

  it("sigue dandole a cada empleado SU horario cuando la lista cambia de orden", async () => {
    // El mapa se arma POR POSICION (`results[index]`), asi que `combine` tiene
    // que rehacerse cada vez que cambia `employeeIds`. Con el `combine` viejo
    // -- memorizado sin esa dependencia -- los resultados llegan en el orden
    // nuevo y las claves en el viejo: cada empleado recibe el horario de otro
    // y el descanso se pinta en la columna equivocada.
    const { show } = renderProbe(["emp_1", "emp_2"])

    expect(await screen.findByText("emp_1 abre a 09:00:00")).toBeInTheDocument()

    show(["emp_2", "emp_1"])

    // `findBy*` y no una asercion sincrona: el aviso de `AGENTS.md`. La
    // notificacion del observador va en un macrotask, asi que aseverar aqui
    // mismo leeria el render anterior y pasaria con el fallo reintroducido.
    expect(await screen.findByText("emp_2 abre a 11:00:00")).toBeInTheDocument()
    expect(await screen.findByText("emp_1 abre a 09:00:00")).toBeInTheDocument()
  })

  it("recoge al empleado que se anade despues del primer render", async () => {
    const { show } = renderProbe(["emp_1"])

    expect(await screen.findByText("emp_1 abre a 09:00:00")).toBeInTheDocument()

    show(["emp_1", "emp_3"])

    expect(await screen.findByText("emp_3 abre a 13:00:00")).toBeInTheDocument()
  })

  it("deja fuera del mapa al empleado cuya peticion falla, y lo avisa", async () => {
    // Degrada a columna sin bloque de descanso, no a rejilla en blanco.
    renderProbe(["emp_1", "emp_roto"])

    expect(await screen.findByText("error: true")).toBeInTheDocument()
    expect(screen.getByText("emp_1 abre a 09:00:00")).toBeInTheDocument()
    expect(screen.getByText("emp_roto abre a -")).toBeInTheDocument()
  })

  it("no pide nada sin sesion", () => {
    useAuthMock.mockReturnValue({ accessToken: null, isAuthenticated: false })

    renderProbe(["emp_1"])

    expect(getWorkingHours).not.toHaveBeenCalled()
    expect(screen.getByText("emp_1 abre a -")).toBeInTheDocument()
  })
})

/** Los servicios de un empleado, distinguibles por cuantos tiene asignados. */
function servicesOf(...serviceIds: string[]): EmployeeServiceResponse[] {
  return serviceIds.map((serviceId) => ({
    serviceId,
    serviceName: serviceId,
    effectiveDuration: 30,
    effectivePrice: 20,
    customDuration: null,
    customPrice: null,
  }))
}

const SERVICES: Record<string, EmployeeServiceResponse[]> = {
  emp_1: servicesOf("svc_1", "svc_2"),
  emp_2: servicesOf("svc_3"),
}

/**
 * Igual que `Probe` de arriba pero para servicios: escribe, por empleado, la
 * lista de `serviceId` que le llego. Es lo asertable de verdad -- QUE
 * servicios le tocan a QUE empleado, no cuantos han llegado.
 */
function ServicesProbe({ employeeIds }: { employeeIds: string[] }) {
  const { data, isLoading, isError } = useEmployeesServices(employeeIds)

  return (
    <ul>
      {employeeIds.map((employeeId) => (
        <li key={employeeId}>
          {`${employeeId}: ${data[employeeId]?.map((s) => s.serviceId).join(",") ?? "-"}`}
        </li>
      ))}
      <li>{`cargando: ${isLoading}`}</li>
      <li>{`error: ${isError}`}</li>
    </ul>
  )
}

function renderServicesProbe(employeeIds: string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const tree = (ids: string[]) => (
    <QueryClientProvider client={client}>
      <ServicesProbe employeeIds={ids} />
    </QueryClientProvider>
  )

  const { rerender } = render(tree(employeeIds))

  return { show: (ids: string[]) => rerender(tree(ids)) }
}

describe("useEmployeesServices", () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    useAuthMock.mockReturnValue({ accessToken: "token", isAuthenticated: true })
    getEmployeeServices.mockReset()
    getEmployeeServices.mockImplementation((id: string) =>
      SERVICES[id] ? Promise.resolve(SERVICES[id]) : Promise.reject(new Error("sin servicios"))
    )
  })

  it("indexa por id los servicios de cada empleado", async () => {
    renderServicesProbe(["emp_1", "emp_2"])

    expect(await screen.findByText("emp_1: svc_1,svc_2")).toBeInTheDocument()
    expect(screen.getByText("emp_2: svc_3")).toBeInTheDocument()
    expect(screen.getByText("cargando: false")).toBeInTheDocument()
    expect(screen.getByText("error: false")).toBeInTheDocument()
  })

  it("sigue dandole a cada empleado SUS servicios cuando la lista cambia de orden", async () => {
    // Mismo riesgo que `useEmployeesWorkingHours`: el mapa se arma POR
    // POSICION, asi que `combine` tiene que rehacerse cuando cambia
    // `employeeIds`, o cada empleado recibe los servicios de otro.
    const { show } = renderServicesProbe(["emp_1", "emp_2"])

    expect(await screen.findByText("emp_1: svc_1,svc_2")).toBeInTheDocument()

    show(["emp_2", "emp_1"])

    // `findBy*`, no una afirmacion sincrona (AGENTS.md: `notifyManager`
    // notifica en un macrotask).
    expect(await screen.findByText("emp_2: svc_3")).toBeInTheDocument()
    expect(await screen.findByText("emp_1: svc_1,svc_2")).toBeInTheDocument()
  })

  it("deja fuera del mapa al empleado cuya peticion falla, y lo avisa, sin tumbar al resto", async () => {
    renderServicesProbe(["emp_1", "emp_roto"])

    expect(await screen.findByText("error: true")).toBeInTheDocument()
    expect(screen.getByText("emp_1: svc_1,svc_2")).toBeInTheDocument()
    expect(screen.getByText("emp_roto: -")).toBeInTheDocument()
  })

  it("no pide nada sin sesion", () => {
    useAuthMock.mockReturnValue({ accessToken: null, isAuthenticated: false })

    renderServicesProbe(["emp_1"])

    expect(getEmployeeServices).not.toHaveBeenCalled()
    expect(screen.getByText("emp_1: -")).toBeInTheDocument()
  })
})
