import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import {
  EmployeeColumnHeader,
  employeeFallbackAvatarClassName,
  EMPLOYEE_HEADER_HEIGHT_PX,
} from "./employee-column-header"
import type { EmployeeColumn } from "@/lib/utils/calendar"
import type { Appointment, AppointmentStatus } from "@/types/appointment"
import type { Employee } from "@/types/employee"

const DAY = "2026-08-27"

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

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "apt_1",
    tenantId: "tenant_1",
    clientId: "cli_1",
    clientName: "Carla Ruiz",
    clientPhone: null,
    clientEmail: null,
    employeeId: "emp_1",
    employeeName: "Laura Martinez",
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

function makeColumn(
  employee: Employee | null,
  label = "Laura Martinez",
  appointments: Appointment[] = []
): EmployeeColumn {
  return {
    employeeId: employee?.id ?? null,
    label,
    employee,
    appointments,
  }
}

function avatar(): HTMLElement {
  return screen.getByTestId("employee-column-avatar")
}

/**
 * jsdom (cssstyle) NORMALIZA el color al asignarlo: el `#B4522F` + alfa "20"
 * que escribe el componente sale del DOM como `rgba(...)`, y el color pleno
 * como `rgb(...)`. Se compara contra lo que sale, no contra lo que se escribio.
 * El 0.125 es el 32/255 del sufijo "20": el 12,5% que documenta el componente.
 */
const TERRACOTTA = "#B4522F"
const TERRACOTTA_RGB = "rgb(180, 82, 47)"
const TERRACOTTA_RGBA_12 = "rgba(180, 82, 47, 0.125)"

/**
 * ---------------------------------------------------------------------------
 * El color del avatar
 * ---------------------------------------------------------------------------
 * Este es el agujero que la auditoria por mutacion encontro abierto: se puede
 * borrar el `style` que lleva el `colorHex` del empleado y la suite entera
 * sigue verde, porque la unica prueba que miraba este avatar
 * (`day-view.test.tsx`) comprueba que dice "LM". El defecto es de COLOR y la
 * asercion era de TEXTO: el avatar se queda en un circulo transparente con las
 * iniciales en negro y nadie se entera.
 */
describe("EmployeeColumnHeader · el avatar toma el color del empleado", () => {
  it("con colorHex: fondo al 12,5% y texto al color pleno, ademas de las iniciales", () => {
    render(<EmployeeColumnHeader column={makeColumn(makeEmployee())} index={0} />)

    const el = avatar()

    // Lo que ya se comprobaba y NO basta: el texto sobrevive a la mutacion.
    expect(el).toHaveTextContent("LM")

    // Lo que faltaba. `CalendarioDesktop.dc.html:107`: #F6E7E0 sobre #B4522F.
    expect(el.style.backgroundColor).toBe(TERRACOTTA_RGBA_12)
    expect(el.style.color).toBe(TERRACOTTA_RGB)
    expect(el.style.backgroundColor).not.toBe("")
    expect(el.style.color).not.toBe("")

    // Y con color propio no entra ni la paleta de reserva ni el gris de "Otros".
    expect(el).not.toHaveClass("bg-muted")
    expect(el).not.toHaveClass("text-muted-foreground-2")
    for (const className of employeeFallbackAvatarClassName(0).split(" ")) {
      expect(el).not.toHaveClass(className)
    }
  })

  it("cada empleado lleva SU color, no el del primero", () => {
    const { unmount } = render(
      <EmployeeColumnHeader
        column={makeColumn(makeEmployee({ colorHex: TERRACOTTA }))}
        index={0}
      />
    )
    expect(avatar().style.color).toBe(TERRACOTTA_RGB)
    unmount()

    render(
      <EmployeeColumnHeader
        column={makeColumn(
          makeEmployee({ id: "emp_2", firstName: "Sofia", lastName: "Puig", colorHex: "#5C7A5E" }),
          "Sofia Puig"
        )}
        index={1}
      />
    )
    // `CalendarioDesktop.dc.html:114`: #E8EEE7 sobre #5C7A5E.
    expect(avatar().style.color).toBe("rgb(92, 122, 94)")
    expect(avatar().style.backgroundColor).toBe("rgba(92, 122, 94, 0.125)")
    expect(avatar()).toHaveTextContent("SP")
  })

  it("sin colorHex tira de la paleta de reserva compartida", () => {
    render(
      <EmployeeColumnHeader column={makeColumn(makeEmployee({ colorHex: null }))} index={1} />
    )

    const el = avatar()
    for (const className of employeeFallbackAvatarClassName(1).split(" ")) {
      expect(el).toHaveClass(className)
    }
    expect(el).not.toHaveClass("bg-muted")
    // El color de reserva va en CLASES: sin `colorHex` no puede haber estilo en
    // linea, o pisaria a la paleta.
    expect(el.getAttribute("style")).toBeNull()
  })

  it("la reserva se reparte por POSICION: dos columnas contiguas no comparten color", () => {
    const { unmount } = render(
      <EmployeeColumnHeader column={makeColumn(makeEmployee({ colorHex: null }))} index={0} />
    )
    const first = avatar().className
    unmount()

    render(
      <EmployeeColumnHeader column={makeColumn(makeEmployee({ colorHex: null }))} index={1} />
    )
    expect(avatar().className).not.toBe(first)
  })

  it("el color de reserva se reparte por posicion y da la vuelta al agotarse", () => {
    const first = employeeFallbackAvatarClassName(0)
    expect(employeeFallbackAvatarClassName(1)).not.toBe(first)
    expect(employeeFallbackAvatarClassName(5)).toBe(first)
  })

  it("la columna 'Otros' lleva avatar NEUTRO: no es una persona", () => {
    render(<EmployeeColumnHeader column={makeColumn(null, "Otros")} index={0} />)

    const el = avatar()
    expect(el).toHaveClass("bg-muted", "text-muted-foreground-2")
    expect(el).toHaveTextContent("O")
    // Ni color propio ni paleta de reserva: sin empleado no hay de donde sacarlo.
    expect(el.getAttribute("style")).toBeNull()
    for (const className of employeeFallbackAvatarClassName(0).split(" ")) {
      expect(el).not.toHaveClass(className)
    }
    expect(screen.getByText("Otros")).toBeInTheDocument()
    expect(screen.getByTestId("employee-column-header")).not.toHaveAttribute("data-employee-id")
  })
})

/**
 * ---------------------------------------------------------------------------
 * La paleta de reserva, ANCLADA
 * ---------------------------------------------------------------------------
 * El resto de la suite usa `employeeFallbackAvatarClassName` como oraculo de
 * si misma: comprueba que la posicion 1 lleva "lo que devuelva la funcion para
 * la posicion 1". Eso fija el REPARTO -- que dos contiguos no repitan, que dé
 * la vuelta al quinto -- pero no el CONTENIDO: permutar dos entradas de la
 * tabla dejaba la suite entera verde, y el mismo empleado cambiaba de color
 * sin que nada avisase. Aqui se escriben los tokens a mano, uno por uno.
 */
describe("EmployeeColumnHeader · la paleta de reserva y sus tokens", () => {
  it("cada posicion apunta a su token, en orden y sin permutar", () => {
    expect(employeeFallbackAvatarClassName(0)).toBe("bg-chart-1/12 text-chart-1")
    expect(employeeFallbackAvatarClassName(1)).toBe("bg-chart-2/12 text-chart-2")
    expect(employeeFallbackAvatarClassName(2)).toBe("bg-chart-3/12 text-chart-3")
    expect(employeeFallbackAvatarClassName(3)).toBe("bg-chart-4/12 text-chart-4")
    expect(employeeFallbackAvatarClassName(4)).toBe("bg-chart-5/12 text-chart-5")
    // Y el sexto vuelve al primero, sin salirse de la tabla.
    expect(employeeFallbackAvatarClassName(5)).toBe("bg-chart-1/12 text-chart-1")
  })

  it("los cinco tokens existen en globals.css con el color del artboard", () => {
    // La clase sola no prueba nada si el token no esta declarado: en Tailwind
    // v4 una utilidad sin variable detras se descarta EN SILENCIO. Y el orden
    // es el del canvas: el segundo empleado del artboard movil (Sofia) lleva
    // #5C7A5E y el tercero (Marc) #4A6274 (`design/Calendario.dc.html:57,61`),
    // los mismos que la cabecera de escritorio (`CalendarioDesktop.dc.html:114,121`).
    // Por ruta desde la raiz del proyecto: bajo Vite `import.meta.url` no es
    // una URL `file:` y `readFileSync` la rechaza.
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8")

    for (const [token, hex] of [
      ["--chart-1", "#b4522f"],
      ["--chart-2", "#5c7a5e"],
      ["--chart-3", "#4a6274"],
      ["--chart-4", "#a8762f"],
      ["--chart-5", "#7a6a5f"],
    ] as const) {
      expect(css).toContain(`${token}: ${hex};`)
    }
  })

  it("la segunda columna se pinta con el segundo token, no con otro", () => {
    render(
      <EmployeeColumnHeader
        column={makeColumn(
          makeEmployee({ id: "emp_2", firstName: "Sofia", lastName: "Puig", colorHex: null }),
          "Sofia Puig"
        )}
        index={1}
      />
    )

    expect(avatar()).toHaveClass("bg-chart-2/12", "text-chart-2")
    expect(avatar()).not.toHaveClass("bg-chart-1/12")
    expect(avatar()).not.toHaveClass("text-chart-1")
  })

  it("la primera columna se pinta con el primer token", () => {
    render(
      <EmployeeColumnHeader column={makeColumn(makeEmployee({ colorHex: null }))} index={0} />
    )

    expect(avatar()).toHaveClass("bg-chart-1/12", "text-chart-1")
    expect(avatar()).not.toHaveClass("bg-chart-2/12")
  })
})

describe("EmployeeColumnHeader · el resumen del dia", () => {
  it("cuenta las citas y suma sus minutos", () => {
    render(
      <EmployeeColumnHeader
        column={makeColumn(makeEmployee(), "Laura Martinez", [
          makeAppointment({ startTime: `${DAY}T09:00:00`, endTime: `${DAY}T10:00:00` }),
          makeAppointment({ id: "apt_2", startTime: `${DAY}T10:30:00`, endTime: `${DAY}T12:00:00` }),
          makeAppointment({ id: "apt_3", startTime: `${DAY}T14:00:00`, endTime: `${DAY}T14:30:00` }),
        ])}
        index={0}
      />
    )

    // 60 + 90 + 30 = 180min -> "3h". `CalendarioDesktop.dc.html:110`.
    expect(screen.getByText("3 citas · 3h")).toBeInTheDocument()
  })

  it("una sola cita va en singular", () => {
    render(
      <EmployeeColumnHeader
        column={makeColumn(makeEmployee(), "Laura Martinez", [makeAppointment()])}
        index={0}
      />
    )

    expect(screen.getByText("1 cita · 1h")).toBeInTheDocument()
    expect(screen.queryByText(/citas/)).not.toBeInTheDocument()
  })

  it("la columna vacia dice 'Sin citas', no se queda en blanco", () => {
    render(<EmployeeColumnHeader column={makeColumn(makeEmployee())} index={0} />)

    expect(screen.getByText("Sin citas")).toBeInTheDocument()
  })

  it("cuenta tambien las canceladas: el resumen del artboard solo cuadra asi", () => {
    render(
      <EmployeeColumnHeader
        column={makeColumn(makeEmployee(), "Marc Oliva", [
          makeAppointment({ startTime: `${DAY}T09:30:00`, endTime: `${DAY}T10:00:00` }),
          makeAppointment({
            id: "apt_2",
            status: "CANCELLED" as AppointmentStatus,
            startTime: `${DAY}T11:30:00`,
            endTime: `${DAY}T12:00:00`,
          }),
          makeAppointment({ id: "apt_3", startTime: `${DAY}T13:00:00`, endTime: `${DAY}T14:30:00` }),
        ])}
        index={2}
      />
    )

    // 30 + 30 (cancelada) + 90 = 150min. Sin la cancelada saldria "2 citas · 2h".
    expect(screen.getByText("3 citas · 2h 30min")).toBeInTheDocument()
  })
})

describe("EmployeeColumnHeader · la tarjeta que dibuja el artboard", () => {
  it("60px de alto, avatar circular de 30px y las dos lineas de texto", () => {
    render(<EmployeeColumnHeader column={makeColumn(makeEmployee())} index={0} />)

    // `CalendarioDesktop.dc.html:106`. El alto se exporta porque `day-view.tsx`
    // reserva el mismo hueco en el canal de horas.
    expect(EMPLOYEE_HEADER_HEIGHT_PX).toBe(60)
    const header = screen.getByTestId("employee-column-header")
    expect(header).toHaveStyle({ height: "60px" })
    expect(header).toHaveClass("flex", "items-center", "gap-2.5", "px-3")
    expect(header).toHaveAttribute("data-employee-id", "emp_1")

    // `CalendarioDesktop.dc.html:107`: 30px, 999px de radio, 11px/700.
    expect(avatar()).toHaveClass(
      "size-[30px]",
      "shrink-0",
      "rounded-full",
      "text-[11px]",
      "font-bold"
    )
    expect(avatar()).toHaveAttribute("aria-hidden", "true")

    // `CalendarioDesktop.dc.html:109-110`: 14px/600 y 11px en `--muted-foreground-2`.
    const name = screen.getByText("Laura Martinez")
    expect(name).toHaveClass("text-[14px]", "font-semibold", "truncate")
    expect(name).not.toHaveClass("text-muted-foreground-2")

    // `truncate` no recorta nada dentro de un flex sin `min-w-0`: el nombre
    // largo desbordaria la columna en vez de cortarse con puntos suspensivos.
    expect(name.parentElement).toHaveClass("min-w-0", "flex", "flex-col")

    const summary = screen.getByText("Sin citas")
    expect(summary).toHaveClass("text-[11px]", "text-muted-foreground-2", "truncate")
    expect(summary).not.toHaveClass("text-[14px]")
    expect(summary).not.toHaveClass("font-semibold")
  })

  it("nombre y resumen llevan leading propio", () => {
    render(<EmployeeColumnHeader column={makeColumn(makeEmployee())} index={0} />)

    /**
     * El artboard no declara `line-height` (vale `normal`, ~1,25); la preflight
     * de Tailwind impone 1.5 a todo el documento. Con el 1.5 heredado la pareja
     * nombre + resumen mide 37,5px en vez de los 31,25px dibujados dentro de
     * una tarjeta de 60px.
     *
     * OJO: tailwind-merge trata el tamano de fuente como conflictivo con el
     * `leading` (por la forma `text-sm/6`), asi que un `leading-*` escrito ANTES
     * de un `text-[Npx]` en el mismo `cn()` se borra EN SILENCIO. Por eso se
     * comprueba la clase en el DOM ya resuelto, no en el fuente.
     */
    for (const line of [screen.getByText("Laura Martinez"), screen.getByText(/Sin citas/)]) {
      expect(line).toHaveClass("leading-tight")
      // Ni el 1.2 del nombre de la caja de cita ni el `normal` explicito: el
      // valor tiene que ser el de la tarjeta, no otro leading cualquiera.
      expect(line).not.toHaveClass("leading-[1.2]")
      expect(line).not.toHaveClass("leading-normal")
    }
  })

  it("acepta className de quien la monta sin perder lo suyo", () => {
    render(
      <EmployeeColumnHeader
        column={makeColumn(makeEmployee())}
        index={0}
        className="border-b border-hairline"
      />
    )

    const header = screen.getByTestId("employee-column-header")
    expect(header).toHaveClass("border-b", "border-hairline", "flex", "items-center")
  })
})
