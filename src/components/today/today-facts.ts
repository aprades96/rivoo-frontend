// Derivacion PURA de los hechos que pintan la pantalla "Hoy"
// (`design/Main.dc.html`, `design/HoyDesktop.dc.html`). Cero JSX aqui: la
// pantalla decide donde y con que icono pinta cada dato, este modulo solo
// calcula los datos (precedente: `appointment-detail-facts.ts`).

import type { Appointment, AppointmentStatus } from "@/types/appointment"
import type { Employee, WorkingHoursResponse } from "@/types/employee"
import { formatTime, formatDurationTight, todayDayOfWeek } from "@/lib/utils/dates"
import { parseISO } from "date-fns"

export interface TodayStats {
  total: number
  pending: number
  completed: number
  expectedRevenue: number
}

export type NowRow =
  | { kind: "busy"; employee: Employee; clientName: string; serviceName: string; until: string }
  | {
      kind: "free"
      employee: Employee
      freeFor: string
      next?: { time: string; clientName: string }
    }
  | { kind: "off"; employee: Employee }

// D7/D8/D37: una cita cancelada, o a la que el cliente no se presento, no es
// "una cita de hoy" en ningun sentido util -- ni cuenta, ni factura, ni ocupa
// a nadie, ni puede ser el "next" de nadie. Mismo precedente que el contador
// mensual del backend (`AppointmentPersistenceAdapter.java:21-22`,
// `EXCLUDED_STATUSES`).
const EXCLUDED_STATUSES: readonly AppointmentStatus[] = ["CANCELLED", "NO_SHOW"]

function isLive(status: AppointmentStatus): boolean {
  return !EXCLUDED_STATUSES.includes(status)
}

// D7/D8: excluye CANCELLED/NO_SHOW tanto de `total` como de `expectedRevenue`
// -- `servicePrice` es una instantanea inmutable escrita en la propia cita
// (D8), cero peticiones extra. `pending`/`completed` leen directamente el
// estado ("Pendientes de confirmar" / "Completadas", `HoyDesktop.dc.html:98,102`).
export function getTodayStats(appointments: Appointment[]): TodayStats {
  let total = 0
  let pending = 0
  let completed = 0
  let expectedRevenue = 0

  for (const appointment of appointments) {
    if (!isLive(appointment.status)) continue

    total += 1
    expectedRevenue += appointment.servicePrice
    if (appointment.status === "PENDING") pending += 1
    if (appointment.status === "COMPLETED") completed += 1
  }

  return { total, pending, completed, expectedRevenue }
}

// D22: `?status=PENDING` a secas no vale -- PENDING es el estado inicial de
// TODAS las citas, tambien las de mostrador. Solo la reserva online sin
// confirmar todavia entra aqui.
export function getPendingOnline(appointments: Appointment[]): Appointment[] {
  return appointments.filter((a) => a.status === "PENDING" && a.source === "ONLINE")
}

type ShiftClassification =
  | { kind: "off" }
  | { kind: "unresolved" }
  | { kind: "shift"; openTime: string; closeTime: string }

/**
 * Resuelve si el empleado trabaja hoy, y con que jornada, a partir de SU
 * entrada del mapa `hoursByEmployee` para el `dayOfWeek` de hoy.
 *
 * "unresolved" cubre DOS causas that el llamante no puede distinguir entre
 * si -- el empleado todavia no esta en el mapa (peticion en vuelo) o su
 * peticion fallo para siempre (`useEmployeesWorkingHours`,
 * `use-staff.ts:73-74`, deja fuera del mapa a quien falla) -- y TAMBIEN el
 * caso `isOpen: true` con `openTime`/`closeTime` nulos: el tipo los declara
 * `string` no nulables, pero el backend escribe `null` los dias cerrados
 * (`EmployeeService.java:305`) y aqui puede llegar igual de nulo si el
 * horario no se resolvio bien. Sin horas no hay jornada que sostener -- se
 * trata como sin resolver, nunca como jornada infinita ni como "hoy no
 * trabaja".
 */
function classifyShift(
  hours: WorkingHoursResponse[] | undefined,
  dayOfWeek: number
): ShiftClassification {
  if (!hours) return { kind: "unresolved" }

  const today = hours.find((h) => h.dayOfWeek === dayOfWeek)
  if (!today) return { kind: "unresolved" }
  if (!today.isOpen) return { kind: "off" }
  if (!today.openTime || !today.closeTime) return { kind: "unresolved" }

  return { kind: "shift", openTime: today.openTime, closeTime: today.closeTime }
}

function findCurrentAppointment(appointments: Appointment[], now: Date): Appointment | undefined {
  const time = now.getTime()
  return appointments.find((a) => {
    const start = parseISO(a.startTime).getTime()
    const end = parseISO(a.endTime).getTime()
    return start <= time && time < end
  })
}

function findNextAppointment(appointments: Appointment[], now: Date): Appointment | undefined {
  const time = now.getTime()
  return appointments
    .filter((a) => parseISO(a.startTime).getTime() > time)
    .sort((a, b) => parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime())[0]
}

function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000))
}

// `openTime`/`closeTime` son `LocalTime` ("09:00:00"), no instantes -- se
// combinan con el dia de `reference` (siempre `now`, mismo dia que las citas)
// para poder compararlos con `Date`s reales.
function timeOnSameDay(reference: Date, time: string): Date {
  const [hours, minutes, seconds] = time.split(":").map(Number)
  const result = new Date(reference)
  result.setHours(hours, minutes, seconds ?? 0, 0)
  return result
}

function busyRow(employee: Employee, appointment: Appointment): NowRow {
  return {
    kind: "busy",
    employee,
    clientName: appointment.clientName,
    serviceName: appointment.serviceName,
    until: formatTime(appointment.endTime),
  }
}

// D20: sin proxima cita no hay nada que decir en "Siguiente: ..." -- se omite
// el campo entero en vez de inventar una frase que el artboard no dibuja.
function freeRow(employee: Employee, freeMinutes: number, next: Appointment | undefined): NowRow {
  return {
    kind: "free",
    employee,
    freeFor: formatDurationTight(freeMinutes),
    ...(next ? { next: { time: formatTime(next.startTime), clientName: next.clientName } } : {}),
  }
}

/**
 * Las filas del panel "Ahora" (D18-D22, D37).
 *
 * Orden: ocupados -> libres por hueco DESCENDENTE (mas hueco primero) -> "hoy
 * no trabaja" -- el orden que dibujan los dos artboards
 * (`design/Main.dc.html:88,101`, `design/HoyDesktop.dc.html:205,218`).
 *
 * "Ocupado" es solape con el reloj (`startTime <= now < endTime`), NUNCA
 * `status === "IN_PROGRESS"`: ese estado solo se pone a mano (`PUT
 * /status`), asi que un salon que no lo use -- la mayoria -- tendria el panel
 * permanentemente sin nadie "En curso".
 *
 * `now` se inyecta siempre -- nunca se lee `new Date()` aqui dentro (mismo
 * criterio que `formatRelativeTime`, `dates.ts:70`).
 *
 * D19 (corregido): solo las filas "free" exigen jornada abierta -- una cita
 * en curso produce "busy" incluso fuera de horario declarado, o con
 * `isOpen: false`, porque es evidencia mas dura sobre el presente que una
 * jornada configurada de antemano.
 *
 * `hoursLoading` (opcional, default `false`): mientras las peticiones de
 * horario todavia estan en vuelo, la rama "unresolved" solo produce filas
 * "busy", nunca "free" -- un hueco libre medido sin cierre conocido es una
 * suposicion que este panel no pinta en ningun otro sitio.
 */
export function getNowRows(
  appointments: Appointment[],
  employees: Employee[],
  hoursByEmployee: Record<string, WorkingHoursResponse[]>,
  now: Date,
  hoursLoading: boolean = false
): NowRow[] {
  const dayOfWeek = todayDayOfWeek(now)
  const entries: { row: NowRow; group: 0 | 1 | 2; freeMinutes: number }[] = []

  for (const employee of employees) {
    const classification = classifyShift(hoursByEmployee[employee.id], dayOfWeek)

    const activeAppointments = appointments.filter(
      (a) => a.employeeId === employee.id && isLive(a.status)
    )
    const current = findCurrentAppointment(activeAppointments, now)

    if (classification.kind === "off") {
      // Misma jerarquia que la rama "shift" de abajo (commit 3b82a68): una
      // cita EN CURSO es evidencia mas dura sobre AHORA que "hoy no
      // trabaja" declarado en el horario -- que puede haberse marcado
      // DESPUES de reservar, o directamente nunca haberse validado al
      // reservar (`AppointmentService.java:71-118` no comprueba horario
      // laboral). `current` se mira ANTES del `continue` de "off" por la
      // misma razon que se mira antes del cierre en la rama "shift".
      if (current) {
        entries.push({ row: busyRow(employee, current), group: 0, freeMinutes: 0 })
        continue
      }
      entries.push({ row: { kind: "off", employee }, group: 2, freeMinutes: 0 })
      continue
    }

    if (classification.kind === "unresolved") {
      // Horario sin resolver: solo produce fila si se sostiene con las
      // citas, que es lo unico que si sabemos. Sin cierre que respetar, el
      // hueco libre se mide solo hasta la proxima cita -- y sin proxima cita
      // tampoco hay fila (ni "off": eso significaria "hoy no trabaja", algo
      // que aqui no sabemos).
      if (current) {
        entries.push({ row: busyRow(employee, current), group: 0, freeMinutes: 0 })
        continue
      }

      // Con las N peticiones de horario todavia en vuelo, un hueco libre
      // medido solo hasta la proxima cita (sin cierre que lo acote) es una
      // suposicion -- se pintaria "Libre 7h" para pasar a "Libre 3h" en
      // cuanto llegue el horario real. Sin horario no hay suposicion segura
      // que mostrar como "free"; "busy" si vale, porque esa cita solapa el
      // reloj y eso se sabe sin horarios.
      if (hoursLoading) continue

      const next = findNextAppointment(activeAppointments, now)
      if (!next) continue

      const freeMinutes = minutesBetween(now, parseISO(next.startTime))
      entries.push({ row: freeRow(employee, freeMinutes, next), group: 1, freeMinutes })
      continue
    }

    // classification.kind === "shift": jornada conocida. Una cita EN CURSO
    // gana siempre sobre el horario declarado, este dentro o fuera de la
    // jornada -- es evidencia mas dura sobre lo que pasa AHORA que un
    // horario que alguien configuro una vez, y un panel titulado "Ahora
    // mismo" que calle a quien esta con un cliente a las 20:00 con cierre a
    // las 18:00 miente por omision (mismo fallo que D18 corrige por el otro
    // lado). Por eso `current` se comprueba ANTES que la ventana horaria:
    // la guarda de jornada solo protege las filas "free", nunca las "busy"
    // (D19 corregido).
    if (current) {
      entries.push({ row: busyRow(employee, current), group: 0, freeMinutes: 0 })
      continue
    }

    // Fuera de la jornada -- todavia sin abrir o ya cerrada -- y SIN cita en
    // curso, el empleado no produce fila (distinto de "off", que es "hoy no
    // trabaja").
    const openAt = timeOnSameDay(now, classification.openTime)
    const closeAt = timeOnSameDay(now, classification.closeTime)
    if (now.getTime() < openAt.getTime() || now.getTime() >= closeAt.getTime()) {
      continue
    }

    // D19: el hueco se acota tambien por el cierre -- min(proxima cita, closeTime).
    const next = findNextAppointment(activeAppointments, now)
    const nextStart = next ? parseISO(next.startTime) : undefined
    const boundary = nextStart && nextStart.getTime() < closeAt.getTime() ? nextStart : closeAt
    const freeMinutes = minutesBetween(now, boundary)
    entries.push({ row: freeRow(employee, freeMinutes, next), group: 1, freeMinutes })
  }

  // Sort estable: dentro de "libres", descendente por hueco (mas hueco
  // primero); "ocupados" y "off" conservan el orden de llegada.
  entries.sort((a, b) => {
    if (a.group !== b.group) return a.group - b.group
    if (a.group === 1) return b.freeMinutes - a.freeMinutes
    return 0
  })

  return entries.map((entry) => entry.row)
}
