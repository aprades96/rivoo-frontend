import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useAppointments } from "./use-appointments"
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

/**
 * La sonda escribe lo que el calendario mira para decidir si desmonta la
 * rejilla: `isLoading`, cuantas citas tiene a mano y si lo que ve es el dia
 * anterior mientras llega el nuevo.
 */
function Probe({ date }: { date: string }) {
  const { data, isLoading, isPlaceholderData } = useAppointments({ date, page: 0, size: 200 })

  return (
    <ul>
      <li>{`citas: ${data?.content.length ?? "-"}`}</li>
      <li>{`cargando: ${isLoading}`}</li>
      <li>{`previo: ${isPlaceholderData}`}</li>
    </ul>
  )
}

function renderProbe(date: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const tree = (value: string) => (
    <QueryClientProvider client={client}>
      <Probe date={value} />
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
    // sin `keepPreviousData`, avanzar de dia levanta `isLoading`, el calendario
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

    const { show } = renderProbe(TODAY)
    expect(await screen.findByText("citas: 2")).toBeInTheDocument()

    show(TOMORROW)

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

  it("no pide nada sin sesion", () => {
    useAuthMock.mockReturnValue({ accessToken: null, isAuthenticated: false })

    renderProbe(TODAY)

    expect(list).not.toHaveBeenCalled()
  })
})
