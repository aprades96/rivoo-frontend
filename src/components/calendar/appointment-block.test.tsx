import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AppointmentBlock } from "./appointment-block"
import { BreakBlock } from "./break-block"
import { FreeSlotHint } from "./free-slot-hint"
import {
  EmployeeColumnHeader,
  employeeFallbackAvatarClassName,
} from "./employee-column-header"
import { EmployeeFilter } from "./employee-filter"
import type { EmployeeColumn } from "@/lib/utils/calendar"
import type { Appointment, AppointmentStatus } from "@/types/appointment"
import type { Employee } from "@/types/employee"

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

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp_1",
    firstName: "Laura",
    lastName: "Martinez",
    email: "laura@bellavista.test",
    phone: null,
    jobTitle: null,
    colorHex: "#B4522F",
    isActive: true,
    createdAt: `${DAY}T08:00:00`,
    ...overrides,
  }
}

/**
 * ---------------------------------------------------------------------------
 * El leading que el artboard no declara
 * ---------------------------------------------------------------------------
 * Ninguna linea de las cajas de la agenda declara `line-height` en el canvas,
 * asi que todas valen `normal` (~1,25 en Schibsted Grotesk); la preflight de
 * Tailwind, en cambio, impone `line-height: 1.5` a todo el documento
 * (`html,:host`). La diferencia no se ve leyendo el DOM, se ve SUMANDO, asi
 * que estas pruebas reconstruyen la altura del contenido a partir de las
 * clases y la comparan con el alto que dibuja el artboard. jsdom no maqueta:
 * la aritmetica la hace el test.
 */

/** Lo que vale cada clase de leading. Sin ninguna manda el 1.5 de la preflight. */
const LEADING_FACTORS: Record<string, number> = {
  "leading-tight": 1.25,
  "leading-[1.2]": 1.2,
}
const INHERITED_LEADING = 1.5

/** `py-1.5` y `py-2` del bloque, en px por lado. */
const PADDING_Y_PX: Record<string, number> = { "py-1.5": 6, "py-2": 8 }
/** `gap-0.5` (escritorio) y `gap-[3px]` (movil), en px. */
const GAP_PX: Record<string, number> = { "gap-0.5": 2, "gap-[3px]": 3 }

function lookup(el: Element, table: Record<string, number>): number | undefined {
  for (const className of Array.from(el.classList)) {
    if (className in table) return table[className]
  }
  return undefined
}

function leadingOf(el: Element): number {
  return lookup(el, LEADING_FACTORS) ?? INHERITED_LEADING
}

/** El tamano en px que declara la clase `text-[Npx]` del nodo. */
function fontSizeOf(el: Element): number {
  for (const className of Array.from(el.classList)) {
    const match = /^text-\[(\d+)px\]$/.exec(className)
    if (match) return Number(match[1])
  }
  throw new Error(`sin clase text-[Npx]: "${el.className}"`)
}

/** El alto de la caja de linea: tamano de fuente x leading. */
function lineBox(el: Element): number {
  return fontSizeOf(el) * leadingOf(el)
}

/** Padding + lineas + gaps: el alto que ocupa el contenido del bloque. */
function contentHeight(container: HTMLElement, lines: Element[]): number {
  const padding = lookup(container, PADDING_Y_PX)
  const gap = lookup(container, GAP_PX)
  if (padding === undefined) throw new Error(`sin padding vertical: "${container.className}"`)
  if (gap === undefined) throw new Error(`sin gap: "${container.className}"`)

  const text = lines.reduce((total, line) => total + lineBox(line), 0)
  return padding * 2 + text + gap * (lines.length - 1)
}

describe("AppointmentBlock · el leading que el artboard no declara", () => {
  it("compacta de escritorio: el contenido cabe EXACTO en los 44px del canvas", () => {
    render(
      <AppointmentBlock
        variant="desktop"
        appointment={makeAppointment({
          clientName: "Jordi Mas",
          startTime: `${DAY}T14:00:00`,
          endTime: `${DAY}T14:30:00`,
        })}
      />
    )

    const el = block()
    const name = screen.getByText("Jordi Mas")
    const time = screen.getByText(exact("14:00 - 14:30"))

    // Las dos lineas llevan leading propio: ninguna hereda el 1.5.
    expect(leadingOf(name)).toBe(1.25)
    expect(leadingOf(time)).toBe(1.25)

    // 6 + 13x1,25 (16,25) + 2 + 11x1,25 (13,75) + 6 = 44,00
    // (`design/CalendarioDesktop.dc.html:204`). Con el 1.5 heredado en la hora
    // saldrian 46,75px dentro de una caja de 44px con `overflow: hidden`.
    expect(contentHeight(el, [name, time])).toBeCloseTo(44, 5)
    expect(el).toHaveStyle({ height: "44px" })
  })

  it("tres lineas de escritorio: la columna de texto mide los 65px dibujados", () => {
    render(<AppointmentBlock variant="desktop" appointment={makeAppointment()} />)

    const el = block()
    const name = screen.getByText("Carla Ruiz")
    const service = screen.getByText(exact("Corte y secado"))
    const time = screen.getByText(exact("09:00 - 10:00 · 35,00 €"))

    expect(leadingOf(service)).toBe(1.25)
    expect(leadingOf(time)).toBe(1.25)

    // 8 + 16,25 + 2 + 12x1,25 (15) + 2 + 13,75 + 8 = 65,00
    // (`design/CalendarioDesktop.dc.html:164-165`). Heredando el 1.5 en
    // servicio y hora saldrian 70,75px y las dos lineas caerian mas abajo.
    expect(contentHeight(el, [name, service, time])).toBeCloseTo(65, 5)
    expect(el).toHaveStyle({ height: "92px" })
  })

  it("tres lineas de movil: el nombre conserva su 1.2 declarado y el resto va a 1.25", () => {
    render(<AppointmentBlock variant="mobile" appointment={makeAppointment()} />)

    const el = block()
    const name = screen.getByText("Carla Ruiz")
    const service = screen.getByText(exact("Corte y secado · 09:00"))
    const time = screen.getByText(exact("60min · 35,00 €"))

    // `design/Calendario.dc.html:98` SI declara `line-height: 1.2` en el nombre.
    expect(leadingOf(name)).toBe(1.2)
    expect(leadingOf(service)).toBe(1.25)
    expect(leadingOf(time)).toBe(1.25)

    // 8 + 13x1,2 (15,6) + 3 + 13,75 + 3 + 13,75 + 8 = 65,10, dentro de los 92px.
    expect(contentHeight(el, [name, service, time])).toBeCloseTo(65.1, 5)
  })
})

describe("BreakBlock · el leading que el artboard no declara", () => {
  it("titulo y rango llevan leading propio", () => {
    render(<BreakBlock variant="desktop" top={480} height={92} label="13:00 - 14:00" />)

    expect(leadingOf(screen.getByText("Almuerzo"))).toBe(1.25)
    expect(leadingOf(screen.getByText("13:00 - 14:00"))).toBe(1.25)
  })
})

describe("FreeSlotHint · el leading que el artboard no declara", () => {
  it("la unica linea lleva leading propio", () => {
    render(<FreeSlotHint top={384} />)

    expect(leadingOf(screen.getByText("Libre · toca para crear"))).toBe(1.25)
  })
})

/**
 * ---------------------------------------------------------------------------
 * La cabecera de columna y el filtro de pildoras
 * ---------------------------------------------------------------------------
 * Comparten fichero con los bloques porque pintan el MISMO elemento del canvas
 * -- el avatar de color del empleado -- a los dos anchos, y la unica forma de
 * fijar que no vuelvan a separarse es compararlos en la misma prueba.
 */
function makeColumn(employee: Employee | null, label = "Laura Martinez"): EmployeeColumn {
  return {
    employeeId: employee?.id ?? null,
    label,
    employee,
    appointments: [],
  }
}

describe("EmployeeColumnHeader", () => {
  it("nombre y resumen llevan leading propio", () => {
    render(<EmployeeColumnHeader column={makeColumn(makeEmployee())} index={0} />)

    expect(leadingOf(screen.getByText("Laura Martinez"))).toBe(1.25)
    expect(leadingOf(screen.getByText(/citas/))).toBe(1.25)
  })

  it("sin colorHex tira de la paleta de reserva compartida", () => {
    render(
      <EmployeeColumnHeader column={makeColumn(makeEmployee({ colorHex: null }))} index={1} />
    )

    const avatar = screen.getByTestId("employee-column-avatar")
    for (const className of employeeFallbackAvatarClassName(1).split(" ")) {
      expect(avatar).toHaveClass(className)
    }
    expect(avatar).not.toHaveClass("bg-muted")
  })
})

describe("EmployeeFilter", () => {
  const employees = [
    makeEmployee({ id: "emp_1", firstName: "Laura", lastName: "Martinez", colorHex: null }),
    makeEmployee({ id: "emp_2", firstName: "Sofia", lastName: "Puig", colorHex: null }),
  ]

  function pill(name: string): HTMLElement {
    return screen.getByRole("button", { name: new RegExp(name) })
  }

  it("la pildora en reposo es BLANCA, no del color de la pagina", () => {
    render(<EmployeeFilter employees={employees} selectedId={null} onSelect={vi.fn()} />)

    // `Calendario.dc.html:51,56,60`: background #FFFFFF sobre una hoja #FBF7F2.
    // `bg-background` ES el #FBF7F2 de la hoja: la pildora se volvia invisible.
    const idle = pill("Laura")
    expect(idle).toHaveClass("bg-card")
    expect(idle).not.toHaveClass("bg-background")

    // La seleccionada sigue siendo la teja de marca, no la blanca.
    const selected = pill("Todos")
    expect(selected).toHaveClass("bg-primary")
    expect(selected).not.toHaveClass("bg-card")
  })

  it("el avatar de la pildora no lleva el aro de la primitiva", () => {
    const { container } = render(
      <EmployeeFilter employees={employees} selectedId={null} onSelect={vi.fn()} />
    )

    // `ui/avatar.tsx` pinta un `after:border after:border-border` permanente; el
    // artboard dibuja estos avatares de 24px sin borde (`Calendario.dc.html:53`).
    const avatars = container.querySelectorAll("[data-slot=avatar]")
    expect(avatars).toHaveLength(2)
    for (const avatar of Array.from(avatars)) {
      expect(avatar).toHaveClass("after:hidden")
    }
  })

  it("un empleado sin colorHex se colorea con la MISMA paleta que en escritorio", () => {
    const { container } = render(
      <EmployeeFilter employees={employees} selectedId={null} onSelect={vi.fn()} />
    )

    const fallbacks = container.querySelectorAll("[data-slot=avatar-fallback]")
    expect(fallbacks).toHaveLength(2)

    fallbacks.forEach((fallback, index) => {
      for (const className of employeeFallbackAvatarClassName(index).split(" ")) {
        expect(fallback).toHaveClass(className)
      }
      // Sin reserva mandaba el gris por defecto de `AvatarFallback`.
      expect(fallback).not.toHaveClass("bg-muted")
      expect(fallback).not.toHaveClass("text-muted-foreground")
    })
  })

  it("la pildora seleccionada manda sobre la paleta de reserva", () => {
    const { container } = render(
      <EmployeeFilter employees={employees} selectedId="emp_1" onSelect={vi.fn()} />
    )

    const fallback = container.querySelectorAll("[data-slot=avatar-fallback]")[0]
    expect(fallback).toHaveClass("bg-white/22", "text-primary-foreground")
    expect(fallback).not.toHaveClass("bg-chart-1/12")
  })

  it("el color de reserva se reparte por posicion y da la vuelta al agotarse", () => {
    const first = employeeFallbackAvatarClassName(0)
    expect(employeeFallbackAvatarClassName(1)).not.toBe(first)
    expect(employeeFallbackAvatarClassName(5)).toBe(first)
  })
})
