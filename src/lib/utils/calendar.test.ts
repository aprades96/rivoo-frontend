import { describe, it, expect } from "vitest"
import {
  generateTimeLabels,
  calculateBlockPosition,
  groupByEmployee,
  employeeDaySummary,
  breakPosition,
  visibleBreak,
  nextFreeSlot,
  assignLanes,
  BLOCK_GUTTER_PX,
  GRID_START_HOUR,
  GRID_END_HOUR,
  SLOT_HEIGHT_PX,
  SLOT_MINUTES,
  TOTAL_SLOTS,
  type EmployeeBreaks,
  type LaneAssignment,
} from "./calendar"
import type { Appointment, AppointmentStatus } from "@/types/appointment"
import type { Employee, WorkingHoursResponse } from "@/types/employee"

/**
 * Martes 25 de agosto de 2026 (`getDay() === 2`, o sea `dayOfWeek === 2` en la
 * convencion lunes=1 del backend). Todas las horas se escriben sin offset a
 * proposito: `parseISO` las resuelve en la zona local, que es la misma que
 * lee `Date#getHours()` dentro de la funcion.
 */
const DAY = "2026-08-25"
const TUESDAY = 2

function at(time: string): string {
  return `${DAY}T${time}:00`
}

function makeAppointment(
  overrides: Partial<Appointment> & { startTime: string; endTime: string }
): Appointment {
  return {
    id: `apt-${overrides.startTime}`,
    tenantId: "tenant-1",
    clientId: null,
    clientName: "Cliente",
    clientPhone: null,
    clientEmail: null,
    employeeId: "emp-1",
    employeeName: "Laura Martinez",
    serviceId: "svc-1",
    serviceName: "Corte",
    servicePrice: 35,
    serviceDurationMinutes: 60,
    status: "CONFIRMED" as AppointmentStatus,
    source: "MANUAL",
    notes: null,
    reminderSent: false,
    createdAt: at("08:00"),
    updatedAt: at("08:00"),
    ...overrides,
  }
}

function makeEmployee(overrides: Partial<Employee> & { id: string }): Employee {
  return {
    firstName: "Laura",
    lastName: "Martinez",
    email: `${overrides.id}@salon.test`,
    phone: null,
    jobTitle: null,
    colorHex: null,
    isActive: true,
    createdAt: at("08:00"),
    ...overrides,
  }
}

function makeWorkingHours(overrides: Partial<WorkingHoursResponse> = {}): WorkingHoursResponse[] {
  return [
    {
      dayOfWeek: TUESDAY,
      isOpen: true,
      openTime: "09:00:00",
      closeTime: "20:00:00",
      breakStartTime: "13:00:00",
      breakEndTime: "14:00:00",
      ...overrides,
    },
  ]
}

describe("generateTimeLabels", () => {
  const labels = generateTimeLabels()

  it("starts at 08:00", () => {
    expect(labels[0]).toBe("08:00")
  })

  it("ends at 20:30", () => {
    expect(labels[labels.length - 1]).toBe("20:30")
  })

  it("generates correct number of slots", () => {
    expect(labels).toHaveLength(TOTAL_SLOTS)
  })

  it("alternates between :00 and :30", () => {
    expect(labels[0]).toBe("08:00")
    expect(labels[1]).toBe("08:30")
    expect(labels[2]).toBe("09:00")
  })
})

describe("calculateBlockPosition", () => {
  it("returns correct top for appointment at grid start", () => {
    const pos = calculateBlockPosition(at("08:00"), at("08:30"))
    expect(pos).not.toBeNull()
    expect(pos!.top).toBe(0)
  })

  it("calculates correct top for 09:00 appointment", () => {
    const pos = calculateBlockPosition(at("09:00"), at("09:30"))
    expect(pos).not.toBeNull()
    // 09:00 is 60 min after 08:00 = 2 slots
    expect(pos!.top).toBe(2 * SLOT_HEIGHT_PX)
  })

  // Los cuatro altos del artboard. Cada uno es la duracion MENOS el canalon de
  // 4px: si el canalon se pierde, los cuatro fallan a la vez.
  it("paints a 60 min appointment 92px tall, as the artboard does", () => {
    // design/CalendarioDesktop.dc.html:161 -- Carla Ruiz 09:00 - 10:00
    const pos = calculateBlockPosition(at("09:00"), at("10:00"))
    expect(pos).toEqual({ top: 96, height: 92 })
  })

  it("paints a 90 min appointment 140px tall", () => {
    // design/CalendarioDesktop.dc.html:167 -- Ana Garcia 10:30 - 12:00
    const pos = calculateBlockPosition(at("10:30"), at("12:00"))
    expect(pos).toEqual({ top: 240, height: 140 })
  })

  it("paints a 45 min appointment 68px tall", () => {
    // design/CalendarioDesktop.dc.html:193 -- Nuria Camps 08:00 - 08:45
    const pos = calculateBlockPosition(at("08:00"), at("08:45"))
    expect(pos).toEqual({ top: 0, height: 68 })
  })

  it("paints a 30 min appointment 44px tall", () => {
    // design/CalendarioDesktop.dc.html:220 -- Pedro Sanchez 09:30 - 10:00
    const pos = calculateBlockPosition(at("09:30"), at("10:00"))
    expect(pos).toEqual({ top: 144, height: 44 })
  })

  it("leaves a 4px gutter between two chained appointments", () => {
    // design/CalendarioDesktop.dc.html:225 acaba en 380, :230 empieza en 384.
    const first = calculateBlockPosition(at("11:30"), at("12:00"))!
    const second = calculateBlockPosition(at("12:00"), at("13:30"))!
    expect(first.top + first.height).toBe(second.top - BLOCK_GUTTER_PX)
  })

  it("returns null for appointment outside grid", () => {
    const pos = calculateBlockPosition(at("06:00"), at("07:00"))
    expect(pos).toBeNull()
  })

  it("clamps appointment that starts before grid", () => {
    const pos = calculateBlockPosition(at("07:30"), at("08:30"))
    expect(pos).not.toBeNull()
    expect(pos!.top).toBe(0) // clamped to 08:00
    expect(pos!.height).toBe(SLOT_HEIGHT_PX - BLOCK_GUTTER_PX) // 30 min visible
  })

  it("clamps appointment that ends after grid", () => {
    const pos = calculateBlockPosition(at("20:30"), at("21:30"))
    expect(pos).not.toBeNull()
    // 20:30 to 21:00 = 30 min visible
    expect(pos!.height).toBe(SLOT_HEIGHT_PX - BLOCK_GUTTER_PX)
  })

  it("keeps a 15 min appointment on the 24px floor instead of shrinking it further", () => {
    // 15 min = 24px en bruto; restarle el canalon lo dejaria en 20 y el nombre
    // del cliente no cabria. El suelo manda sobre el canalon.
    const pos = calculateBlockPosition(at("10:00"), at("10:15"))
    expect(pos).not.toBeNull()
    expect(pos!.height).toBe(SLOT_HEIGHT_PX / 2)
    expect(pos!.height).toBe(24)
  })

  it("no deja que el suelo de 24px invada el bloque siguiente por debajo de 15 min", () => {
    // Por debajo de 15 minutos el suelo (24px) supera la distancia real al
    // bloque siguiente (`1.6 * d`), asi que dos citas de 10 minutos
    // encadenadas se pisaban 8px -- y `assignLanes`, que compara tiempos y no
    // geometria, les daba el mismo carril y ancho completo, asi que la segunda
    // tapaba a la primera. El suelo va techado por el alto real del tramo.
    const first = calculateBlockPosition(at("10:00"), at("10:10"))!
    const second = calculateBlockPosition(at("10:10"), at("10:20"))!

    expect(first.height).toBe(16) // 10 min = 16px, sin canalon pero sin pisar
    expect(first.top + first.height).toBeLessThanOrEqual(second.top)
  })

  it("mantiene el suelo justo en el umbral de 15 minutos", () => {
    // 15 min = 24px en bruto: el suelo cabe exacto y los dos bloques se tocan
    // sin solaparse. Es el limite del caso anterior.
    const first = calculateBlockPosition(at("10:00"), at("10:15"))!
    const second = calculateBlockPosition(at("10:15"), at("10:30"))!

    expect(first.height).toBe(24)
    expect(first.top + first.height).toBe(second.top)
  })
})

describe("groupByEmployee", () => {
  const laura = makeEmployee({ id: "emp-1", firstName: "Laura", lastName: "Martinez" })
  const sofia = makeEmployee({ id: "emp-2", firstName: "Sofia", lastName: "Puig" })
  const marc = makeEmployee({ id: "emp-3", firstName: "Marc", lastName: "Oliva" })

  it("keeps one column per employee, in the given order", () => {
    const columns = groupByEmployee([], [laura, sofia, marc])
    expect(columns.map((column) => column.employeeId)).toEqual(["emp-1", "emp-2", "emp-3"])
    expect(columns.map((column) => column.label)).toEqual([
      "Laura Martinez",
      "Sofia Puig",
      "Marc Oliva",
    ])
  })

  it("keeps the column of an employee with no appointments", () => {
    // design/CalendarioDesktop.dc.html:210-235 dibuja la columna vacia igual.
    const appointment = makeAppointment({
      employeeId: "emp-1",
      startTime: at("09:00"),
      endTime: at("10:00"),
    })

    const columns = groupByEmployee([appointment], [laura, sofia, marc])

    expect(columns).toHaveLength(3)
    expect(columns[1].appointments).toEqual([])
    expect(columns[2].appointments).toEqual([])
  })

  it("puts each appointment in its employee column, sorted by start time", () => {
    const late = makeAppointment({
      id: "late",
      employeeId: "emp-2",
      startTime: at("14:00"),
      endTime: at("14:30"),
    })
    const early = makeAppointment({
      id: "early",
      employeeId: "emp-2",
      startTime: at("08:00"),
      endTime: at("08:45"),
    })

    const columns = groupByEmployee([late, early], [laura, sofia, marc])

    expect(columns[1].appointments.map((a) => a.id)).toEqual(["early", "late"])
  })

  it("drops inactive employees from the columns", () => {
    const retired = makeEmployee({ id: "emp-9", firstName: "Nil", isActive: false })
    const columns = groupByEmployee([], [laura, retired])
    expect(columns.map((column) => column.employeeId)).toEqual(["emp-1"])
  })

  it("collects appointments of unknown employees in a trailing 'Otros' column", () => {
    // Una cita de un empleado dado de baja hoy: `useEmployees` ya no lo trae,
    // y sin esta columna la cita desapareceria de la pantalla sin aviso.
    const orphan = makeAppointment({
      id: "orphan",
      employeeId: "emp-desactivado",
      employeeName: "Nil Serra",
      startTime: at("11:00"),
      endTime: at("12:00"),
    })
    const known = makeAppointment({
      id: "known",
      employeeId: "emp-1",
      startTime: at("09:00"),
      endTime: at("10:00"),
    })

    const columns = groupByEmployee([orphan, known], [laura, sofia])

    expect(columns).toHaveLength(3)
    const last = columns[columns.length - 1]
    expect(last.employeeId).toBeNull()
    expect(last.label).toBe("Otros")
    expect(last.appointments.map((a) => a.id)).toEqual(["orphan"])
    // El bloque se etiqueta con el nombre que trae la propia cita.
    expect(last.appointments[0].employeeName).toBe("Nil Serra")
    expect(columns[0].appointments.map((a) => a.id)).toEqual(["known"])
  })

  it("sends the appointments of an inactive employee to 'Otros' too", () => {
    const retired = makeEmployee({ id: "emp-9", firstName: "Nil", isActive: false })
    const appointment = makeAppointment({
      employeeId: "emp-9",
      startTime: at("11:00"),
      endTime: at("12:00"),
    })

    const columns = groupByEmployee([appointment], [laura, retired])

    expect(columns.map((column) => column.label)).toEqual(["Laura Martinez", "Otros"])
    expect(columns[1].appointments).toHaveLength(1)
  })

  it("does not create the 'Otros' column when every appointment has a column", () => {
    const appointment = makeAppointment({
      employeeId: "emp-1",
      startTime: at("09:00"),
      endTime: at("10:00"),
    })

    const columns = groupByEmployee([appointment], [laura, sofia])

    expect(columns.every((column) => column.employeeId !== null)).toBe(true)
  })

  it("returns no columns for a day with neither employees nor appointments", () => {
    expect(groupByEmployee([], [])).toEqual([])
  })
})

describe("employeeDaySummary", () => {
  it("matches Marc Oliva's header from the artboard, cancelled appointment included", () => {
    // design/CalendarioDesktop.dc.html:124 dice "3 citas · 2h 30min" y su
    // columna (:220, :225, :230) son 30 + 30 CANCELADA + 90 = 150 min. Si la
    // cancelada se descontase, saldria "2 citas · 2h".
    const appointments = [
      makeAppointment({ startTime: at("09:30"), endTime: at("10:00") }),
      makeAppointment({
        startTime: at("11:30"),
        endTime: at("12:00"),
        status: "CANCELLED",
      }),
      makeAppointment({ startTime: at("12:00"), endTime: at("13:30") }),
    ]

    expect(employeeDaySummary(appointments)).toBe("3 citas · 2h 30min")
  })

  it("counts a no-show as workload too", () => {
    const appointments = [
      makeAppointment({ startTime: at("09:00"), endTime: at("10:00"), status: "NO_SHOW" }),
    ]
    expect(employeeDaySummary(appointments)).toBe("1 cita · 1h")
  })

  it("uses the singular for a single appointment", () => {
    const appointments = [makeAppointment({ startTime: at("09:00"), endTime: at("09:30") })]
    expect(employeeDaySummary(appointments)).toBe("1 cita · 30min")
  })

  it("drops the hours part below one hour", () => {
    const appointments = [
      makeAppointment({ startTime: at("09:00"), endTime: at("09:15") }),
      makeAppointment({ startTime: at("10:00"), endTime: at("10:30") }),
    ]
    expect(employeeDaySummary(appointments)).toBe("2 citas · 45min")
  })

  it("drops the minutes part on whole hours", () => {
    const appointments = [
      makeAppointment({ startTime: at("09:00"), endTime: at("12:00") }),
      makeAppointment({ startTime: at("14:00"), endTime: at("16:00") }),
    ]
    expect(employeeDaySummary(appointments)).toBe("2 citas · 5h")
  })

  it("counts the whole appointment even when it starts before the grid", () => {
    // El recorte es cosa de la rejilla; la carga del empleado es la real.
    const appointments = [makeAppointment({ startTime: at("07:00"), endTime: at("08:30") })]
    expect(employeeDaySummary(appointments)).toBe("1 cita · 1h 30min")
  })

  it("says 'Sin citas' for an empty column", () => {
    expect(employeeDaySummary([])).toBe("Sin citas")
  })
})

describe("breakPosition", () => {
  it("positions the lunch block like the artboard does", () => {
    // design/CalendarioDesktop.dc.html:177 -- top 480px, height 92px.
    const position = breakPosition(makeWorkingHours(), new Date(2026, 7, 25))
    expect(position).toEqual({
      top: 480,
      height: 92,
      start: "13:00",
      end: "14:00",
      label: "13:00 - 14:00",
    })
  })

  it("lleva dentro el tramo real, que es lo que consume el hueco libre", () => {
    // `nextFreeSlot` lee `start`/`end` de ESTE objeto en vez de volver a
    // resolver el descanso por su cuenta: una sola definicion de "el descanso
    // que se ve".
    const position = breakPosition(makeWorkingHours(), new Date(2026, 7, 25))
    expect(position!.start).toBe("13:00")
    expect(position!.end).toBe("14:00")
  })

  it("strips the seconds the backend sends in LocalTime", () => {
    const position = breakPosition(
      makeWorkingHours({ breakStartTime: "09:00:00", breakEndTime: "09:30:00" }),
      new Date(2026, 7, 25)
    )
    expect(position!.label).toBe("09:00 - 09:30")
  })

  it("returns null when the employee has no break that day", () => {
    const hours = makeWorkingHours({ breakStartTime: null, breakEndTime: null })
    expect(breakPosition(hours, new Date(2026, 7, 25))).toBeNull()
  })

  it("returns null when only one end of the break is set", () => {
    const hours = makeWorkingHours({ breakEndTime: null })
    expect(breakPosition(hours, new Date(2026, 7, 25))).toBeNull()
  })

  it("returns null on a closed day", () => {
    const hours = makeWorkingHours({ isOpen: false })
    expect(breakPosition(hours, new Date(2026, 7, 25))).toBeNull()
  })

  it("returns null when the day has no row at all", () => {
    const hours = makeWorkingHours({ dayOfWeek: 5 }) // viernes, no martes
    expect(breakPosition(hours, new Date(2026, 7, 25))).toBeNull()
  })

  it("returns null when the working hours have not loaded yet", () => {
    expect(breakPosition(undefined, new Date(2026, 7, 25))).toBeNull()
    expect(breakPosition([], new Date(2026, 7, 25))).toBeNull()
  })

  it("returns null for a break that falls outside the grid", () => {
    const hours = makeWorkingHours({ breakStartTime: "06:00:00", breakEndTime: "07:00:00" })
    expect(breakPosition(hours, new Date(2026, 7, 25))).toBeNull()
  })
})

describe("nextFreeSlot", () => {
  const morning = [
    makeAppointment({ startTime: at("09:00"), endTime: at("10:00") }),
    makeAppointment({ startTime: at("10:30"), endTime: at("12:00") }),
  ]

  it("marks the 12:00 gap of the mobile artboard", () => {
    // design/Calendario.dc.html:112 -- top 384px, height 44px.
    const now = new Date(2026, 7, 25, 11, 45)
    const slot = nextFreeSlot(morning, new Date(2026, 7, 25), now)

    expect(slot).toEqual({
      startTime: at("12:00"),
      endTime: at("12:30"),
      top: 384,
      height: 44,
    })
  })

  it("returns null when the visible day is not today", () => {
    // Sin esta guarda el recuadro "Libre" seguiria apareciendo a la hora de
    // HOY al navegar a manana, en un dia donde ese hueco no significa nada.
    const now = new Date(2026, 7, 25, 11, 45)
    const tomorrow = new Date(2026, 7, 26)

    expect(nextFreeSlot(morning, tomorrow, now)).toBeNull()
    expect(nextFreeSlot([], tomorrow, now)).toBeNull()
  })

  it("rounds up to the next half hour", () => {
    const now = new Date(2026, 7, 25, 15, 1)
    const slot = nextFreeSlot([], new Date(2026, 7, 25), now)
    expect(slot!.startTime).toBe(at("15:30"))
  })

  it("keeps the current slot when now sits exactly on the boundary", () => {
    const now = new Date(2026, 7, 25, 15, 0)
    const slot = nextFreeSlot([], new Date(2026, 7, 25), now)
    expect(slot!.startTime).toBe(at("15:00"))
  })

  it("starts at the top of the grid when the salon has not opened yet", () => {
    const now = new Date(2026, 7, 25, 6, 30)
    const slot = nextFreeSlot([], new Date(2026, 7, 25), now)
    expect(slot!.startTime).toBe(at(`0${GRID_START_HOUR}:00`))
    expect(slot!.top).toBe(0)
  })

  it("skips a slot that only partially overlaps an appointment", () => {
    const appointments = [makeAppointment({ startTime: at("12:15"), endTime: at("12:45") })]
    const now = new Date(2026, 7, 25, 11, 50)
    const slot = nextFreeSlot(appointments, new Date(2026, 7, 25), now)
    // 12:00-12:30 y 12:30-13:00 estan pisados; el primero limpio es 13:00.
    expect(slot!.startTime).toBe(at("13:00"))
  })

  it("skips the break", () => {
    const now = new Date(2026, 7, 25, 12, 45)
    const lunch = breakPosition(makeWorkingHours(), new Date(2026, 7, 25))
    const slot = nextFreeSlot([], new Date(2026, 7, 25), now, lunch)
    // El descanso 13:00-14:00 se come los dos slots siguientes.
    expect(slot!.startTime).toBe(at("14:00"))
    expect(slot!.top).toBe(576)
  })

  it("offers the 13:00 slot when no break is painted", () => {
    // Dia cerrado: `breakPosition` no devuelve bloque, asi que no hay nada que
    // esquivar. Quien decide si hay descanso es quien lo PINTA.
    const now = new Date(2026, 7, 25, 12, 45)
    const lunch = breakPosition(makeWorkingHours({ isOpen: false }), new Date(2026, 7, 25))
    expect(lunch).toBeNull()

    const slot = nextFreeSlot([], new Date(2026, 7, 25), now, lunch)
    expect(slot!.startTime).toBe(at("13:00"))
  })

  it("counts a CANCELLED appointment as busy", () => {
    // La rejilla las sigue pintando (`CalendarioDesktop.dc.html:225-228`):
    // ofrecer "Libre" encima de un bloque rojo visible seria una
    // contradiccion, y la franja sigue reservada hasta que alguien la
    // reasigne.
    const cancelled = [
      makeAppointment({ startTime: at("12:00"), endTime: at("13:00"), status: "CANCELLED" }),
    ]
    const now = new Date(2026, 7, 25, 11, 45)

    const slot = nextFreeSlot(cancelled, new Date(2026, 7, 25), now)

    expect(slot!.startTime).toBe(at("13:00"))
  })

  it("returns null once the grid is over", () => {
    const now = new Date(2026, 7, 25, 21, 30)
    expect(nextFreeSlot([], new Date(2026, 7, 25), now)).toBeNull()
  })

  it("returns null when the last slot would run past the grid end", () => {
    const now = new Date(2026, 7, 25, GRID_END_HOUR - 1, 45)
    // 20:45 redondea a 21:00, que ya no deja un tramo entero dentro.
    expect(nextFreeSlot([], new Date(2026, 7, 25), now)).toBeNull()
  })

  it("returns null when the whole day is booked", () => {
    const fullDay = [makeAppointment({ startTime: at("08:00"), endTime: at("21:00") })]
    const now = new Date(2026, 7, 25, 8, 0)
    expect(nextFreeSlot(fullDay, new Date(2026, 7, 25), now)).toBeNull()
  })

  it("ignores appointments of another day", () => {
    const other = [
      makeAppointment({ startTime: "2026-08-26T12:00:00", endTime: "2026-08-26T13:00:00" }),
    ]
    const now = new Date(2026, 7, 25, 12, 0)
    const slot = nextFreeSlot(other, new Date(2026, 7, 25), now)
    expect(slot!.startTime).toBe(at("12:00"))
  })

  it("offers a slot lasting exactly one grid slot", () => {
    const now = new Date(2026, 7, 25, 10, 0)
    const slot = nextFreeSlot([], new Date(2026, 7, 25), now)
    expect(slot!.endTime).toBe(at(`10:${SLOT_MINUTES}`))
  })
})

describe("el hueco libre y el descanso que se PINTA", () => {
  const employees = [
    makeEmployee({ id: "emp-1", firstName: "Laura", lastName: "Martinez" }),
    makeEmployee({ id: "emp-2", firstName: "Sofia", lastName: "Puig" }),
    makeEmployee({ id: "emp-3", firstName: "Marc", lastName: "Oliva" }),
  ]

  /** El mapa que la pantalla arma con `breakPosition`, uno por empleado. */
  function breaksOf(date: Date): EmployeeBreaks {
    const byEmployee: EmployeeBreaks = {}
    for (const employee of employees) {
      byEmployee[employee.id] = breakPosition(makeWorkingHours(), date)
    }
    return byEmployee
  }

  it("no ofrece el hueco encima del almuerzo con el filtro en 'Todos'", () => {
    // "Todos" es una eleccion del usuario, NO lo que dibuja el artboard: alli
    // la pildora seleccionada es la de Laura (`design/Calendario.dc.html:52-55`,
    // #B4522F) y la de "Todos" esta en reposo (`:51`, blanca y de peso 500).
    // El caso: tres empleados activos, todos con el mismo descanso 13:00-14:00,
    // ninguna cita despues de las 12:00, son las 12:45. Antes la pantalla no
    // tenia empleado seleccionado y le pasaba
    // `null` a `nextFreeSlot`, el descanso no entraba en `busy` y el recuadro
    // "Libre" caia en 13:00-13:30 -- justo encima del rayado del almuerzo, que
    // `visibleBreak` si estaba pintando en top 480.
    const date = new Date(2026, 7, 25)
    const now = new Date(2026, 7, 25, 12, 45)
    const appointments = [makeAppointment({ startTime: at("11:00"), endTime: at("12:00") })]

    const columns = groupByEmployee(appointments, employees)
    const painted = visibleBreak(columns, breaksOf(date))

    expect(painted).toMatchObject({ top: 480, height: 92, label: "13:00 - 14:00" })

    const slot = nextFreeSlot(appointments, date, now, painted)

    expect(slot!.startTime).toBe(at("14:00"))
    // Y lo que de verdad importa: el recuadro no cae dentro del rayado.
    expect(slot!.top).toBeGreaterThanOrEqual(painted!.top + painted!.height)
  })

  it("respeta el descanso del unico empleado que queda al filtrar por uno", () => {
    const date = new Date(2026, 7, 25)
    const now = new Date(2026, 7, 25, 12, 45)

    const columns = groupByEmployee([], employees).filter(
      (column) => column.employeeId === "emp-2"
    )
    const painted = visibleBreak(columns, breaksOf(date))

    expect(nextFreeSlot([], date, now, painted)!.startTime).toBe(at("14:00"))
  })
})

describe("visibleBreak", () => {
  const columns = groupByEmployee(
    [],
    [
      makeEmployee({ id: "emp-1" }),
      makeEmployee({ id: "emp-2", firstName: "Sofia" }),
      makeEmployee({ id: "emp-3", firstName: "Marc" }),
    ]
  )
  const lunch = breakPosition(makeWorkingHours(), new Date(2026, 7, 25))!

  it("devuelve un solo tramo aunque toda la plantilla almuerce a la vez", () => {
    const painted = visibleBreak(columns, {
      "emp-1": lunch,
      "emp-2": lunch,
      "emp-3": lunch,
    })
    expect(painted).toEqual(lunch)
  })

  it("encuentra el descanso aunque solo lo tenga una columna que no es la primera", () => {
    expect(visibleBreak(columns, { "emp-3": lunch })).toEqual(lunch)
  })

  it("devuelve null cuando no hay ningun descanso que pintar", () => {
    expect(visibleBreak(columns, {})).toBeNull()
    expect(visibleBreak(columns, undefined)).toBeNull()
    expect(visibleBreak([], { "emp-1": lunch })).toBeNull()
  })
})

describe("assignLanes", () => {
  it("splits the width between two overlapping appointments", () => {
    const first = makeAppointment({ id: "a", startTime: at("10:00"), endTime: at("11:00") })
    const second = makeAppointment({ id: "b", startTime: at("10:30"), endTime: at("11:30") })

    const lanes = assignLanes([first, second])

    expect(lanes.map((item) => item.appointment.id)).toEqual(["a", "b"])
    expect(lanes.map((item) => item.lane)).toEqual([0, 1])
    expect(lanes.every((item) => item.lanes === 2)).toBe(true)
  })

  it("gives the full width to chained appointments that only touch", () => {
    const first = makeAppointment({ id: "a", startTime: at("10:00"), endTime: at("11:00") })
    const second = makeAppointment({ id: "b", startTime: at("11:00"), endTime: at("12:00") })

    const lanes = assignLanes([first, second])

    expect(lanes.map((item) => item.lanes)).toEqual([1, 1])
    expect(lanes.map((item) => item.lane)).toEqual([0, 0])
  })

  it("splits three simultaneous appointments in three lanes", () => {
    const appointments = [
      makeAppointment({ id: "a", startTime: at("10:00"), endTime: at("11:00") }),
      makeAppointment({ id: "b", startTime: at("10:00"), endTime: at("10:30") }),
      makeAppointment({ id: "c", startTime: at("10:15"), endTime: at("11:15") }),
    ]

    const lanes = assignLanes(appointments)

    expect(lanes.map((item) => item.lanes)).toEqual([3, 3, 3])
    expect(new Set(lanes.map((item) => item.lane))).toEqual(new Set([0, 1, 2]))
  })

  it("keeps one width for a whole transitive overlap group", () => {
    // A pisa a B, B pisa a C, pero A y C no se tocan: C reutiliza el carril de
    // A y las tres comparten el mismo ancho, sin cambiar de anchura a medias.
    const appointments = [
      makeAppointment({ id: "a", startTime: at("10:00"), endTime: at("11:00") }),
      makeAppointment({ id: "b", startTime: at("10:30"), endTime: at("11:30") }),
      makeAppointment({ id: "c", startTime: at("11:00"), endTime: at("12:00") }),
    ]

    const lanes = assignLanes(appointments)

    expect(lanes.map((item) => item.lane)).toEqual([0, 1, 0])
    expect(lanes.map((item) => item.lanes)).toEqual([2, 2, 2])
  })

  it("keeps a long appointment overlapping the short ones nested under it", () => {
    // El grupo se cierra por el final MAS TARDIO del grupo, no por el ultimo
    // carril ocupado: si se cerrase por el ultimo carril, "c" abriria grupo
    // propio con lanes 1 y se pintaria a ancho completo encima de "a", que
    // sigue en curso.
    const appointments = [
      makeAppointment({ id: "a", startTime: at("10:00"), endTime: at("12:00") }),
      makeAppointment({ id: "b", startTime: at("10:30"), endTime: at("11:00") }),
      makeAppointment({ id: "c", startTime: at("11:00"), endTime: at("11:30") }),
    ]

    const lanes = assignLanes(appointments)

    expect(lanes.map((item) => item.lane)).toEqual([0, 1, 1])
    expect(lanes.map((item) => item.lanes)).toEqual([2, 2, 2])
  })

  it("starts a new group once the overlap chain breaks", () => {
    const appointments = [
      makeAppointment({ id: "a", startTime: at("10:00"), endTime: at("11:00") }),
      makeAppointment({ id: "b", startTime: at("10:30"), endTime: at("11:30") }),
      makeAppointment({ id: "c", startTime: at("15:00"), endTime: at("16:00") }),
    ]

    const lanes = assignLanes(appointments)

    expect(lanes.map((item) => item.lanes)).toEqual([2, 2, 1])
  })

  it("sorts the input by start time", () => {
    const appointments = [
      makeAppointment({ id: "late", startTime: at("15:00"), endTime: at("16:00") }),
      makeAppointment({ id: "early", startTime: at("09:00"), endTime: at("10:00") }),
    ]

    expect(assignLanes(appointments).map((item) => item.appointment.id)).toEqual(["early", "late"])
  })

  it("does not mutate the given array", () => {
    const appointments = [
      makeAppointment({ id: "late", startTime: at("15:00"), endTime: at("16:00") }),
      makeAppointment({ id: "early", startTime: at("09:00"), endTime: at("10:00") }),
    ]

    assignLanes(appointments)

    expect(appointments.map((item) => item.id)).toEqual(["late", "early"])
  })

  it("no adelgaza el dia entero por una sola cita larga", () => {
    // Una formacion o un bloqueo de 08:00 a 21:00 mete a TODAS las citas del
    // dia en su grupo de solape transitivo. Repartiendo el ancho por grupo, la
    // cita de las 19:00 -- que no pisa ni a "b" ni a "c" -- salia a un tercio
    // de ancho (~112px de los ~336 utiles en movil) con el nombre truncado.
    const appointments = [
      makeAppointment({ id: "long", startTime: at("08:00"), endTime: at("21:00") }),
      makeAppointment({ id: "b", startTime: at("09:00"), endTime: at("10:00") }),
      makeAppointment({ id: "c", startTime: at("09:30"), endTime: at("10:30") }),
      makeAppointment({ id: "evening", startTime: at("19:00"), endTime: at("20:00") }),
    ]

    const byId = new Map(assignLanes(appointments).map((item) => [item.appointment.id, item]))

    // Por la manana si hay tres simultaneas: tercio de ancho para las tres.
    expect(byId.get("b")!.lanes).toBe(3)
    expect(byId.get("c")!.lanes).toBe(3)
    // Por la tarde solo estan la larga y esta: media columna, no un tercio.
    expect(byId.get("evening")!.lanes).toBe(2)
    expect(byId.get("evening")!.lane).toBe(1)
  })

  it("cuenta los carriles por el maximo de simultaneas de CADA cita", () => {
    // La de las 10:00 convive con dos a la vez; la de las 12:00, con una sola.
    const appointments = [
      makeAppointment({ id: "a", startTime: at("10:00"), endTime: at("13:00") }),
      makeAppointment({ id: "b", startTime: at("10:15"), endTime: at("10:45") }),
      makeAppointment({ id: "c", startTime: at("10:30"), endTime: at("11:00") }),
      makeAppointment({ id: "d", startTime: at("12:00"), endTime: at("12:30") }),
    ]

    const byId = new Map(assignLanes(appointments).map((item) => [item.appointment.id, item]))

    expect(byId.get("b")!.lanes).toBe(3)
    expect(byId.get("c")!.lanes).toBe(3)
    expect(byId.get("d")!.lanes).toBe(2)
  })

  it("nunca pinta dos citas solapadas una encima de la otra", () => {
    // La invariante que justifica todo este reparto. Un `lanes` por cita no la
    // sostiene por si solo -- 1/4..2/4 y 2/5..3/5 se solapan --, la sostiene la
    // regla de que entre dos citas que se pisan la del carril mas bajo nunca
    // tenga menos carriles. Esta forma la ejercita: sin esa segunda pasada,
    // "i" (carril 1 de 4) y "j" (carril 2 de 5) se pintan una sobre otra.
    const appointments = [
      makeAppointment({ id: "A", startTime: at("09:00"), endTime: at("11:00") }),
      makeAppointment({ id: "i", startTime: at("10:00"), endTime: at("11:00") }),
      makeAppointment({ id: "j", startTime: at("10:30"), endTime: at("13:00") }),
      makeAppointment({ id: "D", startTime: at("10:45"), endTime: at("10:55") }),
      makeAppointment({ id: "m", startTime: at("11:15"), endTime: at("12:00") }),
      makeAppointment({ id: "E", startTime: at("12:00"), endTime: at("12:30") }),
      makeAppointment({ id: "F", startTime: at("12:00"), endTime: at("12:30") }),
      makeAppointment({ id: "G", startTime: at("12:00"), endTime: at("12:30") }),
      makeAppointment({ id: "H", startTime: at("12:00"), endTime: at("12:30") }),
    ]

    const lanes = assignLanes(appointments)

    for (const [first, second] of overlappingPairs(lanes)) {
      const a = horizontalBand(first)
      const b = horizontalBand(second)
      expect(
        a.right <= b.left || b.right <= a.left,
        `${first.appointment.id} y ${second.appointment.id} se pisan: ` +
          `[${a.left}, ${a.right}] vs [${b.left}, ${b.right}]`
      ).toBe(true)
    }
  })

  it("da a cada cita al menos un carril mas que su indice", () => {
    // `lanes >= lane + 1`: sin ello el bloque se saldria de la columna.
    const appointments = [
      makeAppointment({ id: "a", startTime: at("09:00"), endTime: at("21:00") }),
      makeAppointment({ id: "b", startTime: at("10:00"), endTime: at("11:00") }),
      makeAppointment({ id: "c", startTime: at("10:30"), endTime: at("11:30") }),
      makeAppointment({ id: "d", startTime: at("10:45"), endTime: at("11:45") }),
    ]

    for (const item of assignLanes(appointments)) {
      expect(item.lanes).toBeGreaterThanOrEqual(item.lane + 1)
    }
  })

  it("no gasta un carril en una cita que la rejilla no va a pintar", () => {
    // La sonda exacta del defecto. "fuera" cae entera antes de las 08:00, asi
    // que `calculateBlockPosition` devuelve `null` y `AppointmentBlock` no
    // monta nada; "dentro" se recorta a 08:00-09:00 y SI se pinta. Repartiendo
    // por tiempo a secas se solapan, "fuera" se lleva el carril 0 de 2 y el
    // unico bloque VISIBLE del dia salia a media columna, pegado a la derecha
    // y con la mitad izquierda vacia.
    const appointments = [
      makeAppointment({ id: "fuera", startTime: at("06:00"), endTime: at("07:30") }),
      makeAppointment({ id: "dentro", startTime: at("06:30"), endTime: at("09:00") }),
    ]

    expect(calculateBlockPosition(at("06:00"), at("07:30"))).toBeNull()

    const lanes = assignLanes(appointments)

    // El bloque visible se queda la columna ENTERA: un solo carril de uno.
    const painted = lanes.find((item) => item.appointment.id === "dentro")
    expect(painted).toMatchObject({ lane: 0, lanes: 1 })
    // Y la invisible ni siquiera aparece: no hay nada que pintar.
    expect(lanes.map((item) => item.appointment.id)).toEqual(["dentro"])
  })

  it("no reparte carril a una cita de duracion cero, que tampoco se pinta", () => {
    // La invariante escrita en `resolveLaneCounts` es `lanes >= lane + 1`, y
    // una cita de tramo vacio la rompia: `peakConcurrency` mira los arranques
    // que caen en `[start, end)`, que con `start === end` no contiene ninguno,
    // asi que "cero" salia con `lane 2` y `lanes 0`. Tampoco se pinta -- el
    // mismo `calculateBlockPosition` la descarta --, asi que no llega al
    // reparto y la invariante se sostiene sobre lo que de verdad se cumple.
    const appointments = [
      makeAppointment({ id: "larga", startTime: at("08:30"), endTime: at("10:00") }),
      makeAppointment({ id: "otra", startTime: at("08:45"), endTime: at("09:30") }),
      makeAppointment({ id: "cero", startTime: at("09:00"), endTime: at("09:00") }),
    ]

    expect(calculateBlockPosition(at("09:00"), at("09:00"))).toBeNull()

    const lanes = assignLanes(appointments)

    // Primero la invariante, que es lo que "cero" rompia: sin filtro sale con
    // `lane 2` y `lanes 0`.
    for (const item of lanes) {
      expect(item.lanes).toBeGreaterThanOrEqual(item.lane + 1)
    }
    expect(lanes.map((item) => item.appointment.id)).toEqual(["larga", "otra"])
  })

  it("returns nothing for a day with no appointments", () => {
    expect(assignLanes([])).toEqual([])
  })
})

/** Los pares de citas que comparten alguna franja de tiempo. */
function overlappingPairs(lanes: LaneAssignment[]): [LaneAssignment, LaneAssignment][] {
  const pairs: [LaneAssignment, LaneAssignment][] = []

  for (let i = 0; i < lanes.length; i++) {
    for (let j = i + 1; j < lanes.length; j++) {
      const a = lanes[i].appointment
      const b = lanes[j].appointment
      if (a.startTime < b.endTime && b.startTime < a.endTime) pairs.push([lanes[i], lanes[j]])
    }
  }

  return pairs
}

/** La banda horizontal que ocupa el bloque, en fraccion de columna. */
function horizontalBand(item: LaneAssignment): { left: number; right: number } {
  return { left: item.lane / item.lanes, right: (item.lane + 1) / item.lanes }
}
