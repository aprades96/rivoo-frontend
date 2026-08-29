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

/**
 * `assignLanes` ESPIADA, delegando en la real: aqui solo se cuentan llamadas.
 * `ColumnBody` la memoriza porque cuesta O(k³) por grupo de solape, y ese
 * arreglo no cambia ni un pixel de lo pintado -- sin contar llamadas no hay
 * prueba que lo sujete y el `useMemo` se cae en el siguiente refactor sin que
 * nada se ponga rojo.
 */
const assignLanesSpy = vi.hoisted(() => vi.fn())

vi.mock("@/lib/utils/calendar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils/calendar")>()
  assignLanesSpy.mockImplementation(actual.assignLanes)
  return { ...actual, assignLanes: assignLanesSpy }
})

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
 * a proposito -- caso que el canvas NO dibuja, sus tres columnas llevan tres
 * bloques cada una: la columna se conserva porque la rejilla reparte
 * `repeat(N, minmax(0, 1fr))` y perder una ensancharia a las demas. Ver
 * `groupByEmployee`.
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

function blockOf(clientName: string): HTMLElement {
  const block = screen
    .getByText(clientName)
    .closest<HTMLElement>('[data-testid="appointment-block"]')
  if (!block) throw new Error(`No hay bloque para ${clientName}`)
  return block
}

/**
 * El ancho de columna sobre el que se resuelven los `calc()` del bloque. jsdom
 * no hace layout, asi que el `100%` se resuelve aqui: vale cualquier ancho
 * mientras sea el mismo para todos los bloques.
 */
const COLUMN_WIDTH_PX = 1000

/**
 * El `calc()` de `laneGeometry` (`appointment-block.tsx`) tal y como lo
 * SERIALIZA el motor de CSS: `calc(4px + 0.5 * (100% - 8px))` para el `left` y
 * `calc(0.5 * (100% - 8px))` para el ancho -- la division entre el numero de
 * carriles ya viene resuelta en la fraccion. Si algun dia deja de tener esta
 * forma, `paintedRect` avisa con un error en vez de callarse.
 */
const LANE_LEFT = /^calc\(([\d.]+)px \+ ([\d.]+) \* \(100% - ([\d.]+)px\)\)$/
const LANE_WIDTH = /^calc\(([\d.]+) \* \(100% - ([\d.]+)px\)\)$/

interface PaintedRect {
  left: number
  right: number
  top: number
  bottom: number
}

/**
 * El RECTANGULO que el bloque ocupa de verdad, leido de su `style`. No los
 * numeros de carril: el carril es la intencion, y `laneGeometry` recorta el
 * indice a `lanes - 1`, asi que un `lane` imposible no se ve en el reparto
 * pero si en el pixel -- dos bloques distintos acaban en la misma banda.
 */
function paintedRect(block: HTMLElement): PaintedRect {
  const top = Number.parseFloat(block.style.top)
  const height = Number.parseFloat(block.style.height)
  if (!Number.isFinite(top) || !Number.isFinite(height)) {
    throw new Error(`Bloque sin alto real: top="${block.style.top}" height="${block.style.height}"`)
  }

  const { left, width, right } = block.style

  // Carril unico: el bloque va de sangrado a sangrado, sin `calc()`.
  if (width === "") {
    return {
      left: Number.parseFloat(left),
      right: COLUMN_WIDTH_PX - Number.parseFloat(right),
      top,
      bottom: top + height,
    }
  }

  const leftParts = LANE_LEFT.exec(left)
  const widthParts = LANE_WIDTH.exec(width)
  if (!leftParts || !widthParts) {
    throw new Error(`Geometria que esta prueba no sabe leer: left="${left}" width="${width}"`)
  }

  const paintedLeft =
    Number(leftParts[1]) + Number(leftParts[2]) * (COLUMN_WIDTH_PX - Number(leftParts[3]))
  const paintedWidth = Number(widthParts[1]) * (COLUMN_WIDTH_PX - Number(widthParts[2]))

  return { left: paintedLeft, right: paintedLeft + paintedWidth, top, bottom: top + height }
}

/**
 * El margen es una MILLONESIMA de pixel, y esta para no confundir el redondeo
 * del binario con una colision: el borde derecho de un carril y el izquierdo
 * del siguiente son dos expresiones distintas de la misma fraccion (`4 +
 * 4u/6 + u/6` frente a `4 + 5u/6`), y en coma flotante se separan 1e-13 px.
 * Un solape de verdad -- dos bloques en la misma banda por el recorte de
 * `laneGeometry` -- es de media columna, cientos de pixeles.
 */
const SUBPIXEL_EPSILON = 1e-6

function overlaps(a: PaintedRect, b: PaintedRect): boolean {
  return (
    a.left + SUBPIXEL_EPSILON < b.right &&
    b.left + SUBPIXEL_EPSILON < a.right &&
    a.top + SUBPIXEL_EPSILON < b.bottom &&
    b.top + SUBPIXEL_EPSILON < a.bottom
  )
}

function describeRect(rect: PaintedRect): string {
  return `x[${rect.left}, ${rect.right}] y[${rect.top}, ${rect.bottom}]`
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

    // La columna de Marc existe y esta vacia: el caso que se pierde en cuanto
    // alguien filtra las columnas sin citas, y con el se va el ancho estable
    // de las demas (ver `groupByEmployee`).
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

describe("DayView · el resumen de la cabecera", () => {
  /**
   * Dos empleadas distintas con el MISMO nombre y apellido. No es rebuscado en
   * un salon con dos Lauras Martinez, y es el unico caso que distingue
   * emparejar por `employeeId` de emparejar por `label`: con la pareja mal
   * hecha las dos cabeceras anuncian el dia de la primera y la segunda ve la
   * agenda de otra persona como si fuera la suya.
   */
  const HOMONYMS: Employee[] = [
    makeEmployee({ id: "emp_1", firstName: "Laura", lastName: "Martinez" }),
    makeEmployee({ id: "emp_2", firstName: "Laura", lastName: "Martinez", colorHex: null }),
  ]

  it("empareja cada resumen con SU columna por employeeId, no por nombre", () => {
    // Lo que la vista muestra: las dos columnas recortadas por el buscador, sin
    // citas. Lo que el resumen tiene que contar: el dia entero de cada una.
    const trimmed = columnsOf([], HOMONYMS)
    const full = columnsOf(
      [
        makeAppointment({ id: "apt_1", employeeId: "emp_1" }),
        makeAppointment({
          id: "apt_2",
          employeeId: "emp_2",
          startTime: `${DAY}T11:00:00`,
          endTime: `${DAY}T11:30:00`,
        }),
      ],
      HOMONYMS
    )

    render(<DayView variant="desktop" columns={trimmed} summaryColumns={full} />)

    const headers = screen.getAllByTestId("employee-column-header")
    expect(headers.map((header) => header.dataset.employeeId)).toEqual(["emp_1", "emp_2"])
    // La premisa del test: los dos rotulos son literalmente el mismo texto.
    for (const header of headers) {
      expect(within(header).getByText("Laura Martinez")).toBeInTheDocument()
    }

    expect(within(headers[0]).getByText("1 cita · 1h")).toBeInTheDocument()
    expect(within(headers[1]).getByText("1 cita · 30min")).toBeInTheDocument()
  })

  it("sin summaryColumns cada cabecera resume su propia columna", () => {
    render(<DayView variant="desktop" columns={columnsOf()} />)

    const headers = screen.getAllByTestId("employee-column-header")
    expect(within(headers[0]).getByText("1 cita · 1h")).toBeInTheDocument()
    expect(within(headers[1]).getByText("1 cita · 1h 30min")).toBeInTheDocument()
    expect(within(headers[2]).getByText("Sin citas")).toBeInTheDocument()
  })

  it("una columna sin pareja en summaryColumns se resume con la suya", () => {
    // La columna "Otros" no esta en la lista de empleados, asi que nunca tiene
    // pareja: sin el respaldo se quedaria muda.
    const orphan = makeAppointment({
      id: "apt_orphan",
      employeeId: "emp_baja",
      employeeName: "Nuria Vila",
      clientName: "Pau Serra",
    })

    render(
      <DayView
        variant="desktop"
        columns={columnsOf([...APPOINTMENTS, orphan])}
        summaryColumns={columnsOf()}
      />
    )

    const headers = screen.getAllByTestId("employee-column-header")
    expect(within(headers[3]).getByText("Otros")).toBeInTheDocument()
    expect(within(headers[3]).getByText("1 cita · 1h")).toBeInTheDocument()
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

describe("DayView · dos citas solapadas nunca se pisan en pantalla", () => {
  /**
   * La sonda del BLOQUEANTE: una cita con horas que `parseISO` no sabe leer
   * mas dos pares solapados independientes, a las 09:00 y a las 15:00.
   *
   * `calculateBlockPosition` devolvia `{top: NaN, height: NaN}` en vez de
   * `null` -- la guarda de tramo vacio no lo cazaba, porque `NaN >= NaN` es
   * `false` --, asi que la ilegible se daba por pintada, entraba al reparto y
   * dejaba `groupEnd` en `NaN`: el grupo de solape no volvia a cerrarse en
   * todo el dia y los dos pares salian repartidos como uno solo. La segunda
   * cita del primer par se llevaba `lane 2` sobre `lanes 2`, y `laneGeometry`
   * no tira ese carril fuera de la columna: lo recorta a `lanes - 1`, o sea a
   * la MISMA banda que su vecina.
   *
   * Por eso se comprueban rectangulos y no carriles: con los numeros a la
   * vista la colision no se ve -- 2 de 2 parece caer fuera de la columna --, y
   * lo que llega al usuario es un bloque tapando a otro.
   *
   * Este montaje ademas revienta antes de llegar ahi: `AppointmentBlock` pasa
   * de largo su `if (!position)` y `formatTime` lanza `RangeError: Invalid
   * time value`, que se lleva la pantalla entera por delante. Las dos cosas
   * las cierra la misma guarda.
   */
  it("una cita con la hora ilegible no arrastra al resto del dia", () => {
    const appointments: Appointment[] = [
      makeAppointment({
        id: "nan",
        clientName: "Hora Ilegible",
        startTime: `${DAY}Tzz:zz:00`,
        endTime: `${DAY}Tzz:zz:00`,
      }),
      makeAppointment({
        id: "x",
        clientName: "Cita X",
        startTime: `${DAY}T09:00:00`,
        endTime: `${DAY}T10:00:00`,
      }),
      makeAppointment({
        id: "y",
        clientName: "Cita Y",
        startTime: `${DAY}T09:30:00`,
        endTime: `${DAY}T10:30:00`,
      }),
      makeAppointment({
        id: "z",
        clientName: "Cita Z",
        startTime: `${DAY}T15:00:00`,
        endTime: `${DAY}T16:00:00`,
      }),
      makeAppointment({
        id: "w",
        clientName: "Cita W",
        startTime: `${DAY}T15:30:00`,
        endTime: `${DAY}T16:30:00`,
      }),
    ]

    render(<DayView variant="mobile" columns={columnsOf(appointments)} />)

    const names = ["Cita X", "Cita Y", "Cita Z", "Cita W"]
    const rects = names.map((name) => paintedRect(blockOf(name)))

    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(
          overlaps(rects[i], rects[j]),
          `${names[i]} y ${names[j]} se pisan: ` +
            `${describeRect(rects[i])} vs ${describeRect(rects[j])}`
        ).toBe(false)
      }
    }

    // Y la ilegible ni se monta: no hay bloque con alto NaN en la rejilla.
    expect(screen.queryByText("Hora Ilegible")).not.toBeInTheDocument()
    expect(screen.getAllByTestId("appointment-block")).toHaveLength(4)
  })
})

describe("DayView · modo estrecho y seleccion (D17, §1.3)", () => {
  it("selectedAppointmentId marca el anillo solo en el bloque que corresponde", () => {
    render(<DayView variant="desktop" columns={columnsOf()} selectedAppointmentId="apt_2" />)

    const selected = blockOf("Ana Garcia")
    const other = blockOf("Carla Ruiz")

    expect(selected).toHaveClass("shadow-[0_0_0_2px_var(--primary),0_6px_14px_rgba(42,35,32,0.12)]")
    expect(other).not.toHaveClass(
      "shadow-[0_0_0_2px_var(--primary),0_6px_14px_rgba(42,35,32,0.12)]"
    )
  })

  it("sin selectedAppointmentId ningun bloque lleva el anillo", () => {
    render(<DayView variant="desktop" columns={columnsOf()} />)

    for (const block of screen.getAllByTestId("appointment-block")) {
      expect(block).not.toHaveClass(
        "shadow-[0_0_0_2px_var(--primary),0_6px_14px_rgba(42,35,32,0.12)]"
      )
    }
  })

  it("la seleccion tambien se aplica en movil, aunque la hoja la tape (D10)", () => {
    render(<DayView variant="mobile" columns={columnsOf()} selectedAppointmentId="apt_1" />)

    const selected = blockOf("Carla Ruiz")
    expect(selected).toHaveClass("shadow-[0_0_0_2px_var(--primary),0_6px_14px_rgba(42,35,32,0.12)]")
  })

  it("narrow estrecha el canal de horas a 58px", () => {
    render(<DayView variant="desktop" columns={columnsOf()} narrow />)

    const channel = screen.getByTestId("day-view").querySelector(".shrink-0.select-none")
    expect(channel).toHaveStyle({ width: "58px" })
  })

  it("sin narrow el canal se queda en 64px", () => {
    render(<DayView variant="desktop" columns={columnsOf()} />)

    const channel = screen.getByTestId("day-view").querySelector(".shrink-0.select-none")
    expect(channel).toHaveStyle({ width: "64px" })
  })

  it("narrow cambia las dos clases del marco: px-6 -> px-5 y gap-x-3 -> gap-x-2.5", () => {
    render(<DayView variant="desktop" columns={columnsOf()} narrow />)

    const scroller = screen.getByTestId("day-view")
    expect(scroller.className).toContain("px-5")
    expect(scroller.className).not.toContain("px-6")

    const grid = screen.getByTestId("day-view-grid")
    expect(grid.className).toContain("gap-x-2.5")
    expect(grid.className).not.toContain("gap-x-3")
  })

  it("sin narrow el marco se queda como hoy: px-6 y gap-x-3", () => {
    render(<DayView variant="desktop" columns={columnsOf()} />)

    const scroller = screen.getByTestId("day-view")
    expect(scroller.className).toContain("px-6")
    expect(scroller.className).not.toContain("px-5")

    const grid = screen.getByTestId("day-view-grid")
    expect(grid.className).toContain("gap-x-3")
    expect(grid.className).not.toContain("gap-x-2.5")
  })

  it("narrow no tiene efecto en movil: marco y canal se quedan como hoy", () => {
    render(<DayView variant="mobile" columns={columnsOf()} narrow />)

    const scroller = screen.getByTestId("day-view")
    expect(scroller.className).toContain("px-3")
    expect(scroller.className).not.toContain("px-5")

    const channel = scroller.querySelector(".shrink-0.select-none")
    expect(channel).toHaveStyle({ width: "46px" })
  })
})

describe("DayView · el reparto de carriles va memorizado", () => {
  /**
   * `assignLanes` cuesta O(k³) por grupo de solape y corria en el cuerpo del
   * render, una vez por columna: teclear en el buscador de `/calendar` rehacia
   * el reparto entero en cada tecla. Borrar el `useMemo` no cambia nada de lo
   * pintado, asi que la unica forma de fijarlo es contar llamadas.
   */
  it("en escritorio no reparte otra vez en un render que no toca las citas", () => {
    const columns = columnsOf()
    assignLanesSpy.mockClear()

    const { rerender } = render(<DayView variant="desktop" columns={columns} />)

    // Una llamada por columna, y ni una mas.
    expect(assignLanesSpy).toHaveBeenCalledTimes(columns.length)

    rerender(<DayView variant="desktop" columns={columns} className="border" />)

    expect(assignLanesSpy).toHaveBeenCalledTimes(columns.length)
  })

  /**
   * En movil hace falta ademas el `useMemo` de la UNION de columnas: el
   * `flatMap` devuelve un array nuevo en cada render, y eso solo basta para
   * tirar por tierra el `useMemo` de `ColumnBody`, que depende de la identidad
   * de `appointments`. Con uno cualquiera de los dos borrado, este render de
   * mas vuelve a repartir.
   */
  it("en movil tampoco, aunque la union de columnas se rehaga en cada render", () => {
    const columns = columnsOf()
    assignLanesSpy.mockClear()

    const { rerender } = render(<DayView variant="mobile" columns={columns} />)

    expect(assignLanesSpy).toHaveBeenCalledTimes(1)

    rerender(<DayView variant="mobile" columns={columns} className="border" />)

    expect(assignLanesSpy).toHaveBeenCalledTimes(1)
  })
})
