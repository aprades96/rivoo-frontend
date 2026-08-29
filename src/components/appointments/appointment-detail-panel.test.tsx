import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AppointmentDetailPanel } from "./appointment-detail-panel"
import type { Appointment, AppointmentStatus } from "@/types/appointment"

const useEmployeesMock = vi.fn()
const updateStatusMutateMock = vi.fn()
const cancelAppointmentMutateMock = vi.fn()
const pushMock = vi.fn()

vi.mock("@/hooks/use-staff", () => ({
  useEmployees: () => useEmployeesMock(),
}))

vi.mock("@/hooks/use-appointments", () => ({
  useUpdateAppointmentStatus: () => ({ mutate: updateStatusMutateMock, isPending: false }),
  useCancelAppointment: () => ({ mutate: cancelAppointmentMutateMock, isPending: false }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, back: vi.fn(), replace: vi.fn() }),
}))

const DAY = "2026-08-27"

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "apt_1",
    tenantId: "tenant_1",
    clientId: "cli_1",
    clientName: "Ana Garcia",
    clientPhone: "612345678",
    clientEmail: "ana@mail.com",
    employeeId: "emp_1",
    employeeName: "Laura Martinez",
    serviceId: "svc_1",
    serviceName: "Corte + Tinte",
    servicePrice: 65,
    serviceDurationMinutes: 90,
    startTime: `${DAY}T10:30:00`,
    endTime: `${DAY}T12:00:00`,
    status: "PENDING" as AppointmentStatus,
    source: "ONLINE",
    notes: "Alergia al amoniaco.",
    reminderSent: true,
    createdAt: `${DAY}T08:00:00`,
    updatedAt: `${DAY}T08:00:00`,
    ...overrides,
  }
}

/**
 * El polyfill de `src/test/setup.ts` devuelve SIEMPRE `matches: false` (movil).
 * Este panel es exclusivo de escritorio, asi que cada caso lo simula aqui y lo
 * devuelve a movil en `afterEach` (patron de `booking-step-shell.test.tsx:24`).
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

function employeePage(overrides: Partial<{ firstName: string; lastName: string; jobTitle: string | null; colorHex: string | null }> = {}) {
  return {
    content: [
      {
        id: "emp_1",
        firstName: "Laura",
        lastName: "Martinez",
        email: "laura@rivoo.com",
        phone: null,
        jobTitle: "Estilista",
        colorHex: "#B4522F",
        isActive: true,
        createdAt: `${DAY}T00:00:00`,
        ...overrides,
      },
    ],
  }
}

describe("AppointmentDetailPanel", () => {
  afterEach(() => {
    mockMatchMedia(false)
    vi.clearAllMocks()
  })

  it("no pinta nada sin cita", () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    const { container } = render(<AppointmentDetailPanel appointment={null} onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('pinta el badge largo "Pendiente de confirmar" (DetalleCitaDesktop:259)', () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    render(<AppointmentDetailPanel appointment={makeAppointment()} onClose={vi.fn()} />)

    expect(screen.getByTestId("appointment-panel-status")).toHaveTextContent("Pendiente de confirmar")
  })

  it("la meta lleva el relativo abreviado de createdAt (DetalleCitaDesktop:311, D15)", () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    // 2h 5min de margen sobre el momento de ejecucion del test: sigue
    // redondeando a "hace 2 h" aunque el test tarde unos milisegundos.
    const createdAt = new Date(Date.now() - (2 * 60 + 5) * 60_000).toISOString()
    render(
      <AppointmentDetailPanel
        appointment={makeAppointment({ createdAt, reminderSent: true })}
        onClose={vi.fn()}
      />
    )

    const meta = screen.getByTestId("appointment-panel-meta")
    expect(meta).toHaveTextContent("Reserva online · recibida hace 2 h · recordatorio enviado")
  })

  it("el avatar del empleado lleva sus iniciales (DetalleCitaDesktop:294)", () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    render(<AppointmentDetailPanel appointment={makeAppointment()} onClose={vi.fn()} />)

    expect(screen.getByTestId("appointment-panel-employee-avatar")).toHaveTextContent("LM")
    expect(screen.getByText("Estilista")).toBeInTheDocument()
  })

  it("degrada a las iniciales del nombre de la cita si el empleado no aparece (D11)", () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: { content: [] } })
    render(
      <AppointmentDetailPanel
        appointment={makeAppointment({ employeeId: "emp_borrado", employeeName: "Laura Martinez" })}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByTestId("appointment-panel-employee-avatar")).toHaveTextContent("LM")
    expect(screen.queryByText("Estilista")).not.toBeInTheDocument()
  })

  it("Escape cierra el panel (D9)", () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    const onClose = vi.fn()
    render(<AppointmentDetailPanel appointment={makeAppointment()} onClose={onClose} />)

    fireEvent.keyDown(document, { key: "Escape" })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("sin telefono no hay botones de contacto (tel:/sms:)", () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    render(
      <AppointmentDetailPanel
        appointment={makeAppointment({ clientPhone: null })}
        onClose={vi.fn()}
      />
    )

    expect(screen.queryByTestId("appointment-panel-call")).not.toBeInTheDocument()
    expect(screen.queryByTestId("appointment-panel-sms")).not.toBeInTheDocument()
  })

  it("con telefono, los botones de contacto usan tel: y sms:", () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    render(<AppointmentDetailPanel appointment={makeAppointment()} onClose={vi.fn()} />)

    expect(screen.getByTestId("appointment-panel-call")).toHaveAttribute("href", "tel:612345678")
    expect(screen.getByTestId("appointment-panel-sms")).toHaveAttribute("href", "sms:612345678")
  })

  it("sin notes no se pinta el recuadro de aviso", () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    render(<AppointmentDetailPanel appointment={makeAppointment({ notes: null })} onClose={vi.fn()} />)

    expect(screen.queryByTestId("appointment-panel-note")).not.toBeInTheDocument()
  })

  it('"Reprogramar" empuja la URL con rescheduleId, date, time y employeeId (D6)', async () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    const user = userEvent.setup()
    render(<AppointmentDetailPanel appointment={makeAppointment()} onClose={vi.fn()} />)

    await user.click(screen.getByText("Reprogramar"))

    expect(pushMock).toHaveBeenCalledTimes(1)
    const url = new URL(pushMock.mock.calls[0][0] as string, "http://localhost")
    expect(url.pathname).toBe("/appointments/new")
    expect(url.searchParams.get("rescheduleId")).toBe("apt_1")
    expect(url.searchParams.get("date")).toBe("2026-08-27")
    expect(url.searchParams.get("time")).toBe("10:30")
    expect(url.searchParams.get("employeeId")).toBe("emp_1")
  })

  it('"Cancelar" abre el dialogo de cancelacion compartido (T5)', async () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    const user = userEvent.setup()
    render(<AppointmentDetailPanel appointment={makeAppointment()} onClose={vi.fn()} />)

    await user.click(screen.getByText("Cancelar"))

    expect(screen.getByText("Cancelar cita", { selector: "button" })).toBeInTheDocument()
  })
})
