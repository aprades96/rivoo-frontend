import { describe, it, expect } from "vitest"
import { getTodayStats, getNowRows, getPendingOnline } from "./today-facts"
import type { Appointment, AppointmentStatus, AppointmentSource } from "@/types/appointment"
import type { Employee, WorkingHoursResponse } from "@/types/employee"

// 2026-08-26 es miercoles -> dayOfWeek 3 en el convenio de
// `WorkingHoursResponse` (lunes = 1 ... domingo = 7).
const DAY = "2026-08-26"
const NOW = new Date(2026, 7, 26, 11, 0, 0) // 11:00

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp_1",
    firstName: "Laura",
    lastName: "Martinez",
    email: "laura@test.com",
    phone: null,
    jobTitle: "Estilista",
    colorHex: "#3B82F6",
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "apt_1",
    tenantId: "tenant_1",
    clientId: "cli_1",
    clientName: "Ana Garcia",
    clientPhone: null,
    clientEmail: null,
    employeeId: "emp_1",
    employeeName: "Laura Martinez",
    serviceId: "svc_1",
    serviceName: "Corte",
    servicePrice: 30,
    serviceDurationMinutes: 30,
    startTime: `${DAY}T10:00:00`,
    endTime: `${DAY}T10:30:00`,
    status: "CONFIRMED" as AppointmentStatus,
    source: "ONLINE" as AppointmentSource,
    notes: null,
    reminderSent: false,
    createdAt: `${DAY}T08:00:00`,
    updatedAt: `${DAY}T08:00:00`,
    ...overrides,
  }
}

function makeHours(overrides: Partial<WorkingHoursResponse> = {}): WorkingHoursResponse {
  return {
    dayOfWeek: 3,
    isOpen: true,
    openTime: "09:00:00",
    closeTime: "20:00:00",
    breakStartTime: null,
    breakEndTime: null,
    ...overrides,
  }
}

describe("getTodayStats", () => {
  it("excludes CANCELLED and NO_SHOW from total and expectedRevenue (D7/D8)", () => {
    const appointments = [
      makeAppointment({ id: "a1", status: "PENDING", servicePrice: 50 }),
      makeAppointment({ id: "a2", status: "CONFIRMED", servicePrice: 30 }),
      makeAppointment({ id: "a3", status: "CANCELLED", servicePrice: 100 }),
      makeAppointment({ id: "a4", status: "NO_SHOW", servicePrice: 40 }),
    ]

    const stats = getTodayStats(appointments)

    expect(stats.total).toBe(2)
    expect(stats.expectedRevenue).toBe(80)
  })

  it("counts pending and completed by status", () => {
    const appointments = [
      makeAppointment({ id: "a1", status: "PENDING" }),
      makeAppointment({ id: "a2", status: "PENDING" }),
      makeAppointment({ id: "a3", status: "COMPLETED" }),
      makeAppointment({ id: "a4", status: "CONFIRMED" }),
    ]

    const stats = getTodayStats(appointments)

    expect(stats.pending).toBe(2)
    expect(stats.completed).toBe(1)
  })

  it("returns all zeros for an empty list", () => {
    expect(getTodayStats([])).toEqual({ total: 0, pending: 0, completed: 0, expectedRevenue: 0 })
  })
})

describe("getPendingOnline", () => {
  it("keeps only PENDING appointments booked ONLINE (D22)", () => {
    const appointments = [
      makeAppointment({ id: "a1", status: "PENDING", source: "ONLINE" }),
      // PENDING es el estado inicial de TODAS las citas, tambien las de
      // mostrador -- no basta con filtrar por estado.
      makeAppointment({ id: "a2", status: "PENDING", source: "MANUAL" }),
      makeAppointment({ id: "a3", status: "CONFIRMED", source: "ONLINE" }),
    ]

    const result = getPendingOnline(appointments)

    expect(result.map((a) => a.id)).toEqual(["a1"])
  })
})

describe("getNowRows", () => {
  it("gives a busy row, with 'until', for an appointment overlapping now -- CONFIRMED, not IN_PROGRESS (D37)", () => {
    const employee = makeEmployee({ id: "emp_1" })
    const appointment = makeAppointment({
      employeeId: "emp_1",
      clientName: "Ana Garcia",
      serviceName: "Corte",
      status: "CONFIRMED",
      startTime: `${DAY}T10:30:00`,
      endTime: `${DAY}T11:30:00`,
    })

    const rows = getNowRows([appointment], [employee], { emp_1: [makeHours()] }, NOW)

    expect(rows).toEqual([
      { kind: "busy", employee, clientName: "Ana Garcia", serviceName: "Corte", until: "11:30" },
    ])
  })

  it("half-open interval: an appointment starting exactly at now counts as busy (start inclusive)", () => {
    const employee = makeEmployee({ id: "emp_1b" })
    const appointment = makeAppointment({
      employeeId: "emp_1b",
      startTime: `${DAY}T11:00:00`,
      endTime: `${DAY}T11:30:00`,
    })

    const rows = getNowRows([appointment], [employee], { emp_1b: [makeHours()] }, NOW)

    expect(rows).toEqual([
      { kind: "busy", employee, clientName: "Ana Garcia", serviceName: "Corte", until: "11:30" },
    ])
  })

  it("half-open interval: an appointment ending exactly at now does NOT count as busy (end exclusive)", () => {
    const employee = makeEmployee({ id: "emp_1c" })
    const appointment = makeAppointment({
      employeeId: "emp_1c",
      startTime: `${DAY}T10:00:00`,
      endTime: `${DAY}T11:00:00`,
    })

    const rows = getNowRows([appointment], [employee], { emp_1c: [makeHours()] }, NOW)

    // Ya termino y no hay proxima cita -> libre hasta el cierre, no ocupado.
    expect(rows).toEqual([{ kind: "free", employee, freeFor: "9h" }])
  })

  it("gives a free row measured until the next appointment when there is one (D19)", () => {
    const employee = makeEmployee({ id: "emp_2" })
    const next = makeAppointment({
      employeeId: "emp_2",
      clientName: "Marc Soler",
      startTime: `${DAY}T13:00:00`,
      endTime: `${DAY}T13:30:00`,
    })

    const rows = getNowRows([next], [employee], { emp_2: [makeHours()] }, NOW)

    expect(rows).toEqual([
      {
        kind: "free",
        employee,
        freeFor: "2h",
        next: { time: "13:00", clientName: "Marc Soler" },
      },
    ])
  })

  it("gives a free row measured until closeTime, without 'next', when there are no more appointments (D19/D20)", () => {
    const employee = makeEmployee({ id: "emp_3" })

    const rows = getNowRows([], [employee], { emp_3: [makeHours({ closeTime: "14:00:00" })] }, NOW)

    expect(rows).toEqual([{ kind: "free", employee, freeFor: "3h" }])
  })

  it("gives an 'off' row for an employee who does not work today (D18)", () => {
    const employee = makeEmployee({ id: "emp_4" })

    const rows = getNowRows([], [employee], { emp_4: [makeHours({ isOpen: false })] }, NOW)

    expect(rows).toEqual([{ kind: "off", employee }])
  })

  it("gives a busy row for an appointment overlapping now even when isOpen is false (off/busy precedence)", () => {
    const employee = makeEmployee({ id: "emp_4b" })
    const overlapping = makeAppointment({
      employeeId: "emp_4b",
      clientName: "Laura Gomez",
      serviceName: "Manicura",
      startTime: `${DAY}T10:30:00`,
      endTime: `${DAY}T11:30:00`,
    })

    const rows = getNowRows(
      [overlapping],
      [employee],
      { emp_4b: [makeHours({ isOpen: false })] },
      NOW
    )

    // La cita en curso gana sobre "hoy no trabaja" -- misma jerarquia que
    // D19 corregido aplica al horario declarado: es evidencia mas dura
    // sobre AHORA que un horario (o su ausencia) configurado de antemano.
    expect(rows).toEqual([
      { kind: "busy", employee, clientName: "Laura Gomez", serviceName: "Manicura", until: "11:30" },
    ])
  })

  it("omits an employee whose shift already ended", () => {
    const employee = makeEmployee({ id: "emp_5" })

    const rows = getNowRows(
      [],
      [employee],
      { emp_5: [makeHours({ openTime: "08:00:00", closeTime: "10:00:00" })] },
      NOW
    )

    expect(rows).toEqual([])
  })

  it("omits an employee whose shift has not opened yet", () => {
    const employee = makeEmployee({ id: "emp_5b" })

    const rows = getNowRows(
      [],
      [employee],
      { emp_5b: [makeHours({ openTime: "13:00:00", closeTime: "20:00:00" })] },
      NOW
    )

    expect(rows).toEqual([])
  })

  it("a CANCELLED appointment overlapping now does NOT make the employee busy, nor can it be their next", () => {
    const employee = makeEmployee({ id: "emp_6" })
    const overlapping = makeAppointment({
      id: "a1",
      employeeId: "emp_6",
      status: "CANCELLED",
      startTime: `${DAY}T10:30:00`,
      endTime: `${DAY}T11:30:00`,
    })
    const laterCancelled = makeAppointment({
      id: "a2",
      employeeId: "emp_6",
      status: "CANCELLED",
      startTime: `${DAY}T12:00:00`,
      endTime: `${DAY}T12:30:00`,
    })

    const rows = getNowRows(
      [overlapping, laterCancelled],
      [employee],
      { emp_6: [makeHours({ closeTime: "15:00:00" })] },
      NOW
    )

    // Nadie ocupa a este empleado y no tiene proxima cita viva -> libre
    // hasta el cierre, sin "next".
    expect(rows).toEqual([{ kind: "free", employee, freeFor: "4h" }])
  })

  it("caps the free gap at closeTime when the next appointment is scheduled after closing", () => {
    const employee = makeEmployee({ id: "emp_7" })
    const next = makeAppointment({
      employeeId: "emp_7",
      clientName: "Cliente Tardio",
      startTime: `${DAY}T16:00:00`,
      endTime: `${DAY}T16:30:00`,
    })

    const rows = getNowRows(
      [next],
      [employee],
      { emp_7: [makeHours({ openTime: "09:00:00", closeTime: "14:00:00" })] },
      NOW
    )

    expect(rows).toEqual([
      {
        kind: "free",
        employee,
        freeFor: "3h",
        next: { time: "16:00", clientName: "Cliente Tardio" },
      },
    ])
  })

  it("gives a busy row for an appointment overlapping now even when the shift already closed (D19 corrected)", () => {
    const employee = makeEmployee({ id: "emp_12" })
    const overlapping = makeAppointment({
      employeeId: "emp_12",
      clientName: "Cliente Tardio",
      serviceName: "Tinte",
      startTime: `${DAY}T10:30:00`,
      endTime: `${DAY}T11:30:00`,
    })

    const rows = getNowRows(
      [overlapping],
      [employee],
      { emp_12: [makeHours({ openTime: "08:00:00", closeTime: "10:00:00" })] },
      NOW
    )

    // La cita en curso gana sobre el horario declarado: sigue "busy" aunque
    // el cierre (10:00) ya haya pasado respecto a `now` (11:00).
    expect(rows).toEqual([
      { kind: "busy", employee, clientName: "Cliente Tardio", serviceName: "Tinte", until: "11:30" },
    ])
  })

  it("still omits the employee when the shift already closed and there is no appointment overlapping now (D19 unchanged)", () => {
    const employee = makeEmployee({ id: "emp_13" })

    const rows = getNowRows(
      [],
      [employee],
      { emp_13: [makeHours({ openTime: "08:00:00", closeTime: "10:00:00" })] },
      NOW
    )

    expect(rows).toEqual([])
  })

  describe("unresolved schedule (employee absent from the map)", () => {
    it("busy branch: an appointment overlapping now still produces 'busy'", () => {
      const employee = makeEmployee({ id: "emp_8" })
      const appointment = makeAppointment({
        employeeId: "emp_8",
        startTime: `${DAY}T10:30:00`,
        endTime: `${DAY}T11:30:00`,
      })

      const rows = getNowRows([appointment], [employee], {}, NOW)

      expect(rows).toEqual([
        { kind: "busy", employee, clientName: "Ana Garcia", serviceName: "Corte", until: "11:30" },
      ])
    })

    it("free branch: no appointment now but one later today -- gap measured to it, no closeTime cap available", () => {
      const employee = makeEmployee({ id: "emp_9" })
      const next = makeAppointment({
        employeeId: "emp_9",
        clientName: "Marc Soler",
        startTime: `${DAY}T13:00:00`,
        endTime: `${DAY}T13:30:00`,
      })

      const rows = getNowRows([next], [employee], {}, NOW)

      expect(rows).toEqual([
        {
          kind: "free",
          employee,
          freeFor: "2h",
          next: { time: "13:00", clientName: "Marc Soler" },
        },
      ])
    })

    it("no-row branch: neither a current nor a future appointment -- omitted, and NEVER 'off'", () => {
      const employee = makeEmployee({ id: "emp_10" })

      const rows = getNowRows([], [employee], {}, NOW)

      expect(rows).toEqual([])
    })
  })

  it("treats isOpen: true with a null closeTime as unresolved, not as an infinite shift", () => {
    const employee = makeEmployee({ id: "emp_11" })
    const appointment = makeAppointment({
      employeeId: "emp_11",
      startTime: `${DAY}T10:30:00`,
      endTime: `${DAY}T11:30:00`,
    })
    const brokenHours = makeHours({ closeTime: null as unknown as string })

    const rows = getNowRows([appointment], [employee], { emp_11: [brokenHours] }, NOW)

    expect(rows).toEqual([
      { kind: "busy", employee, clientName: "Ana Garcia", serviceName: "Corte", until: "11:30" },
    ])
  })

  it("treats isOpen: true with a null closeTime as unresolved, without a current appointment, without crashing", () => {
    const employee = makeEmployee({ id: "emp_11b" })
    const brokenHours = makeHours({ closeTime: null as unknown as string })

    // Sin cita en curso: esta es la unica forma de ejercer de verdad la
    // guarda de `classifyShift` -- si hubiera una cita en curso, `current`
    // se resolveria antes de llegar a `timeOnSameDay` y el test pasaria
    // igual con o sin la guarda.
    const rows = getNowRows([], [employee], { emp_11b: [brokenHours] }, NOW)

    expect(rows).toEqual([])
  })

  it("treats isOpen: true with a null openTime as unresolved, without a current appointment, without crashing", () => {
    const employee = makeEmployee({ id: "emp_11c" })
    const brokenHours = makeHours({ openTime: null as unknown as string })

    const rows = getNowRows([], [employee], { emp_11c: [brokenHours] }, NOW)

    expect(rows).toEqual([])
  })

  describe("hoursLoading: N working-hours requests still in flight", () => {
    it("an appointment overlapping now still produces 'busy' while hours are loading", () => {
      const employee = makeEmployee({ id: "emp_15" })
      const overlapping = makeAppointment({
        employeeId: "emp_15",
        startTime: `${DAY}T10:30:00`,
        endTime: `${DAY}T11:30:00`,
      })

      const rows = getNowRows([overlapping], [employee], {}, NOW, true)

      expect(rows).toEqual([
        { kind: "busy", employee, clientName: "Ana Garcia", serviceName: "Corte", until: "11:30" },
      ])
    })

    it("an employee with only a future appointment produces no row while hours are loading (no free-gap guess)", () => {
      const employee = makeEmployee({ id: "emp_16" })
      const next = makeAppointment({
        employeeId: "emp_16",
        startTime: `${DAY}T18:00:00`,
        endTime: `${DAY}T18:30:00`,
      })

      const rows = getNowRows([next], [employee], {}, NOW, true)

      expect(rows).toEqual([])
    })
  })

  it("orders busy first, then free by DESCENDING gap, then off (D37)", () => {
    const busyEmployee = makeEmployee({ id: "emp_busy", firstName: "Busy" })
    const bigGapEmployee = makeEmployee({ id: "emp_big", firstName: "BigGap" })
    const smallGapEmployee = makeEmployee({ id: "emp_small", firstName: "SmallGap" })
    const offEmployee = makeEmployee({ id: "emp_off", firstName: "Off" })

    const busyAppointment = makeAppointment({
      employeeId: "emp_busy",
      startTime: `${DAY}T10:30:00`,
      endTime: `${DAY}T11:30:00`,
    })
    // 1h de hueco (hasta las 12:00).
    const smallGapNext = makeAppointment({
      employeeId: "emp_small",
      clientName: "Cliente Small",
      startTime: `${DAY}T12:00:00`,
      endTime: `${DAY}T12:30:00`,
    })
    // 3h de hueco (hasta las 14:00).
    const bigGapNext = makeAppointment({
      employeeId: "emp_big",
      clientName: "Cliente Big",
      startTime: `${DAY}T14:00:00`,
      endTime: `${DAY}T14:30:00`,
    })

    const rows = getNowRows(
      [busyAppointment, smallGapNext, bigGapNext],
      // Orden de llegada deliberadamente distinto al orden esperado de
      // salida, para no confundir "estable" con "ordenado por hueco".
      [offEmployee, smallGapEmployee, bigGapEmployee, busyEmployee],
      {
        emp_busy: [makeHours()],
        emp_small: [makeHours()],
        emp_big: [makeHours()],
        emp_off: [makeHours({ isOpen: false })],
      },
      NOW
    )

    expect(rows.map((r) => r.employee.id)).toEqual(["emp_busy", "emp_big", "emp_small", "emp_off"])
    expect(rows[1]).toMatchObject({ kind: "free", freeFor: "3h" })
    expect(rows[2]).toMatchObject({ kind: "free", freeFor: "1h" })
  })
})
