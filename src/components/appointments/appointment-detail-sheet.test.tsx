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

/** Empleado INACTIVO que precede a `emp_1` en la lista CRUDA (hallazgo 2). */
const INACTIVE_BEFORE: Employee = {
  id: "emp_0",
  firstName: "Marc",
  lastName: "Soler",
  email: "marc@mail.com",
  phone: null,
  jobTitle: "Estilista",
  colorHex: null,
  isActive: false,
  createdAt: DAY,
}

/** Igual que `LAURA` pero sin `colorHex`, para forzar el color de reserva. */
const LAURA_NO_COLOR: Employee = { ...LAURA, colorHex: null }

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

  it("hallazgo 2: el indice de la paleta se calcula sobre empleados ACTIVOS, no la lista cruda", () => {
    // emp_1 es el SEGUNDO de la lista cruda (indice 1) pero el PRIMERO entre
    // los activos (indice 0): con el indice crudo saldria `--chart-2`.
    useEmployeesMock.mockReturnValue({ data: { content: [INACTIVE_BEFORE, LAURA_NO_COLOR] } })
    render(<AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />)

    const dot = screen.getByTestId("employee-color-dot")
    expect(dot.style.backgroundColor).toBe("var(--chart-1)")
  })

  it("el velo del artboard viaja por overlayClassName, NO tine la hoja (hallazgo 3: token, no rgba a pelo)", () => {
    const { baseElement } = render(
      <AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />
    )

    const overlay = baseElement.querySelector('[data-slot="sheet-overlay"]')
    const content = baseElement.querySelector('[data-slot="sheet-content"]')

    // `--foreground` es `#2A2320` (`globals.css:114`); `/42` es el mismo 0,42
    // de opacidad que `rgba(42,35,32,0.42)`.
    expect(overlay).toHaveClass("bg-foreground/42")
    expect(content).not.toHaveClass("bg-foreground/42")
  })

  it("hallazgo 3: el radio de la hoja es 16px exactos, no los 14,4px de rounded-t-2xl", () => {
    const { baseElement } = render(
      <AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />
    )

    const content = baseElement.querySelector('[data-slot="sheet-content"]')
    expect(content).toHaveClass("rounded-t-[16px]")
    expect(content).not.toHaveClass("rounded-t-2xl")
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

/**
 * ---------------------------------------------------------------------------
 * Hallazgo 1 (HIGH): el interlineado heredado
 * ---------------------------------------------------------------------------
 * El artboard no declara `line-height` en estas lineas (`:52,53,60,61,77,78,86,114`),
 * asi que valen `normal` (~1,25); sin `leading-tight` heredan el 1,5 de la
 * preflight de Tailwind (mismo diagnostico que `appointment-block.tsx:116-126`).
 */
describe("AppointmentDetailSheet · el leading que el artboard no declara (hallazgo 1)", () => {
  it("hora, fecha+duracion, cliente, contacto, servicio, resumen, empleado y meta llevan leading-tight", () => {
    render(<AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />)

    expect(screen.getByText("10:00 - 11:30")).toHaveClass("leading-tight")
    expect(screen.getByText("Jueves, 27 de agosto · 1h 30min")).toHaveClass("leading-tight")
    expect(screen.getByText("Ana Garcia")).toHaveClass("leading-tight")
    // La fila de contacto (telefono+email) lleva el leading en su contenedor.
    expect(screen.getByText("612 345 678").closest(".text-xs")).toHaveClass("leading-tight")
    expect(screen.getByText("Corte + Tinte")).toHaveClass("leading-tight")
    expect(screen.getByText(exact("1h 30min · 65,00 €"))).toHaveClass("leading-tight")
    expect(screen.getByText("Laura Martinez")).toHaveClass("leading-tight")
    expect(screen.getByText("Fuente: Reserva online · Recordatorio enviado")).toHaveClass("leading-tight")
  })

  it("la nota conserva el 1.45 declarado por el artboard (`:91`), no leading-tight", () => {
    render(<AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />)

    const note = screen.getByText("Alergia al amoniaco. Usar tinte sin amoniaco.")
    expect(note).toHaveClass("leading-[1.45]")
    expect(note).not.toHaveClass("leading-tight")
  })
})

/**
 * ---------------------------------------------------------------------------
 * Hallazgo 4 (HIGH, de pruebas): la capa de MEDIDAS fijada
 * ---------------------------------------------------------------------------
 * Modelo: `appointment-block.test.tsx`. Sin estas aserciones, romper el
 * chasis (padding, radio, sombra, asa, gap, tipografia) deja los 694 tests
 * en verde igual.
 */
describe("AppointmentDetailSheet · el chasis y la tipografia fijados (hallazgo 4)", () => {
  it("la hoja: padding 10/16/20, radio 16, gap 16 y la sombra del artboard", () => {
    const { baseElement } = render(
      <AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />
    )

    const content = baseElement.querySelector('[data-slot="sheet-content"]')
    expect(content).toHaveClass("pt-[10px]", "px-4", "pb-5", "rounded-t-[16px]", "gap-4")
    expect(content).toHaveClass("shadow-[0_-8px_30px_rgba(42,35,32,0.2)]")
  })

  it("el asa: 36x4, pildora y el color del token --grabber", () => {
    render(<AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />)

    const grabber = screen.getByTestId("detail-sheet-grabber")
    expect(grabber).toHaveClass("h-1", "w-9", "rounded-full", "bg-grabber")
  })

  it("el titulo: 23px/1.1 y semibold", () => {
    render(<AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />)

    const title = screen.getByText("Detalle de cita")
    expect(title).toHaveClass("text-[23px]", "leading-[1.1]", "font-semibold")
  })

  it("el badge: padding 4/10, radio 999, 11px/600 y leading-tight (hallazgo 1: `:44` tampoco declara line-height)", () => {
    render(<AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />)

    const badge = screen.getByText("Pendiente")
    expect(badge).toHaveClass(
      "rounded-full",
      "px-[10px]",
      "py-1",
      "text-[11px]",
      "leading-tight",
      "font-semibold"
    )
  })

  it("la lista de hechos: gap 14 entre filas", () => {
    render(<AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />)

    expect(screen.getByTestId("detail-sheet-facts")).toHaveClass("gap-3.5")
  })

  it("las filas: iconos de 18px y textos 15/12", () => {
    render(<AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />)

    const timeRow = screen.getByText("10:00 - 11:30").closest(".items-start")
    expect(timeRow?.querySelector("svg")).toHaveClass("size-[18px]")
    expect(screen.getByText("10:00 - 11:30")).toHaveClass("text-[15px]")
    expect(screen.getByText("Jueves, 27 de agosto · 1h 30min")).toHaveClass("text-xs")

    const serviceRow = screen.getByText("Corte + Tinte").closest(".items-start")
    expect(serviceRow?.querySelector("svg")).toHaveClass("size-[18px]")
    expect(screen.getByText("Corte + Tinte")).toHaveClass("text-[15px]")
    expect(screen.getByText(exact("1h 30min · 65,00 €"))).toHaveClass("text-xs")
  })

  it("el separador esta presente entre la lista y las acciones", () => {
    const { baseElement } = render(
      <AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />
    )

    expect(baseElement.querySelector('[data-slot="separator"]')).toHaveClass("bg-border")
  })

  it("el CTA mide 48px y los secundarios 46px", () => {
    render(<AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />)

    expect(screen.getByTestId("appointment-cta")).toHaveClass("h-12")
    for (const secondary of screen.getAllByTestId("appointment-secondary-action")) {
      expect(secondary).toHaveClass("h-[46px]")
    }
  })

  it("la meta: 11px", () => {
    render(<AppointmentDetailSheet appointment={makeAppointment()} open onOpenChange={vi.fn()} />)

    expect(screen.getByText("Fuente: Reserva online · Recordatorio enviado")).toHaveClass("text-[11px]")
  })
})

/**
 * ---------------------------------------------------------------------------
 * Re-revision, Hallazgo 5: se retira el `useRef` que retenia la ultima cita
 * ---------------------------------------------------------------------------
 * La ronda anterior escribia un `useRef` DURANTE EL RENDER para conservar la
 * ultima cita no nula y comprar asi una animacion de salida (`data-ending-style`)
 * que ningun artboard dibuja y que en jsdom ni siquiera es observable
 * (`Element.getAnimations` no existe: `@base-ui/react/dialog` resuelve la
 * transicion de forma sincrona). El coste real: 24 errores
 * `react-hooks/refs -- Cannot access refs during render`, y que tras la
 * primera apertura el componente ya nunca devolvia `null`, dejando montados
 * para siempre un `<Sheet>` y un `<CancelAppointmentDialog>` cerrados con la
 * ultima cita dentro. Se vuelve a `if (!appointment) return null`; las dos
 * pruebas que consagraban el estado retenido se retiran con el `ref`. Se deja
 * la de "no revienta" porque no depende de la retencion.
 */
describe("AppointmentDetailSheet · appointment=null desmonta limpio (hallazgo 5)", () => {
  it("no revienta cuando appointment y open cambian a la vez, como hace calendar/page.tsx", () => {
    const appointment = makeAppointment()
    const { rerender } = render(
      <AppointmentDetailSheet appointment={appointment} open onOpenChange={vi.fn()} />
    )

    expect(() =>
      rerender(<AppointmentDetailSheet appointment={null} open={false} onOpenChange={vi.fn()} />)
    ).not.toThrow()
  })

  it("appointment=null desmonta el contenido (ya no se retiene la ultima cita)", () => {
    const appointment = makeAppointment()
    const { rerender } = render(
      <AppointmentDetailSheet appointment={appointment} open onOpenChange={vi.fn()} />
    )
    expect(screen.getByText("Ana Garcia")).toBeInTheDocument()

    rerender(<AppointmentDetailSheet appointment={null} open onOpenChange={vi.fn()} />)

    expect(screen.queryByText("Ana Garcia")).not.toBeInTheDocument()
  })
})

/**
 * ---------------------------------------------------------------------------
 * Re-revision, Hallazgo 1 (HIGH): `reason`/`mutationError` mueren con la cita
 * ---------------------------------------------------------------------------
 * `cancel-appointment-dialog.tsx` ya no se reinicia a si mismo por efecto: la
 * invariante "el estado muere con la cita" la sostiene el `key={appointment.id}`
 * con el que esta hoja monta el dialogo. Esta prueba reproduce la secuencia
 * demostrada como fallida en la re-revision: una cancelacion en vuelo cuyo
 * `onError` no ha llegado todavia, "Volver" (el boton no se deshabilita),
 * cambio de cita, y solo ENTONCES la respuesta tardia. Sin el `key`, el
 * `onError` de Ana aterriza en la misma instancia ya reutilizada por Carla.
 */
describe("AppointmentDetailSheet · el key mata reason/mutationError al cambiar de cita (hallazgo 1)", () => {
  it("REGRESION: un fallo de cancelacion en vuelo no debe colarse en la cita siguiente", async () => {
    const user = userEvent.setup()
    const ana = makeAppointment({ id: "apt_ana", clientName: "Ana Garcia" })
    const carla = makeAppointment({ id: "apt_carla", clientName: "Carla Ruiz" })

    let capturedOnError: ((error: unknown) => void) | undefined
    cancelMutateMock.mockImplementation((_vars: unknown, options: { onError: (error: unknown) => void }) => {
      // La mutacion queda "en vuelo": no se invoca ni onSuccess ni onError
      // todavia, como si la respuesta de red no hubiera llegado.
      capturedOnError = options.onError
    })

    const { rerender } = render(
      <AppointmentDetailSheet appointment={ana} open onOpenChange={vi.fn()} />
    )

    await user.click(screen.getByText("Cancelar"))
    await user.type(
      await screen.findByPlaceholderText("Motivo de cancelacion (opcional)"),
      "no localizable"
    )
    await user.click(screen.getByRole("button", { name: "Cancelar cita" }))

    expect(capturedOnError).toBeDefined()

    // "Volver": el usuario no espera a la respuesta (el boton no se
    // deshabilita en vuelo).
    await user.click(screen.getByRole("button", { name: "Volver" }))

    // El usuario cambia a la cita de Carla.
    rerender(<AppointmentDetailSheet appointment={carla} open onOpenChange={vi.fn()} />)

    // La respuesta de la mutacion de Ana llega tarde, ya con Carla en pantalla.
    capturedOnError?.(new Error("network"))

    // Se reabre el dialogo, ahora para Carla: no debe quedar ni motivo ni error.
    await user.click(screen.getByText("Cancelar"))

    expect(await screen.findByPlaceholderText("Motivo de cancelacion (opcional)")).toHaveValue("")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
})
