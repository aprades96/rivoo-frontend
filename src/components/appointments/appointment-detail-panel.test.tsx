import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AppointmentDetailPanel } from "./appointment-detail-panel"
import { cn } from "@/lib/utils"
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

/**
 * `Intl.NumberFormat("es-ES", { currency: "EUR" })` separa la cifra del
 * simbolo con un espacio DURO (U+00A0). Mismo patron que
 * `appointment-block.test.tsx:43-51`: sin normalizar, un `toContain` a pelo
 * seria un verde-falso trivial.
 */
const NON_BREAKING_SPACE = String.fromCharCode(160)
function normalize(value: string): string {
  return value.split(NON_BREAKING_SPACE).join(String.fromCharCode(32))
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

  it("Escape NO cierra el panel si hay un dialogo abierto encima (hallazgo 3, caso b)", async () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<AppointmentDetailPanel appointment={makeAppointment()} onClose={onClose} />)

    await user.click(screen.getByText("Cancelar"))
    // Prueba independiente de que el dialogo esta de verdad montado antes de
    // disparar Escape -- si esto fallase, el test de abajo pasaria en falso.
    const confirmButton = screen.getByText("Cancelar cita", { selector: "button" })
    expect(confirmButton).toBeInTheDocument()
    // El foco lo movemos a un BOTON (no a un campo de texto) para aislar el
    // mecanismo bajo prueba: el guard de "hay un dialogo abierto", no el de
    // "el foco esta en un input/textarea" (el `Textarea` del propio dialogo
    // tambien lo cumpliria y taparia el fallo si el primer guard se rompiera).
    confirmButton.focus()
    expect(document.activeElement).toBe(confirmButton)

    fireEvent.keyDown(document, { key: "Escape" })

    expect(onClose).not.toHaveBeenCalled()
  })

  it("Escape NO cierra el panel si otro listener ya lo ha marcado como atendido (hallazgo 3, caso a)", () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    const onClose = vi.fn()
    render(<AppointmentDetailPanel appointment={makeAppointment()} onClose={onClose} />)

    // Simula el buscador desplegado (`calendar-search.tsx:118`): un campo
    // ajeno al panel que, al plegarse con Escape, marca el evento como
    // atendido con `preventDefault()` -- la SENAL EXPLICITA que sustituye a la
    // heuristica de foco (hallazgo 3). El panel escucha en `document`, y como
    // el evento burbujea desde el campo, le llega con `defaultPrevented`.
    const foreignField = document.createElement("input")
    document.body.appendChild(foreignField)
    foreignField.addEventListener("keydown", (event) => {
      if (event.key === "Escape") event.preventDefault()
    })

    fireEvent.keyDown(foreignField, { key: "Escape" })

    expect(onClose).not.toHaveBeenCalled()

    document.body.removeChild(foreignField)
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

  it("no pinta el email del cliente (§1.2 diferencia 5, hallazgo 5)", () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    render(<AppointmentDetailPanel appointment={makeAppointment()} onClose={vi.fn()} />)

    expect(screen.queryByText("ana@mail.com")).not.toBeInTheDocument()
  })

  it("la franja del medio conserva su scroll propio para no empujar las acciones (D20, hallazgo 6)", () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    render(<AppointmentDetailPanel appointment={makeAppointment()} onClose={vi.fn()} />)

    expect(screen.getByTestId("appointment-panel-scroll")).toHaveClass(
      "min-h-0",
      "flex-1",
      "overflow-y-auto"
    )
  })

  it("el chasis y la tipografia fijan las medidas del canvas (DetalleCitaDesktop:249-330, hallazgo 4)", () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    render(<AppointmentDetailPanel appointment={makeAppointment()} onClose={vi.fn()} />)

    // Chasis: ancho 360, padding 20, gap 14, borde izquierdo y fondo.
    expect(screen.getByTestId("appointment-detail-panel")).toHaveClass(
      "w-[360px]",
      "p-5",
      "gap-[14px]",
      "border-l",
      "bg-muted-subtle"
    )

    // Rotulo: 12px/600 en mayusculas.
    expect(screen.getByTestId("appointment-panel-label")).toHaveClass(
      "text-[12px]",
      "font-semibold",
      "uppercase"
    )

    // Hora y fecha.
    expect(screen.getByTestId("appointment-panel-time")).toHaveClass("text-[30px]")
    expect(screen.getByTestId("appointment-panel-date")).toHaveClass("text-[13px]")

    // Tarjetas `.sec`: padding 12, radio 10, gap 12.
    for (const testId of [
      "appointment-panel-client-card",
      "appointment-panel-service-card",
      "appointment-panel-employee-card",
    ]) {
      expect(screen.getByTestId(testId)).toHaveClass("p-3", "rounded-[10px]", "gap-3")
    }

    // Chip `.ico`: 36x36, radio 8.
    expect(screen.getByTestId("appointment-panel-client-icon")).toHaveClass("size-9", "rounded-lg")

    // Avatar de empleado: 36, redondo.
    expect(screen.getByTestId("appointment-panel-employee-avatar")).toHaveClass("size-9", "rounded-full")

    // Precio aislado a 17px.
    expect(screen.getByTestId("appointment-panel-price")).toHaveClass("text-[17px]")

    // Recuadro de nota.
    expect(screen.getByTestId("appointment-panel-note")).toHaveClass(
      "rounded-[10px]",
      "border-warning-border",
      "bg-warning-soft",
      "p-3"
    )

    // Meta a 11px.
    expect(screen.getByTestId("appointment-panel-meta")).toHaveClass("text-[11px]")
  })

  it('el dialogo de cancelacion se remonta al cambiar de cita gracias a `key={appointment.id}` (hallazgo 1, HIGH)', async () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    const user = userEvent.setup()
    const appointmentA = makeAppointment({ id: "apt_ana", clientName: "Ana Garcia" })
    const appointmentB = makeAppointment({ id: "apt_carla", clientName: "Carla Ruiz" })
    const { rerender } = render(<AppointmentDetailPanel appointment={appointmentA} onClose={vi.fn()} />)

    await user.click(screen.getByText("Cancelar"))
    const reasonBefore = screen.getByPlaceholderText("Motivo de cancelacion (opcional)")
    await user.type(reasonBefore, "No puede venir")
    expect(reasonBefore).toHaveValue("No puede venir")

    // El panel NO se desmonta al cambiar de cita (D9): sigue siendo el mismo
    // arbol de React, y `cancelDialogOpen` -- estado INTERNO del panel -- se
    // queda en `true`. Sin `key={appointment.id}` en `CancelAppointmentDialog`
    // esto seguiria siendo la MISMA instancia al pasar a la cita de Carla, y
    // el motivo escrito para Ana sobreviviria sobre su dialogo -- exactamente
    // la fuga que documenta el comentario junto al `key` en el componente.
    rerender(<AppointmentDetailPanel appointment={appointmentB} onClose={vi.fn()} />)

    const reasonAfter = screen.getByPlaceholderText("Motivo de cancelacion (opcional)")
    expect(reasonAfter).toHaveValue("")
    expect(screen.getByText(/cancelara la cita de Carla Ruiz/)).toBeInTheDocument()
  })

  it('"Confirmar cita" dispara la mutacion de estado con el id y CONFIRMED (H3: el CTA principal puede quedar desconectado sin que ningun test lo note)', async () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    const user = userEvent.setup()
    render(<AppointmentDetailPanel appointment={makeAppointment({ id: "apt_1", status: "PENDING" })} onClose={vi.fn()} />)

    await user.click(screen.getByText("Confirmar cita"))

    expect(updateStatusMutateMock).toHaveBeenCalledTimes(1)
    expect(updateStatusMutateMock).toHaveBeenCalledWith({ id: "apt_1", status: "CONFIRMED" })
  })

  it("la tarjeta de servicio pinta precio y duracion, no solo la clase del precio (H3b)", () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    render(
      <AppointmentDetailPanel
        appointment={makeAppointment({ servicePrice: 65, serviceDurationMinutes: 90 })}
        onClose={vi.fn()}
      />
    )

    const price = screen.getByTestId("appointment-panel-price")
    expect(normalize(price.textContent ?? "")).toBe("65,00 €")
    expect(screen.getByText("1h 30min")).toBeInTheDocument()
  })

  it("el avatar del empleado usa su colorHex cuando existe, no solo el fallback (H3b)", () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage({ colorHex: "#123456" }) })
    render(<AppointmentDetailPanel appointment={makeAppointment()} onClose={vi.fn()} />)

    const avatar = screen.getByTestId("appointment-panel-employee-avatar")
    expect(avatar).toHaveStyle({ backgroundColor: "#12345620", color: "#123456" })
  })

  it("el color de reserva del avatar para un empleado ausente es SIEMPRE el primero de la paleta, nunca el ultimo (M3, D11 + D12)", () => {
    mockMatchMedia(true)
    // Lista de dos ACTIVOS que no incluye al empleado de la cita: si el
    // resolutor no normalizase el -1 de "no encontrado", `paletteIndex` lo
    // interpretaria como la ULTIMA posicion de la paleta (modulo de un
    // negativo), y el avatar cambiaria de color en silencio.
    useEmployeesMock.mockReturnValue({
      data: {
        content: [
          { id: "emp_a", firstName: "A", lastName: "A", email: "a@x.com", phone: null, jobTitle: null, colorHex: null, isActive: true, createdAt: `${DAY}T00:00:00` },
          { id: "emp_b", firstName: "B", lastName: "B", email: "b@x.com", phone: null, jobTitle: null, colorHex: null, isActive: true, createdAt: `${DAY}T00:00:00` },
        ],
      },
    })
    render(
      <AppointmentDetailPanel
        appointment={makeAppointment({ employeeId: "emp_borrado", employeeName: "Laura Martinez" })}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByTestId("appointment-panel-employee-avatar")).toHaveClass(
      "bg-chart-1/12",
      "text-chart-1"
    )
  })

  it('`cn()` no descarta `leading-tight` cuando `text-[11px]` va ANTES en la cadena (H2: el orden dentro de cn() importa)', () => {
    // Reproduce la medicion del hallazgo: `twMerge` trata las utilidades
    // `text-[Npx]` como del mismo grupo de conflicto que `leading-*` (el
    // tamano de fuente arbitrario tambien fija un interlineado implicito), asi
    // que la clase que va DESPUES en la cadena es la que sobrevive. Si alguien
    // reordenase el literal de `:170` a "leading-tight text-[11px]...", este
    // test lo cazaria porque `leading-tight` desaparece del resultado.
    const invertido = cn("leading-tight text-[11px] font-bold", "bg-x text-y")
    expect(invertido).not.toContain("leading-tight")

    const enOrden = cn("text-[11px] leading-tight font-bold", "bg-x text-y")
    expect(enOrden).toContain("leading-tight")
  })

  it("el interlineado (leading-tight) se conserva en las lineas de texto del panel, incluida la que pasa por cn() (H2)", () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    render(<AppointmentDetailPanel appointment={makeAppointment()} onClose={vi.fn()} />)

    // `:170`, unica linea de interlineado que pasa por `cn()` en este fichero
    // -- la que demuestra el riesgo de orden de arriba.
    expect(screen.getByTestId("appointment-panel-status")).toHaveClass("leading-tight")

    // El resto de lineas de texto del panel que llevan `leading-tight` en el
    // fuente (rotulo, fecha, meta, nombre/telefono de cliente, nombre/duracion
    // de servicio, nombre/puesto de empleado): quitar cualquiera de ellas
    // sigue verde sin estas aserciones.
    expect(screen.getByTestId("appointment-panel-label")).toHaveClass("leading-tight")
    expect(screen.getByTestId("appointment-panel-date")).toHaveClass("leading-tight")
    expect(screen.getByTestId("appointment-panel-meta")).toHaveClass("leading-tight")
    expect(screen.getByText("Ana Garcia")).toHaveClass("leading-tight")
    expect(screen.getByText("612 345 678")).toHaveClass("leading-tight")
    expect(screen.getByText("Corte + Tinte")).toHaveClass("leading-tight")
    expect(screen.getByText("1h 30min")).toHaveClass("leading-tight")
    expect(screen.getByText("Laura Martinez")).toHaveClass("leading-tight")
    expect(screen.getByText("Estilista")).toHaveClass("leading-tight")
  })

  it('doce medidas de §1.2 que hoy pueden borrarse sin romper ningun test (M4, DetalleCitaDesktop.dc.html:249-330)', () => {
    mockMatchMedia(true)
    useEmployeesMock.mockReturnValue({ data: employeePage() })
    render(<AppointmentDetailPanel appointment={makeAppointment()} onClose={vi.fn()} />)

    // Acciones al fondo del panel (`:314`, item explicito del plan): sin
    // `mt-auto` las acciones subirian pegadas a la franja con scroll.
    expect(screen.getByTestId("appointment-actions")).toHaveClass("mt-auto")

    // Boton de cerrar 30x30 (`:253`).
    expect(screen.getByTestId("appointment-panel-close")).toHaveClass("size-[30px]")

    // Botones de contacto 32x32 (`:273`, `:276`).
    expect(screen.getByTestId("appointment-panel-call")).toHaveClass("size-8")
    expect(screen.getByTestId("appointment-panel-sms")).toHaveClass("size-8")

    // Icono dentro del chip `.ico`: 17px (`:266` cliente, `:284` servicio).
    const clientIcon = screen.getByTestId("appointment-panel-client-icon").querySelector("svg")
    expect(clientIcon).toHaveClass("size-[17px]")
    const serviceIcon = screen.getByTestId("appointment-panel-service-card").querySelector("svg")
    expect(serviceIcon).toHaveClass("size-[17px]")

    // `strokeWidth` del CTA (2.25, `:316`) y de los iconos del panel (1.75,
    // p.ej. el propio icono de cliente, `:266`). Lucide vuelca `strokeWidth`
    // como atributo `stroke-width` en el SVG.
    const ctaIcon = screen.getByTestId("appointment-cta").querySelector("svg")
    expect(ctaIcon).toHaveAttribute("stroke-width", "2.25")
    expect(clientIcon).toHaveAttribute("stroke-width", "1.75")

    // Tipografia del cuerpo de la nota: 12px, interlineado 1.45 (`:305`).
    expect(screen.getByText("Alergia al amoniaco.")).toHaveClass("text-[12px]", "leading-[1.45]")

    // Gap del bloque "estado + hora + fecha" (`:258`): 7px.
    expect(screen.getByTestId("appointment-panel-status").parentElement).toHaveClass(
      "flex-col",
      "gap-[7px]"
    )
  })
})
