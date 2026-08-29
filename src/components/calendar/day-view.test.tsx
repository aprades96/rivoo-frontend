import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DayView } from "./day-view"
import {
  groupByEmployee,
  SLOT_HEIGHT_PX,
  type EmployeeColumn,
  type FreeSlot,
} from "@/lib/utils/calendar"
import type { Appointment } from "@/types/appointment"
import type { Employee } from "@/types/employee"

const DAY = "2026-08-27"

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp_1",
    firstName: "Laura",
    lastName: "Martinez",
    email: "laura@salon.test",
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
    status: "CONFIRMED",
    source: "MANUAL",
    notes: null,
    reminderSent: false,
    createdAt: `${DAY}T08:00:00`,
    updatedAt: `${DAY}T08:00:00`,
    ...overrides,
  }
}

/**
 * Las tres columnas del artboard de escritorio. Marc Oliva se queda SIN citas
 * a proposito: `CalendarioDesktop.dc.html` dibuja igualmente su columna.
 */
const EMPLOYEES: Employee[] = [
  makeEmployee(),
  makeEmployee({ id: "emp_2", firstName: "Sofia", lastName: "Puig", colorHex: null }),
  makeEmployee({ id: "emp_3", firstName: "Marc", lastName: "Oliva", colorHex: null }),
]

const APPOINTMENTS: Appointment[] = [
  makeAppointment(),
  makeAppointment({
    id: "apt_2",
    employeeId: "emp_2",
    employeeName: "Sofia Puig",
    clientName: "Ana Garcia",
    startTime: `${DAY}T10:30:00`,
    endTime: `${DAY}T12:00:00`,
  }),
]

/** El "Almuerzo" del artboard: 13:00-14:00 -> top 480, alto 92. */
const LUNCH = {
  top: 480,
  height: 92,
  start: "13:00",
  end: "14:00",
  label: "13:00 - 14:00",
}

/** El recuadro "Libre" del artboard movil (`Calendario.dc.html:112`). */
const FREE_SLOT: FreeSlot = {
  startTime: `${DAY}T12:00:00`,
  endTime: `${DAY}T12:30:00`,
  top: 384,
  height: 44,
}

function columnsOf(
  appointments: Appointment[] = APPOINTMENTS,
  employees: Employee[] = EMPLOYEES
): EmployeeColumn[] {
  return groupByEmployee(appointments, employees)
}

function columnOf(employeeId: string): HTMLElement {
  const column = document.querySelector<HTMLElement>(
    `[data-testid="day-view-column"][data-employee-id="${employeeId}"]`
  )
  if (!column) throw new Error(`No hay columna para ${employeeId}`)
  return column
}

describe("DayView · escritorio", () => {
  it("pinta una cabecera y una columna por empleado, incluida la del que no tiene citas", () => {
    render(<DayView variant="desktop" columns={columnsOf()} />)

    const headers = screen.getAllByTestId("employee-column-header")
    expect(headers).toHaveLength(3)
    expect(headers.map((header) => header.dataset.employeeId)).toEqual([
      "emp_1",
      "emp_2",
      "emp_3",
    ])
    expect(screen.getByText("Laura Martinez")).toBeInTheDocument()
    expect(screen.getByText("Sofia Puig")).toBeInTheDocument()
    expect(screen.getByText("Marc Oliva")).toBeInTheDocument()

    expect(screen.getAllByTestId("day-view-column")).toHaveLength(3)

    // La columna de Marc existe y esta vacia: es el caso que el artboard
    // dibuja y el que se pierde en cuanto alguien filtra las columnas sin
    // citas.
    const empty = columnOf("emp_3")
    expect(within(empty).queryAllByTestId("appointment-block")).toHaveLength(0)
    expect(within(headers[2]).getByText("Sin citas")).toBeInTheDocument()

    // Y las que si tienen citas las pintan en la suya, no en la del vecino.
    expect(within(columnOf("emp_1")).getByText("Carla Ruiz")).toBeInTheDocument()
    expect(within(columnOf("emp_2")).getByText("Ana Garcia")).toBeInTheDocument()
  })

  it("la cabecera resume el dia del empleado y lleva sus iniciales", () => {
    render(<DayView variant="desktop" columns={columnsOf()} />)

    const header = screen.getAllByTestId("employee-column-header")[0]
    expect(within(header).getByText("1 cita · 1h")).toBeInTheDocument()
    expect(within(header).getByTestId("employee-column-avatar")).toHaveTextContent("LM")
  })

  it("encabeza tambien la columna 'Otros' de las citas huerfanas", () => {
    const orphan = makeAppointment({
      id: "apt_orphan",
      employeeId: "emp_baja",
      employeeName: "Nuria Vila",
      clientName: "Pau Serra",
    })

    render(<DayView variant="desktop" columns={columnsOf([...APPOINTMENTS, orphan])} />)

    const headers = screen.getAllByTestId("employee-column-header")
    expect(headers).toHaveLength(4)
    expect(within(headers[3]).getByText("Otros")).toBeInTheDocument()
    expect(screen.getAllByTestId("day-view-column")).toHaveLength(4)
    expect(screen.getByText("Pau Serra")).toBeInTheDocument()
  })

  it("no pinta el recuadro de hueco libre: el artboard de escritorio no lo dibuja", () => {
    render(<DayView variant="desktop" columns={columnsOf()} freeSlot={FREE_SLOT} />)

    expect(screen.queryByTestId("free-slot-hint")).not.toBeInTheDocument()
  })
})

describe("DayView · movil", () => {
  it("pinta una sola columna, sin ninguna cabecera, con las citas de todos", () => {
    render(<DayView variant="mobile" columns={columnsOf()} />)

    expect(screen.queryAllByTestId("employee-column-header")).toHaveLength(0)
    expect(screen.getAllByTestId("day-view-column")).toHaveLength(1)
    expect(screen.getAllByTestId("appointment-block")).toHaveLength(2)
    expect(screen.getByText("Carla Ruiz")).toBeInTheDocument()
    expect(screen.getByText("Ana Garcia")).toBeInTheDocument()
  })

  it("pinta el hueco libre y lo devuelve al pulsarlo", async () => {
    const onFreeSlotTap = vi.fn()
    render(
      <DayView
        variant="mobile"
        columns={columnsOf()}
        freeSlot={FREE_SLOT}
        onFreeSlotTap={onFreeSlotTap}
      />
    )

    const hint = screen.getByTestId("free-slot-hint")
    expect(hint).toHaveStyle({ top: "384px", height: "44px" })

    await userEvent.click(hint)
    expect(onFreeSlotTap).toHaveBeenCalledWith(FREE_SLOT)
  })

  it("sin hueco libre no hay recuadro", () => {
    render(<DayView variant="mobile" columns={columnsOf()} freeSlot={null} />)

    expect(screen.queryByTestId("free-slot-hint")).not.toBeInTheDocument()
  })

  it("reparte en carriles las citas solapadas de empleados distintos", () => {
    const overlapping: Appointment[] = [
      makeAppointment({ id: "apt_a", startTime: `${DAY}T09:00:00`, endTime: `${DAY}T10:00:00` }),
      makeAppointment({
        id: "apt_b",
        employeeId: "emp_2",
        clientName: "Ana Garcia",
        startTime: `${DAY}T09:30:00`,
        endTime: `${DAY}T10:30:00`,
      }),
    ]

    render(<DayView variant="mobile" columns={columnsOf(overlapping)} />)

    const [first, second] = screen.getAllByTestId("appointment-block")
    // Con `lanes = 2` cada bloque toma medio ancho y arranca en un `left`
    // distinto; sin carriles los dos se pintarian con el mismo inset y uno
    // taparia al otro.
    expect(first.style.width).not.toBe("")
    expect(second.style.width).not.toBe("")
    expect(first.style.left).not.toBe(second.style.left)
  })
})

describe("DayView · descanso", () => {
  it("solo lo pinta en la columna del empleado que lo tiene", () => {
    render(<DayView variant="desktop" columns={columnsOf()} breaks={{ emp_1: LUNCH }} />)

    const breaks = screen.getAllByTestId("break-block")
    expect(breaks).toHaveLength(1)
    expect(breaks[0].closest('[data-testid="day-view-column"]')).toBe(columnOf("emp_1"))

    expect(within(columnOf("emp_2")).queryByTestId("break-block")).not.toBeInTheDocument()
    expect(within(columnOf("emp_3")).queryByTestId("break-block")).not.toBeInTheDocument()
  })

  it("en movil sale una sola caja aunque toda la plantilla comparta descanso", () => {
    render(
      <DayView
        variant="mobile"
        columns={columnsOf()}
        breaks={{ emp_1: LUNCH, emp_2: LUNCH, emp_3: LUNCH }}
      />
    )

    expect(screen.getAllByTestId("break-block")).toHaveLength(1)
    expect(screen.getByText("13:00 - 14:00")).toBeInTheDocument()
  })
})

describe("DayView · alto, scroll y alineacion de cabeceras", () => {
  it("hace scroll dentro de si mismo, sin altura calculada contra el viewport", () => {
    render(<DayView variant="desktop" columns={columnsOf()} />)

    const scroller = screen.getByTestId("day-view")
    expect(scroller.className).toContain("overflow-y-auto")
    expect(scroller.className).toContain("flex-1")
    expect(scroller.className).toContain("min-h-0")
    // El `h-[calc(100vh-16rem)]` que habia aqui es justo la deuda que cierra
    // esta vista: la cadena de alturas la sirve el layout, no un calculo
    // contra el viewport.
    expect(scroller.className).not.toContain("calc(")
    expect(scroller.style.height).toBe("")
  })

  /**
   * La decision sobre la barra de scroll: la fila de cabeceras vive DENTRO
   * del contenedor que hace scroll y comparte con las columnas UNA SOLA
   * cuadricula CSS. Asi el ancho de la barra -- que siempre esta, porque la
   * rejilla mide 1248px -- se descuenta una vez y afecta por igual a las dos
   * filas. Este test fija esa decision: si alguien saca las cabeceras fuera
   * del scroller o les da su propia cuadricula, se pone rojo.
   */
  it("cabeceras y columnas comparten scroller y cuadricula", () => {
    render(<DayView variant="desktop" columns={columnsOf()} />)

    const scroller = screen.getByTestId("day-view")
    const headers = screen.getAllByTestId("employee-column-header")
    const columns = screen.getAllByTestId("day-view-column")

    for (const header of headers) expect(scroller.contains(header)).toBe(true)

    const grid = screen.getByTestId("day-view-grid")
    for (const header of headers) expect(header.parentElement).toBe(grid)
    for (const column of columns) expect(column.parentElement).toBe(grid)

    // Una sola plantilla de columnas para las dos filas.
    expect(grid.style.gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))")

    // Y dentro del scroller las cabeceras se quedan arriba al bajar.
    for (const header of headers) {
      expect(header.className).toContain("sticky")
      expect(header.className).toContain("top-0")
    }
  })

  it("el canal de horas reserva el alto exacto de la cabecera en escritorio", () => {
    // Sin ese espaciador el 08:00 del canal arranca 60px por encima del 08:00
    // de las columnas y TODA la rejilla queda desfasada media hora larga: la
    // alineacion que el docblock de la vista defiende en veinte lineas.
    render(<DayView variant="desktop" columns={columnsOf()} />)

    const spacer = screen.getByTestId("time-channel-spacer")
    const header = screen.getAllByTestId("employee-column-header")[0]

    expect(spacer.style.height).toBe(header.style.height)
    expect(spacer.style.height).not.toBe("")
    // Tambien `sticky`, o al bajar asomaria por debajo de las cabeceras.
    expect(spacer.className).toContain("sticky")
  })

  it("en movil no hay cabeceras, asi que tampoco espaciador", () => {
    render(<DayView variant="mobile" columns={columnsOf()} />)

    expect(screen.queryByTestId("time-channel-spacer")).not.toBeInTheDocument()
  })
})

describe("DayView · orden de apilado", () => {
  it("apila franjas, descanso, bloques y hueco libre en ese orden", () => {
    // Son todos hermanos ABSOLUTOS dentro de la misma rejilla, asi que el
    // ultimo del DOM queda encima. Las franjas pulsables abajo del todo, para
    // que ninguna tape a un bloque; el hueco libre arriba del todo, que es el
    // que invita a actuar. En jsdom no hay pintado, pero el orden del DOM si
    // es asertable -- y es exactamente lo que decide quien tapa a quien.
    render(
      <DayView
        variant="mobile"
        columns={columnsOf()}
        breaks={{ emp_1: LUNCH }}
        freeSlot={FREE_SLOT}
        onSlotTap={vi.fn()}
      />
    )

    const slotLayer = screen.getAllByTestId("slot-target")[0].parentElement!
    const lunch = screen.getByTestId("break-block")
    const block = screen.getAllByTestId("appointment-block")[0]
    const hint = screen.getByTestId("free-slot-hint")

    const siblings = Array.from(slotLayer.parentElement!.children)
    const at = (element: Element) => siblings.indexOf(element)

    expect(at(slotLayer)).toBeGreaterThanOrEqual(0)
    expect(at(slotLayer)).toBeLessThan(at(lunch))
    expect(at(lunch)).toBeLessThan(at(block))
    expect(at(block)).toBeLessThan(at(hint))
  })
})

describe("DayView · pulsar la rejilla", () => {
  it("devuelve el empleado y la hora de la franja pulsada", async () => {
    const onSlotTap = vi.fn()
    render(<DayView variant="desktop" columns={columnsOf()} onSlotTap={onSlotTap} />)

    const target = within(columnOf("emp_2")).getAllByTestId("slot-target")[2]
    expect(target.dataset.time).toBe("09:00")

    await userEvent.click(target)
    expect(onSlotTap).toHaveBeenCalledExactlyOnceWith("emp_2", "09:00")
  })

  it("en movil con una sola columna la franja lleva su empleado", async () => {
    // El caso que el filtro de pildoras produce a diario: elegida Sofia, la
    // pantalla deja una sola columna y el alta tiene que heredar SU id. El
    // otro test de franjas corre en escritorio, que es donde esta logica no
    // aplica -- alli cada columna trae el suyo por construccion.
    const onSlotTap = vi.fn()
    const only = columnsOf().filter((column) => column.employeeId === "emp_2")
    render(<DayView variant="mobile" columns={only} onSlotTap={onSlotTap} />)

    const target = screen.getAllByTestId("slot-target")[2]
    expect(target.dataset.time).toBe("09:00")

    await userEvent.click(target)
    expect(onSlotTap).toHaveBeenCalledExactlyOnceWith("emp_2", "09:00")
  })

  it("en movil con el filtro en 'Todos' la franja no atribuye empleado", async () => {
    // Tres columnas fundidas en una: no hay un empleado al que atribuir la
    // franja, y adivinarlo seria peor que dejarlo abierto.
    const onSlotTap = vi.fn()
    render(<DayView variant="mobile" columns={columnsOf()} onSlotTap={onSlotTap} />)

    await userEvent.click(screen.getAllByTestId("slot-target")[2])
    expect(onSlotTap).toHaveBeenCalledExactlyOnceWith(null, "09:00")
  })

  it("cada franja mide un slot entero, o pulsar la tarde apuntaria a otra hora", async () => {
    // El alto es lo que hace que la franja de las 17:00 caiga sobre las 17:00.
    // Con la mitad, las 26 franjas cubririan medio dia y el resto quedaria
    // muerto: el test solo miraba `data-time`, que no se entera.
    const onSlotTap = vi.fn()
    render(<DayView variant="desktop" columns={columnsOf()} onSlotTap={onSlotTap} />)

    const targets = within(columnOf("emp_1")).getAllByTestId("slot-target")
    expect(targets).toHaveLength(26)
    for (const target of targets) {
      expect(target.style.height).toBe(`${SLOT_HEIGHT_PX}px`)
    }
  })

  it("distingue las franjas de cada columna y las saca del orden de tabulacion", async () => {
    // Con tres columnas el lector de pantalla anunciaba "Crear cita a las
    // 09:00" tres veces, identicas; y tabular la rejilla eran hasta 26 paradas
    // mudas por columna antes de llegar a la primera cita.
    render(<DayView variant="desktop" columns={columnsOf()} onSlotTap={vi.fn()} />)

    const laura = within(columnOf("emp_1")).getAllByTestId("slot-target")[2]
    const sofia = within(columnOf("emp_2")).getAllByTestId("slot-target")[2]

    expect(laura).toHaveAccessibleName("Crear cita a las 09:00 con Laura Martinez")
    expect(sofia).toHaveAccessibleName("Crear cita a las 09:00 con Sofia Puig")
    expect(laura.tabIndex).toBe(-1)
    expect(sofia.tabIndex).toBe(-1)
  })

  it("pulsar una cita abre la cita, no la franja que tiene debajo", async () => {
    const onSlotTap = vi.fn()
    const onAppointmentTap = vi.fn()
    render(
      <DayView
        variant="mobile"
        columns={columnsOf()}
        onSlotTap={onSlotTap}
        onAppointmentTap={onAppointmentTap}
      />
    )

    await userEvent.click(screen.getByText("Carla Ruiz"))

    expect(onAppointmentTap).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: "apt_1" })
    )
    expect(onSlotTap).not.toHaveBeenCalled()
  })

  it("sin manejador no monta ninguna franja pulsable", () => {
    render(<DayView variant="desktop" columns={columnsOf()} />)

    expect(screen.queryAllByTestId("slot-target")).toHaveLength(0)
  })
})
