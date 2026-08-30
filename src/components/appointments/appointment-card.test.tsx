import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AppointmentCard } from "./appointment-card"
import type { Appointment, AppointmentStatus } from "@/types/appointment"
import type { Employee } from "@/types/employee"

const useEmployeesMock = vi.fn()

// `vi.mock` sustituye el modulo `@/hooks/use-staff` ENTERO: si algun otro
// hook de ese fichero se necesitase aqui habria que sembrarlo tambien, o
// quedaria `undefined` para cualquier componente que lo montase.
vi.mock("@/hooks/use-staff", () => ({
  useEmployees: (...args: unknown[]) => useEmployeesMock(...args),
}))

/**
 * `src/test/setup.ts:26` deja `window.matchMedia` fijo en `matches: false`
 * (movil). Todo test de escritorio necesita sobrescribirlo el mismo, con su
 * `afterEach` que lo repone -- el patron ya usado en
 * `wizard/service-step.test.tsx` y `appointment-detail-sheet.test.tsx`.
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
 * simbolo con un espacio DURO (U+00A0), no el espacio normal que se lee en
 * el artboard. Patron identico a `calendar/appointment-block.test.tsx:43-51`.
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
    clientName: "Carla Ruiz",
    clientPhone: null,
    clientEmail: null,
    employeeId: "emp_1",
    employeeName: "Sofia Puig",
    serviceId: "svc_1",
    serviceName: "Corte y secado",
    servicePrice: 35,
    // Menor de 60: es lo unico que distingue `formatDurationTight` ("45min")
    // de `formatDuration` ("45 min") -- por encima de 60 minutos las dos
    // dan el mismo texto.
    serviceDurationMinutes: 45,
    startTime: `${DAY}T09:00:00`,
    endTime: `${DAY}T09:45:00`,
    status: "CONFIRMED" as AppointmentStatus,
    source: "MANUAL",
    notes: null,
    reminderSent: false,
    createdAt: `${DAY}T08:00:00`,
    updatedAt: `${DAY}T08:00:00`,
    ...overrides,
  }
}

const SOFIA: Employee = {
  id: "emp_1",
  firstName: "Sofia",
  lastName: "Puig",
  email: "sofia@mail.com",
  phone: null,
  jobTitle: "Estilista",
  colorHex: "#5C7A5E",
  isActive: true,
  createdAt: DAY,
}

/**
 * Empleado INACTIVO: `employeePaletteIndex` filtra por `isActive` a
 * proposito (`avatar.ts:98-114`), asi que la cita de este empleado debe caer
 * en la posicion 0 de la paleta de reserva -- NO en la posicion -1 sin
 * normalizar, que caeria en la ULTIMA entrada.
 */
const MARC_INACTIVE: Employee = {
  id: "emp_2",
  firstName: "Marc",
  lastName: "Oliva",
  email: "marc@mail.com",
  phone: null,
  jobTitle: "Estilista",
  colorHex: null,
  isActive: false,
  createdAt: DAY,
}

function card(): HTMLElement {
  return screen.getByTestId("appointment-card")
}

function bar(): HTMLElement {
  return screen.getByTestId("appointment-card-bar")
}

describe("AppointmentCard", () => {
  beforeEach(() => {
    useEmployeesMock.mockReset()
    useEmployeesMock.mockReturnValue({ data: { content: [SOFIA, MARC_INACTIVE] } })
    mockMatchMedia(false)
  })

  afterEach(() => {
    mockMatchMedia(false)
  })

  describe("movil (design/Main.dc.html:117-136)", () => {
    it("hora 22px/1.1, duracion SIN espacio, barra del color del empleado y la tercera linea", () => {
      render(<AppointmentCard appointment={makeAppointment()} />)

      const time = screen.getByText("09:00")
      expect(time).toHaveClass("text-[22px]", "leading-[1.1]")

      expect(screen.getByText("45min")).toBeInTheDocument()
      expect(screen.queryByText("45 min")).not.toBeInTheDocument()

      expect(bar()).toHaveClass("w-[2px]", "self-stretch")
      expect(bar()).toHaveStyle({ backgroundColor: "#5C7A5E" })

      expect(screen.getByText("Carla Ruiz")).toBeInTheDocument()

      // Servicio, separador y precio son TRES nodos hermanos en el artboard
      // (design/Main.dc.html:130-132), separados por el gap del contenedor.
      // El `truncate` recorta SOLO el nombre del servicio.
      const serviceNode = screen.getByText("Corte y secado")
      expect(serviceNode).toHaveClass("truncate")
      const priceNode = screen.getByText(exact("35,00 €"))
      expect(priceNode).toHaveClass("shrink-0")
      expect(priceNode).not.toHaveClass("truncate")

      // Tercera linea exclusiva de movil: empleado + rango horario.
      expect(screen.getByText(exact("Sofia Puig · 09:00 - 09:45"))).toBeInTheDocument()
    })

    it("con nombre de servicio largo, el precio no se lo come el truncate (D-fidelidad Main.dc.html:130-132)", () => {
      render(
        <AppointmentCard
          appointment={makeAppointment({ serviceName: "Mechas balayage con tratamiento" })}
        />
      )

      // El precio vive en su PROPIO nodo -- si volviera a compartir texto con
      // el nombre del servicio, ni el nombre ni el precio matchearian exactos.
      expect(screen.getByText("Mechas balayage con tratamiento")).toBeInTheDocument()
      expect(screen.getByText(exact("35,00 €"))).toBeInTheDocument()
    })

    it("padding 12px, gap 12px en la fila y gap 5px en la columna de datos", () => {
      render(<AppointmentCard appointment={makeAppointment()} />)

      expect(card()).toHaveClass("p-3", "gap-3")

      const dataColumn = screen.getByText("Carla Ruiz").parentElement?.parentElement
      expect(dataColumn).toHaveClass("gap-[5px]")
    })

    it("badge: los tres estados sacan su rotulo corto de statusConfig, con su padding propio (3px 8px)", () => {
      const { rerender } = render(
        <AppointmentCard appointment={makeAppointment({ status: "PENDING" })} />
      )
      let badge = screen.getByText("Pendiente")
      expect(badge).toHaveClass("px-[8px]", "py-[3px]")
      expect(badge).not.toHaveClass("px-[9px]")

      rerender(<AppointmentCard appointment={makeAppointment({ status: "CONFIRMED" })} />)
      expect(screen.getByText("Confirmada")).toBeInTheDocument()

      rerender(<AppointmentCard appointment={makeAppointment({ status: "IN_PROGRESS" })} />)
      badge = screen.getByText("En curso")
      expect(badge).toBeInTheDocument()
    })

    it("D13: la fila 'En curso' NO lleva borde especial, va con border-border como las demas", () => {
      render(<AppointmentCard appointment={makeAppointment({ status: "IN_PROGRESS" })} />)

      expect(card()).toHaveClass("border-border")
      expect(card()).not.toHaveClass("border-border-dashed-strong")
    })

    it("avisa con la cita al pulsarla", async () => {
      const onTap = vi.fn()
      const appointment = makeAppointment()
      render(<AppointmentCard appointment={appointment} onTap={onTap} />)

      await userEvent.click(card())

      expect(onTap).toHaveBeenCalledTimes(1)
      expect(onTap).toHaveBeenCalledWith(appointment)
    })

    it("empleado inactivo sin colorHex: cae en la posicion 0 de la paleta, no en la ULTIMA", () => {
      render(
        <AppointmentCard
          appointment={makeAppointment({ employeeId: "emp_2", employeeName: "Marc Oliva" })}
        />
      )

      // `employeeFallbackAvatarColor(0)` = "var(--chart-1)". Sin la
      // normalizacion -1 -> 0, `paletteIndex(-1, 5)` caeria en "var(--chart-5)".
      expect(bar()).toHaveStyle({ backgroundColor: "var(--chart-1)" })
    })
  })

  describe("escritorio (design/HoyDesktop.dc.html:116-130)", () => {
    beforeEach(() => {
      mockMatchMedia(true)
    })

    it("hora 21px/1.1, 'servicio · empleado' SIN icono ni precio, precio en columna propia, SIN tercera linea", () => {
      render(<AppointmentCard appointment={makeAppointment()} />)

      const time = screen.getByText("09:00")
      expect(time).toHaveClass("text-[21px]", "leading-[1.1]")

      expect(screen.getByText("45min")).toBeInTheDocument()
      expect(screen.getByText("Carla Ruiz")).toBeInTheDocument()

      // Linea central: servicio + empleado, SIN precio dentro.
      expect(screen.getByText(exact("Corte y secado · Sofia Puig"))).toBeInTheDocument()

      // El precio vive en su PROPIA columna (nodo de texto separado).
      expect(screen.getByText(exact("35,00 €"))).toBeInTheDocument()

      // Ni icono de tijeras (exclusivo de movil)...
      expect(card().querySelector("svg")).not.toBeInTheDocument()
      // ...ni tercera linea "empleado · rango horario" (exclusiva de movil).
      expect(screen.queryByText(exact("Sofia Puig · 09:00 - 09:45"))).not.toBeInTheDocument()
    })

    it("padding 12px 14px, gap 14px en la fila y gap 3px en la columna central", () => {
      render(<AppointmentCard appointment={makeAppointment()} />)

      expect(card()).toHaveClass("py-3", "px-[14px]", "gap-[14px]")
      expect(screen.getByText("Carla Ruiz").parentElement).toHaveClass("gap-[3px]")
    })

    it("badge de escritorio: mismo rotulo corto, con su propio padding (3px 9px), distinto del de movil", () => {
      render(<AppointmentCard appointment={makeAppointment({ status: "PENDING" })} />)

      const badge = screen.getByText("Pendiente")
      expect(badge).toHaveClass("px-[9px]", "py-[3px]")
      expect(badge).not.toHaveClass("px-[8px]")
    })

    it("D13: tambien en escritorio la fila 'En curso' se queda con el borde normal", () => {
      render(<AppointmentCard appointment={makeAppointment({ status: "IN_PROGRESS" })} />)

      expect(card()).toHaveClass("border-border")
      expect(card()).not.toHaveClass("border-border-dashed-strong")
    })
  })
})
