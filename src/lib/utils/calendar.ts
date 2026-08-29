import { parseISO, differenceInMinutes, format, addDays, subDays, isSameDay } from "date-fns"
import { getTodayBusinessHours, formatTimeOfDay } from "@/lib/utils/business-hours"
import type { Appointment } from "@/types/appointment"
import type { Employee, WorkingHoursResponse } from "@/types/employee"

export const GRID_START_HOUR = 8
export const GRID_END_HOUR = 21
export const SLOT_MINUTES = 30
export const TOTAL_SLOTS = (GRID_END_HOUR - GRID_START_HOUR) * (60 / SLOT_MINUTES) // 26 slots
export const SLOT_HEIGHT_PX = 48

/**
 * El canalon que separa dos bloques consecutivos: el alto pintado es la
 * duracion menos 4px, no la duracion entera. Medido en los ocho bloques de
 * `design/CalendarioDesktop.dc.html` (60min -> 92px, 90min -> 140px, 45min ->
 * 68px, 30min -> 44px) y visible en el par `:225` (acaba en 380) / `:230`
 * (empieza en 384). Sin el, dos citas encadenadas se pintan pegadas y el ojo
 * no distingue donde acaba una y empieza la siguiente.
 */
export const BLOCK_GUTTER_PX = 4

/**
 * Generate time labels for the grid: ["08:00", "08:30", "09:00", ...]
 */
export function generateTimeLabels(): string[] {
  const labels: string[] = []
  for (let h = GRID_START_HOUR; h < GRID_END_HOUR; h++) {
    labels.push(`${String(h).padStart(2, "0")}:00`)
    labels.push(`${String(h).padStart(2, "0")}:30`)
  }
  return labels
}

/**
 * Calculate top position (px) and height (px) for an appointment block.
 * Returns null if the appointment is outside the visible grid.
 *
 * El alto lleva descontado `BLOCK_GUTTER_PX`, salvo cuando eso lo dejaria por
 * debajo del suelo de medio slot (24px), que es lo que necesita el bloque
 * para que quepa el nombre del cliente.
 */
export function calculateBlockPosition(
  startTime: string,
  endTime: string
): { top: number; height: number } | null {
  const start = parseISO(startTime)
  const end = parseISO(endTime)

  const gridStartMinutes = GRID_START_HOUR * 60
  const gridEndMinutes = GRID_END_HOUR * 60

  const startMinutes = start.getHours() * 60 + start.getMinutes()
  const endMinutes = end.getHours() * 60 + end.getMinutes()

  // Clamp to grid bounds
  const clampedStart = Math.max(startMinutes, gridStartMinutes)
  const clampedEnd = Math.min(endMinutes, gridEndMinutes)

  if (clampedStart >= clampedEnd) return null

  const pixelsPerMinute = SLOT_HEIGHT_PX / SLOT_MINUTES
  const top = (clampedStart - gridStartMinutes) * pixelsPerMinute
  const height = (clampedEnd - clampedStart) * pixelsPerMinute - BLOCK_GUTTER_PX

  return { top, height: Math.max(height, SLOT_HEIGHT_PX / 2) } // min height = half slot
}

/**
 * Format a date for navigation display
 */
export function formatNavDate(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

export function nextDay(date: Date): Date {
  return addDays(date, 1)
}

export function prevDay(date: Date): Date {
  return subDays(date, 1)
}

/** Minutos transcurridos desde medianoche, en la zona local del navegador. */
function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/** "13:00" -> 780. */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":")
  return Number(hours) * 60 + Number(minutes)
}

/** 780 -> "13:00". */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
}

/** Fecha local + "HH:mm" -> el string ISO local que consume `parseISO`. */
function localIso(date: Date, time: string): string {
  return `${format(date, "yyyy-MM-dd")}T${time}:00`
}

// --- Columnas por empleado -------------------------------------------------

/**
 * Una columna de la rejilla de escritorio. `employeeId === null` marca la
 * columna "Otros" (ver `groupByEmployee`), que no corresponde a ningun
 * empleado de la lista: sus bloques se etiquetan con el `employeeName` que
 * trae cada cita.
 */
export interface EmployeeColumn {
  employeeId: string | null
  label: string
  employee: Employee | null
  appointments: Appointment[]
}

const ORPHAN_COLUMN_LABEL = "Otros"

function byStartTime(a: Appointment, b: Appointment): number {
  return parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime()
}

/**
 * Reparte las citas del dia en una columna por empleado ACTIVO, en el orden en
 * que llega `employees` y conservando las columnas vacias: el artboard dibuja
 * la columna aunque el empleado no tenga ninguna cita
 * (`design/CalendarioDesktop.dc.html:210-235`).
 *
 * Cierra con una columna "Otros" cuando alguna cita apunta a un empleado que
 * no esta en la lista. No es un caso teorico: `useEmployees` solo trae los
 * activos y `staffApi.listEmployees` no pagina, asi que la cita de un empleado
 * dado de baja hoy desapareceria de la pantalla sin que nada lo indicase. Una
 * columna fea es preferible a una cita invisible. Si no hay huerfanas, la
 * columna no se crea.
 */
export function groupByEmployee(
  appointments: Appointment[],
  employees: Employee[]
): EmployeeColumn[] {
  const columns: EmployeeColumn[] = employees
    .filter((employee) => employee.isActive)
    .map((employee) => ({
      employeeId: employee.id,
      label: `${employee.firstName} ${employee.lastName}`.trim(),
      employee,
      appointments: [],
    }))

  const byId = new Map(columns.map((column) => [column.employeeId, column]))
  const orphans: Appointment[] = []

  for (const appointment of appointments) {
    const column = byId.get(appointment.employeeId)
    if (column) column.appointments.push(appointment)
    else orphans.push(appointment)
  }

  for (const column of columns) column.appointments.sort(byStartTime)

  if (orphans.length > 0) {
    columns.push({
      employeeId: null,
      label: ORPHAN_COLUMN_LABEL,
      employee: null,
      appointments: orphans.sort(byStartTime),
    })
  }

  return columns
}

// --- Resumen de la cabecera de columna -------------------------------------

/** 150 -> "2h 30min", 45 -> "45min", 300 -> "5h". */
function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return `${minutes}min`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}min`
}

/**
 * El texto que va bajo el nombre en la cabecera de cada columna
 * (`design/CalendarioDesktop.dc.html:110`): "4 citas · 5h 30min".
 *
 * Cuenta TODAS las citas, canceladas incluidas, y suma sus minutos. No es una
 * suposicion: la columna de Marc Oliva del artboard solo cuadra contandolas
 * -- `:220` 09:30-10:00 (30min) + `:225` 11:30-12:00 CANCELADA (30min) +
 * `:230` 12:00-13:30 (90min) = 3 bloques y 150 minutos, y su cabecera `:124`
 * dice literalmente "3 citas · 2h 30min". Es un recuento de la carga pintada
 * en la columna, no del trabajo facturado.
 */
export function employeeDaySummary(appointments: Appointment[]): string {
  if (appointments.length === 0) return "Sin citas"

  const minutes = appointments.reduce(
    (total, appointment) =>
      total +
      Math.max(
        0,
        differenceInMinutes(parseISO(appointment.endTime), parseISO(appointment.startTime))
      ),
    0
  )

  const noun = appointments.length === 1 ? "cita" : "citas"
  return `${appointments.length} ${noun} · ${formatMinutes(minutes)}`
}

// --- Descanso --------------------------------------------------------------

export interface BreakBlock {
  top: number
  height: number
  /** "13:00 - 14:00", tal y como lo escribe el artboard. */
  label: string
}

/**
 * El tramo de descanso del dia como par "HH:mm", o `null` si el dia esta
 * cerrado, no existe la fila o el descanso no esta definido.
 *
 * `getTodayBusinessHours` esta tipada sobre `BusinessHoursResponse`
 * (`types/salon.ts`) y aqui recibe `WorkingHoursResponse`
 * (`types/employee.ts`): son estructuralmente identicos, asi que el compilador
 * lo acepta. No tocar la firma de esa funcion -- la comparten la reserva
 * publica y el onboarding.
 */
function resolveBreak(
  workingHours: WorkingHoursResponse[] | undefined | null,
  date: Date
): { start: string; end: string } | null {
  if (!workingHours || workingHours.length === 0) return null

  const day = getTodayBusinessHours(workingHours, date)
  if (!day || !day.isOpen) return null
  if (!day.breakStartTime || !day.breakEndTime) return null

  // El backend serializa LocalTime con segundos ("09:00:00").
  return { start: formatTimeOfDay(day.breakStartTime), end: formatTimeOfDay(day.breakEndTime) }
}

/**
 * El bloque rayado "Almuerzo" de la columna
 * (`design/CalendarioDesktop.dc.html:177-180`). El descanso es POR EMPLEADO,
 * no del salon: el artboard lo pinta solo en la columna de Laura.
 */
export function breakPosition(
  workingHours: WorkingHoursResponse[] | undefined | null,
  date: Date
): BreakBlock | null {
  const rest = resolveBreak(workingHours, date)
  if (!rest) return null

  const position = calculateBlockPosition(localIso(date, rest.start), localIso(date, rest.end))
  if (!position) return null

  return { ...position, label: `${rest.start} - ${rest.end}` }
}

// --- Hueco libre -----------------------------------------------------------

export interface FreeSlot {
  /** ISO local, listo para prerrellenar el alta de cita. */
  startTime: string
  endTime: string
  top: number
  height: number
}

/**
 * El recuadro "Libre · toca para crear" del artboard movil
 * (`design/Calendario.dc.html:112-114`): el primer tramo de `SLOT_MINUTES`
 * desde `now` -- redondeado hacia arriba al slot -- que no pise ninguna cita
 * ni el descanso. En el artboard el dia es "Martes 27" marcado HOY, la cita
 * anterior acaba a las 12:00 y el recuadro cae en 12:00-12:30 (`top: 384px`).
 *
 * Devuelve `null` si `visibleDate` no es el dia de `now`. Esa guarda no es
 * cosmetica: sin ella, al navegar a manana el recuadro seguiria apareciendo a
 * la hora de HOY, invitando a crear una cita en un hueco del dia equivocado.
 *
 * Cuenta como ocupada cualquier cita, tambien las canceladas: ofrecer como
 * libre el hueco de una cita anulada que sigue pintada en pantalla seria una
 * contradiccion visual, y el alta siempre esta disponible desde el boton.
 */
export function nextFreeSlot(
  appointments: Appointment[],
  visibleDate: Date,
  now: Date,
  workingHours?: WorkingHoursResponse[] | null
): FreeSlot | null {
  if (!isSameDay(visibleDate, now)) return null

  const gridStart = GRID_START_HOUR * 60
  const gridEnd = GRID_END_HOUR * 60

  const busy = appointments
    .filter((appointment) => isSameDay(parseISO(appointment.startTime), now))
    .map((appointment) => ({
      start: minutesOfDay(parseISO(appointment.startTime)),
      end: minutesOfDay(parseISO(appointment.endTime)),
    }))

  const rest = resolveBreak(workingHours, now)
  if (rest) busy.push({ start: timeToMinutes(rest.start), end: timeToMinutes(rest.end) })

  const roundedNow = Math.ceil(minutesOfDay(now) / SLOT_MINUTES) * SLOT_MINUTES

  for (
    let start = Math.max(gridStart, roundedNow);
    start + SLOT_MINUTES <= gridEnd;
    start += SLOT_MINUTES
  ) {
    const end = start + SLOT_MINUTES
    const taken = busy.some((block) => block.start < end && start < block.end)
    if (taken) continue

    const startTime = localIso(now, minutesToTime(start))
    const endTime = localIso(now, minutesToTime(end))
    const position = calculateBlockPosition(startTime, endTime)
    if (!position) return null

    return { startTime, endTime, ...position }
  }

  return null
}

// --- Carriles --------------------------------------------------------------

export interface LaneAssignment {
  appointment: Appointment
  /** Carril 0-based dentro de su grupo de solape. */
  lane: number
  /** Cuantos carriles tiene el grupo: el bloque ocupa `1 / lanes` del ancho. */
  lanes: number
}

/**
 * Reparte las citas en carriles para que dos que se solapan compartan el ancho
 * en vez de taparse.
 *
 * Hace falta sobre todo en movil, donde el filtro arranca en "Todos"
 * (`design/Calendario.dc.html:51`) y una sola columna recibe las citas de N
 * empleados: como bloques absolutos, se pintarian unas encima de otras. En
 * escritorio cubre el caso de un empleado con dos citas solapadas.
 *
 * El numero de carriles se calcula por GRUPO de solape transitivo, no por
 * cita: si A pisa a B y B pisa a C, las tres comparten el mismo ancho y
 * ninguna cambia de anchura a mitad de bloque. Dos citas que solo se tocan
 * (una acaba justo cuando empieza la otra) NO se solapan.
 */
export function assignLanes(appointments: Appointment[]): LaneAssignment[] {
  const sorted = [...appointments].sort((a, b) => {
    const byStart = parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime()
    if (byStart !== 0) return byStart
    return parseISO(a.endTime).getTime() - parseISO(b.endTime).getTime()
  })

  const assignments: LaneAssignment[] = []
  let group: LaneAssignment[] = []
  let laneEnds: number[] = []
  let groupEnd = Number.NEGATIVE_INFINITY

  const closeGroup = () => {
    for (const item of group) item.lanes = laneEnds.length
    assignments.push(...group)
    group = []
    laneEnds = []
    groupEnd = Number.NEGATIVE_INFINITY
  }

  for (const appointment of sorted) {
    const start = parseISO(appointment.startTime).getTime()
    const end = parseISO(appointment.endTime).getTime()

    if (group.length > 0 && start >= groupEnd) closeGroup()

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = end

    group.push({ appointment, lane, lanes: 0 })
    groupEnd = Math.max(groupEnd, end)
  }

  if (group.length > 0) closeGroup()

  return assignments
}
