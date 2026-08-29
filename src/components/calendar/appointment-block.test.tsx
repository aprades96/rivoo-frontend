import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AppointmentBlock } from "./appointment-block"
import { BreakBlock } from "./break-block"
import { FreeSlotHint } from "./free-slot-hint"
import type { Appointment, AppointmentStatus } from "@/types/appointment"

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
    employeeName: "Laura Vidal",
    serviceId: "svc_1",
    serviceName: "Corte y secado",
    servicePrice: 35,
    serviceDurationMinutes: 60,
    startTime: `${DAY}T09:00:00`,
    endTime: `${DAY}T10:00:00`,
    status: "CONFIRMED" as AppointmentStatus,
    source: "MANUAL",
    notes: null,
    reminderSent: false,
    createdAt: `${DAY}T08:00:00`,
    updatedAt: `${DAY}T08:00:00`,
    ...overrides,
  }
}

/**
 * `Intl.NumberFormat("es-ES", { currency: "EUR" })` separa la cifra del simbolo
 * con un espacio DURO (U+00A0), no con el espacio normal que se lee en el
 * artboard. Sin normalizar, `"35,00 €"` no encuentra nada y el test verde-falso
 * seria trivial de escribir con un `toContain("35,00")`.
 */
function normalize(value: string): string {
  return value.replace(/\u00a0/g, " ")
}

/** Coincidencia EXACTA con el texto de un nodo hoja, ya normalizado. */
function exact(expected: string) {
  return (content: string) => normalize(content) === expected
}

function block(): HTMLElement {
  return screen.getByTestId("appointment-block")
}

describe("AppointmentBlock · estados", () => {
  it("confirmada: fondo blanco, borde izquierdo verde y tres lineas", () => {
    render(
      <AppointmentBlock variant="desktop" appointment={makeAppointment()} />
    )

    const el = block()
    expect(el).toHaveClass("border-l-success", "border-border", "bg-card")
    expect(el).not.toHaveClass("bg-warning-soft")
    expect(el).not.toHaveClass("bg-destructive-tint")
    expect(el).not.toHaveClass("opacity-70")

    expect(screen.getByText("Carla Ruiz")).toBeInTheDocument()
    expect(screen.getByText("Corte y secado")).toBeInTheDocument()
    expect(screen.getByText(exact("09:00 - 10:00 · 35,00 €"))).toBeInTheDocument()

    // 09:00 -> 96px, 60min -> 92px con el canalon ya descontado.
    expect(el).toHaveStyle({ top: "96px", height: "92px" })
  })

  it("pendiente: borde ambar, fondo crema e insignia con los tokens del canvas", () => {
    render(
      <AppointmentBlock
        variant="desktop"
        appointment={makeAppointment({
          status: "PENDING",
          clientName: "Ana Garcia",
          serviceName: "Corte + Tinte",
          servicePrice: 65,
          startTime: `${DAY}T10:30:00`,
          endTime: `${DAY}T12:00:00`,
        })}
      />
    )

    const el = block()
    expect(el).toHaveClass("border-l-warning", "border-warning-border", "bg-warning-soft")
    expect(el).not.toHaveClass("bg-card")
    expect(el).not.toHaveClass("bg-destructive-tint")
    expect(el).not.toHaveClass("border-l-success")

    const badge = screen.getByTestId("appointment-block-badge")
    expect(badge).toHaveTextContent("Pendiente")
    expect(badge).toHaveClass("bg-status-pending-bg", "text-status-pending-text")

    expect(screen.getByText(exact("10:30 - 12:00 · 65,00 €"))).toBeInTheDocument()
  })

  it("completada: gris, atenuada y con el sufijo en la hora", () => {
    render(
      <AppointmentBlock
        variant="desktop"
        appointment={makeAppointment({
          status: "COMPLETED",
          clientName: "Nuria Camps",
          startTime: `${DAY}T08:00:00`,
          endTime: `${DAY}T08:45:00`,
        })}
      />
    )

    const el = block()
    expect(el).toHaveClass("border-l-muted-foreground-2", "border-border", "bg-card", "opacity-70")
    expect(el).not.toHaveClass("border-l-success")
    expect(el).not.toHaveClass("bg-warning-soft")

    expect(screen.getByText(exact("08:00 - 08:45 · Completada"))).toBeInTheDocument()
  })

  it("cancelada: borde y fondo rojos, y el nombre tambien en rojo", () => {
    render(
      <AppointmentBlock
        variant="desktop"
        appointment={makeAppointment({
          status: "CANCELLED",
          clientName: "Marta Vidal",
          startTime: `${DAY}T11:30:00`,
          endTime: `${DAY}T12:00:00`,
        })}
      />
    )

    const el = block()
    expect(el).toHaveClass(
      "border-l-destructive",
      "border-destructive-border",
      "bg-destructive-tint"
    )
    expect(el).not.toHaveClass("bg-warning-soft")
    expect(el).not.toHaveClass("bg-card")

    const name = screen.getByText("Marta Vidal")
    expect(name).toHaveClass("text-destructive")
    const time = screen.getByText(exact("11:30 - 12:00 · Cancelada"))
    expect(time).toHaveClass("text-destructive")
  })

  it("no asistio se pinta como cancelada, con su propia etiqueta (supuesto)", () => {
    render(
      <AppointmentBlock
        variant="desktop"
        appointment={makeAppointment({
          status: "NO_SHOW",
          startTime: `${DAY}T11:30:00`,
          endTime: `${DAY}T12:00:00`,
        })}
      />
    )

    const el = block()
    expect(el).toHaveClass("border-l-destructive", "bg-destructive-tint")
    expect(screen.getByText(exact("11:30 - 12:00 · No asistio"))).toBeInTheDocument()
  })

  it("en curso se pinta como confirmada (supuesto)", () => {
    render(
      <AppointmentBlock variant="desktop" appointment={makeAppointment({ status: "IN_PROGRESS" })} />
    )

    const el = block()
    expect(el).toHaveClass("border-l-success", "bg-card")
    expect(el).not.toHaveClass("bg-warning-soft")
    expect(el).not.toHaveClass("bg-destructive-tint")
    // Sigue siendo una cita viva: conserva servicio y precio.
    expect(screen.getByText("Corte y secado")).toBeInTheDocument()
    expect(screen.getByText(exact("09:00 - 10:00 · 35,00 €"))).toBeInTheDocument()
  })
})

describe("AppointmentBlock · umbral de la variante compacta", () => {
  it("30 minutos: dos lineas, sin servicio ni precio, y menos padding", () => {
    render(
      <AppointmentBlock
        variant="desktop"
        appointment={makeAppointment({
          clientName: "Jordi Mas",
          serviceDurationMinutes: 30,
          startTime: `${DAY}T14:00:00`,
          endTime: `${DAY}T14:30:00`,
        })}
      />
    )

    const el = block()
    expect(el).toHaveClass("py-1.5")
    expect(el).not.toHaveClass("py-2")
    expect(screen.getByText("Jordi Mas")).toBeInTheDocument()
    expect(screen.getByText(exact("14:00 - 14:30"))).toBeInTheDocument()
    expect(screen.queryByText("Corte y secado")).not.toBeInTheDocument()
    expect(normalize(el.textContent ?? "")).not.toContain("35,00")
  })

  it("60 minutos: tres lineas y el padding normal", () => {
    render(<AppointmentBlock variant="desktop" appointment={makeAppointment()} />)

    const el = block()
    expect(el).toHaveClass("py-2")
    expect(el).not.toHaveClass("py-1.5")
    expect(screen.getByText("Corte y secado")).toBeInTheDocument()
    expect(normalize(el.textContent ?? "")).toContain("35,00 €")
  })

  it("15 minutos: se queda en el suelo de 24px y no revienta", () => {
    render(
      <AppointmentBlock
        variant="desktop"
        appointment={makeAppointment({
          serviceDurationMinutes: 15,
          startTime: `${DAY}T09:00:00`,
          endTime: `${DAY}T09:15:00`,
        })}
      />
    )

    const el = block()
    expect(el).toHaveStyle({ height: "24px" })
    expect(el).toHaveClass("py-1.5")
    expect(screen.getByText(exact("09:00 - 09:15"))).toBeInTheDocument()
  })

  it("completada de 45 minutos: dos lineas pese al alto, sin servicio ni precio", () => {
    render(
      <AppointmentBlock
        variant="desktop"
        appointment={makeAppointment({
          status: "COMPLETED",
          serviceDurationMinutes: 45,
          startTime: `${DAY}T08:00:00`,
          endTime: `${DAY}T08:45:00`,
        })}
      />
    )

    const el = block()
    // 45min -> 68px: cabrian tres lineas. La regla es del estado, no del alto.
    expect(el).toHaveStyle({ height: "68px" })
    expect(el).toHaveClass("py-2")
    expect(screen.queryByText("Corte y secado")).not.toBeInTheDocument()
    expect(normalize(el.textContent ?? "")).not.toContain("35,00")
  })
})

describe("AppointmentBlock · los dos formatos de texto", () => {
  it("escritorio escribe el rango completo y el precio en la misma linea", () => {
    render(<AppointmentBlock variant="desktop" appointment={makeAppointment()} />)

    expect(screen.getByText(exact("Corte y secado"))).toBeInTheDocument()
    expect(screen.getByText(exact("09:00 - 10:00 · 35,00 €"))).toBeInTheDocument()
    expect(normalize(block().textContent ?? "")).not.toContain("60min")
  })

  it("movil mete la hora de inicio en la linea del servicio y la duracion en la tercera", () => {
    render(<AppointmentBlock variant="mobile" appointment={makeAppointment()} />)

    expect(screen.getByText(exact("Corte y secado · 09:00"))).toBeInTheDocument()
    expect(screen.getByText(exact("60min · 35,00 €"))).toBeInTheDocument()
    expect(normalize(block().textContent ?? "")).not.toContain("09:00 - 10:00")
  })

  it("el sangrado y el gap tambien cambian con la variante", () => {
    const { unmount } = render(
      <AppointmentBlock variant="mobile" appointment={makeAppointment()} />
    )
    expect(block()).toHaveStyle({ left: "4px", right: "4px" })
    expect(block()).toHaveClass("gap-[3px]")
    unmount()

    render(<AppointmentBlock variant="desktop" appointment={makeAppointment()} />)
    expect(block()).toHaveStyle({ left: "6px", right: "6px" })
    expect(block()).toHaveClass("gap-0.5")
  })
})

describe("AppointmentBlock · carriles y comportamiento", () => {
  it("con un solo carril ocupa el ancho util entero", () => {
    render(<AppointmentBlock variant="desktop" appointment={makeAppointment()} lane={0} lanes={1} />)

    const el = block()
    expect(el.style.left).toBe("6px")
    expect(el.style.right).toBe("6px")
    expect(el.style.width).toBe("")
  })

  it("con dos carriles el segundo arranca a media columna y mide la mitad", () => {
    render(<AppointmentBlock variant="desktop" appointment={makeAppointment()} lane={1} lanes={2} />)

    const el = block()
    /**
     * El componente escribe `calc(6px + 1 * (100% - 12px) / 2)`; jsdom (cssstyle)
     * reduce la multiplicacion por el numero de carriles y serializa el
     * equivalente `0.5 * (...)`. Se compara contra lo que sale del DOM, no
     * contra lo que se escribio: es la misma longitud.
     */
    expect(el.style.left).toBe("calc(6px + 0.5 * (100% - 12px))")
    expect(el.style.width).toBe("calc(0.5 * (100% - 12px))")
    expect(el.style.right).toBe("")
  })

  it("el style de quien llama se aplica por encima de la geometria calculada", () => {
    render(
      <AppointmentBlock
        variant="desktop"
        appointment={makeAppointment()}
        style={{ left: 20, zIndex: 5 }}
      />
    )

    expect(block()).toHaveStyle({ left: "20px", zIndex: "5", top: "96px" })
  })

  it("avisa con la cita al pulsarla", async () => {
    const onTap = vi.fn()
    const appointment = makeAppointment()
    render(<AppointmentBlock variant="desktop" appointment={appointment} onTap={onTap} />)

    await userEvent.click(block())

    expect(onTap).toHaveBeenCalledTimes(1)
    expect(onTap).toHaveBeenCalledWith(appointment)
  })

  it("no pinta nada si la cita cae fuera de la rejilla", () => {
    const { container } = render(
      <AppointmentBlock
        variant="desktop"
        appointment={makeAppointment({
          startTime: `${DAY}T21:00:00`,
          endTime: `${DAY}T22:00:00`,
        })}
      />
    )

    expect(container).toBeEmptyDOMElement()
  })
})

/**
 * `BreakBlock` y `FreeSlotHint` comparten fichero de prueba con la cita a
 * proposito: son las otras dos cajas de la misma tarea, de una decena de lineas
 * cada una, y se leen mejor al lado de la caja de la que se diferencian.
 */
describe("BreakBlock", () => {
  it("rayado, borde uniforme y SIN borde izquierdo de color", () => {
    render(<BreakBlock variant="desktop" top={480} height={92} label="13:00 - 14:00" />)

    const el = screen.getByTestId("break-block")
    expect(el).toHaveClass("border-hairline-strong")
    expect(el).not.toHaveClass("border-l-[3px]")
    expect(el).not.toHaveClass("border-l-success")
    expect(el.style.backgroundImage).toContain("repeating-linear-gradient(135deg")
    expect(el).toHaveStyle({ top: "480px", height: "92px", left: "6px", right: "6px" })

    expect(screen.getByText("Almuerzo")).toBeInTheDocument()
    expect(screen.getByText("13:00 - 14:00")).toBeInTheDocument()
  })

  it("en movil se sangra 4px y no es pulsable", () => {
    render(<BreakBlock variant="mobile" top={480} height={92} label="13:00 - 14:00" />)

    const el = screen.getByTestId("break-block")
    expect(el).toHaveStyle({ left: "4px", right: "4px" })
    expect(el.tagName).toBe("DIV")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})

describe("FreeSlotHint", () => {
  it("recuadro discontinuo de 44px que invita a crear la cita", async () => {
    const onTap = vi.fn()
    render(<FreeSlotHint top={384} onTap={onTap} />)

    const el = screen.getByTestId("free-slot-hint")
    expect(el).toHaveClass("border-dashed", "border-border-dashed", "bg-muted")
    expect(el).toHaveStyle({ top: "384px", height: "44px", left: "4px", right: "4px" })
    expect(screen.getByText("Libre · toca para crear")).toBeInTheDocument()

    await userEvent.click(el)
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it("acepta el alto que le pasa nextFreeSlot", () => {
    render(<FreeSlotHint top={0} height={92} />)

    expect(screen.getByTestId("free-slot-hint")).toHaveStyle({ height: "92px" })
  })
})
