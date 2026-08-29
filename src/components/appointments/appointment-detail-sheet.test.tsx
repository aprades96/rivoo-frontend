import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AppointmentDetailSheet } from "./appointment-detail-sheet"
import type { Appointment, AppointmentStatus } from "@/types/appointment"
import type { Employee } from "@/types/employee"

const updateStatusMutateMock = vi.fn()
let updateStatusIsPending = false

const cancelMutateMock = vi.fn()
let cancelIsPending = false

const useEmployeesMock = vi.fn()

vi.mock("@/hooks/use-appointments", () => ({
  useUpdateAppointmentStatus: () => ({
    mutate: (...args: unknown[]) => updateStatusMutateMock(...args),
    isPending: updateStatusIsPending,
  }),
  useCancelAppointment: () => ({
    mutate: (...args: unknown[]) => cancelMutateMock(...args),
    isPending: cancelIsPending,
  }),
}))

vi.mock("@/hooks/use-staff", () => ({
  useEmployees: (...args: unknown[]) => useEmployeesMock(...args),
}))

/**
 * jsdom no implementa `window.matchMedia` de fabrica; el polyfill de
 * `src/test/setup.ts` cubre el hueco con `matches: false` siempre (movil).
 * Esta hoja no consulta ningun `useMediaQuery` directamente, pero se
 * sobrescribe igual (con `afterEach` que la repone) siguiendo el patron ya
 * usado en el repo para no depender en silencio del valor por defecto.
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

/**
 * `Intl.NumberFormat("es-ES", { currency: "EUR" })` separa la cifra del
 * simbolo con un espacio DURO (U+00A0). Sin normalizar, `"65,00 €"` tecleado
 * a mano no encuentra nada (`appointment-block.test.tsx:43-51`).
 */
function normalize(value: string): string {
  return value.replace(/ /g, " ")
}

function exact(expected: string) {
  return (content: string) => normalize(content) === expected
}

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
    startTime: `${DAY}T10:00:00`,
    endTime: `${DAY}T11:30:00`,
    status: "PENDING" as AppointmentStatus,
    source: "ONLINE",
    notes: "Alergia al amoniaco. Usar tinte sin amoniaco.",
    reminderSent: true,
    createdAt: `${DAY}T08:00:00`,
    updatedAt: `${DAY}T08:00:00`,
    ...overrides,
  }
}

const LAURA: Employee = {
  id: "emp_1",
  firstName: "Laura",
  lastName: "Martinez",
  email: "laura@mail.com",
  phone: null,
  jobTitle: "Estilista",
  colorHex: "#5C7A5E",
  isActive: true,
  createdAt: DAY,
}

describe("AppointmentDetailSheet", () => {
  beforeEach(() => {
    updateStatusMutateMock.mockReset()
    cancelMutateMock.mockReset()
    updateStatusIsPending = false
    cancelIsPending = false
    useEmployeesMock.mockReset()
    useEmployeesMock.mockReturnValue({ data: { content: [LAURA] } })
    mockMatchMedia(false)
  })

  afterEach(() => {
    mockMatchMedia(false)
  })

  it("no pinta nada si appointment es null", () => {
    const { container } = render(
      <AppointmentDetailSheet appointment={null} open onOpenChange={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("pinta la asa y NO pinta boton de cerrar (§1.1: sin X)", () => {
    render(<AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />)

    expect(screen.getByTestId("detail-sheet-grabber")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument()
  })

  it("badge de estado: rotulo CORTO 'Pendiente', no el largo de escritorio", () => {
    render(<AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />)

    expect(screen.getByText("Pendiente")).toBeInTheDocument()
    expect(screen.queryByText("Pendiente de confirmar")).not.toBeInTheDocument()
  })

  it("pinta hora, fecha+duracion, cliente, telefono formateado, EMAIL, servicio, empleado, nota y meta", () => {
    render(<AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />)

    expect(screen.getByText("10:00 - 11:30")).toBeInTheDocument()
    expect(screen.getByText("Jueves, 27 de agosto · 1h 30min")).toBeInTheDocument()
    expect(screen.getByText("Ana Garcia")).toBeInTheDocument()
    // formatPhone("612345678") -> "612 345 678", no el numero crudo.
    expect(screen.getByText("612 345 678")).toBeInTheDocument()
    // El email es la diferencia con el panel de escritorio (§1.2 dif. 5).
    expect(screen.getByText("ana@mail.com")).toBeInTheDocument()
    expect(screen.getByText("Corte + Tinte")).toBeInTheDocument()
    expect(screen.getByText(exact("1h 30min · 65,00 €"))).toBeInTheDocument()
    expect(screen.getByText("Laura Martinez")).toBeInTheDocument()
    expect(screen.getByText("Alergia al amoniaco. Usar tinte sin amoniaco.")).toBeInTheDocument()
    expect(screen.getByText("Fuente: Reserva online · Recordatorio enviado")).toBeInTheDocument()
  })

  it("el punto del empleado es SOLIDO con el colorHex del empleado, no un icono", () => {
    render(<AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />)

    const dot = screen.getByTestId("employee-color-dot")
    expect(dot.style.backgroundColor).toBe("rgb(92, 122, 94)") // #5C7A5E
  })

  it("degrada al color de RESERVA (posicion 0) si el empleado no aparece en useEmployees()", () => {
    useEmployeesMock.mockReturnValue({ data: { content: [] } })
    render(<AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />)

    const dot = screen.getByTestId("employee-color-dot")
    expect(dot.style.backgroundColor).toBe("var(--chart-1)")
    // El nombre de la cita se sigue pintando aunque el empleado no aparezca.
    expect(screen.getByText("Laura Martinez")).toBeInTheDocument()
  })

  it("el velo del artboard viaja por overlayClassName, NO tine la hoja", () => {
    const { baseElement } = render(
      <AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />
    )

    const overlay = baseElement.querySelector('[data-slot="sheet-overlay"]')
    const content = baseElement.querySelector('[data-slot="sheet-content"]')

    expect(overlay).toHaveClass("bg-[rgba(42,35,32,0.42)]")
    expect(content).not.toHaveClass("bg-[rgba(42,35,32,0.42)]")
  })

  it("conserva max-h-[85vh] overflow-y-auto (D20: unica proteccion ante una nota larga)", () => {
    const { baseElement } = render(
      <AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />
    )

    const content = baseElement.querySelector('[data-slot="sheet-content"]')
    expect(content).toHaveClass("max-h-[85vh]")
    expect(content).toHaveClass("overflow-y-auto")
  })

  it("'Confirmar cita' dispara la mutacion CONFIRMED y cierra la hoja al exito", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    updateStatusMutateMock.mockImplementation((_vars, options) => {
      options.onSuccess()
    })

    render(<AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={onOpenChange} />)
    await user.click(screen.getByTestId("appointment-cta"))

    expect(updateStatusMutateMock).toHaveBeenCalledWith(
      { id: "apt_1", status: "CONFIRMED" },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("'No asistio' dispara la mutacion NO_SHOW -- la transicion PENDING->NO_SHOW que abre D5", async () => {
    const user = userEvent.setup()
    render(<AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />)

    await user.click(screen.getByText("No asistio"))

    expect(updateStatusMutateMock).toHaveBeenCalledWith(
      { id: "apt_1", status: "NO_SHOW" },
      expect.any(Object)
    )
  })

  it("'Cancelar' abre el dialogo de cancelacion en vez de mandar la mutacion directamente", async () => {
    const user = userEvent.setup()
    render(<AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />)

    await user.click(screen.getByText("Cancelar"))

    expect(await screen.findByRole("heading", { name: "Cancelar cita" })).toBeInTheDocument()
    expect(updateStatusMutateMock).not.toHaveBeenCalled()
    expect(cancelMutateMock).not.toHaveBeenCalled()
  })

  it("un estado terminal (COMPLETED) no pinta ninguna accion", () => {
    render(
      <AppointmentDetailSheet
        appointment={makeAppointment({ status: "COMPLETED" })}
        open
        onOpenChange={vi.fn()}
      />
    )

    expect(screen.queryByTestId("appointment-cta")).not.toBeInTheDocument()
  })

  it("sin telefono ni email no pinta esa fila de contacto", () => {
    render(
      <AppointmentDetailSheet
        appointment={makeAppointment({ clientPhone: null, clientEmail: null })}
        open
        onOpenChange={vi.fn()}
      />
    )

    expect(screen.queryByText("612 345 678")).not.toBeInTheDocument()
    expect(screen.queryByText("ana@mail.com")).not.toBeInTheDocument()
  })

  it("sin notas no pinta la fila de nota", () => {
    render(
      <AppointmentDetailSheet appointment={makeAppointment({ notes: null })} open onOpenChange={vi.fn()} />
    )

    expect(screen.queryByText(/Alergia/)).not.toBeInTheDocument()
  })
})
