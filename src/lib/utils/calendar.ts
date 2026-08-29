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
 * El alto minimo de un bloque: medio slot, lo justo para que quepa el nombre
 * del cliente. Es un SUELO, no un alto garantizado -- ver
 * `calculateBlockPosition`.
 */
export const MIN_BLOCK_HEIGHT_PX = SLOT_HEIGHT_PX / 2

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
 * para que quepa el nombre del cliente. Ese suelo va a su vez TECHADO por el
 * alto real del tramo: ver abajo.
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

  /*
    Una hora que `parseISO` no sabe leer da `Invalid Date`, y de ahi `NaN`. La
    guarda de tramo vacio de abajo NO lo caza -- `NaN >= NaN` es `false` --, asi
    que sin esta linea la funcion devolvia `{top: NaN, height: NaN}` en vez de
    `null` y el dano salia por dos sitios. Uno, `AppointmentBlock` no se paraba
    en su `if (!position) return null` y seguia hasta `formatTime`, que revienta
    con `RangeError: Invalid time value`: no un bloque mal pintado, la pantalla
    entera abajo. Dos, `isPainted` daba la cita por pintada y la metia en el
    reparto de carriles, donde `groupEnd = Math.max(groupEnd, NaN)` dejaba el
    grupo de solape abierto el dia entero -- ver `resolveLaneCounts`.
  */
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return null

  // Clamp to grid bounds
  const clampedStart = Math.max(startMinutes, gridStartMinutes)
  const clampedEnd = Math.min(endMinutes, gridEndMinutes)

  if (clampedStart >= clampedEnd) return null

  const pixelsPerMinute = SLOT_HEIGHT_PX / SLOT_MINUTES
  const top = (clampedStart - gridStartMinutes) * pixelsPerMinute
  const span = (clampedEnd - clampedStart) * pixelsPerMinute

  /*
    El suelo va TECHADO por `span`, el alto real del tramo. Sin ese techo, por
    debajo de 15 minutos el suelo (24px) supera la distancia al bloque
    siguiente (`1.6 * d`, o sea 24px justos a los 15 minutos) y dos citas
    encadenadas se pisan -- 8px con dos de 10 minutos. Y no lo arregla nadie
    aguas abajo: `assignLanes` compara TIEMPOS, no geometria, asi que dice con
    razon que no se solapan, les da el mismo carril y ancho completo, y la
    segunda tapa a la primera. Con el techo, un tramo de 10 minutos se pinta de
    16px: pierde el canalon, pero no invade a su vecina.
  */
  const height = Math.min(Math.max(span - BLOCK_GUTTER_PX, MIN_BLOCK_HEIGHT_PX), span)

  return { top, height }
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
 * que llega `employees` y conservando las columnas vacias.
 *
 * El canvas NO decide este caso: sus tres columnas
 * (`design/CalendarioDesktop.dc.html:152-182`, `:183-209`, `:210-235`) llevan
 * tres bloques cada una y no hay ninguna vacia dibujada en ningun sitio. Lo
 * decide la rejilla: las columnas se reparten `repeat(N, minmax(0, 1fr))`
 * (`day-view.tsx`, `DesktopColumns`), asi que quitar la del empleado sin citas
 * ensancharia a todas las demas -- la agenda cambiaria de ancho sola segun se
 * llena y se vacia el dia, y bastaria cancelar la ultima cita de alguien para
 * que la pantalla se recolocara entera. Ademas la columna vacia es justo la
 * util: es donde se pulsa una franja para dar hora al que esta libre. Por eso
 * la cabecera anuncia "Sin citas" (`employeeDaySummary`) en vez de irse.
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
  /**
   * El tramo real, como par "HH:mm". Viaja DENTRO del bloque a proposito: es
   * lo que permite que quien pinta el descanso y quien calcula el hueco libre
   * lean el mismo dato en vez de deducirlo cada uno por su cuenta -- ver
   * `nextFreeSlot`.
   */
  start: string
  end: string
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

  return { ...position, start: rest.start, end: rest.end, label: `${rest.start} - ${rest.end}` }
}

/** El descanso de un empleado, indexado por su id. */
export type EmployeeBreaks = Record<string, BreakBlock | null | undefined>

/**
 * El descanso que le toca a una columna. La columna "Otros" (`employeeId ===
 * null`) no es de nadie, asi que nunca lleva descanso.
 */
export function breakOfColumn(
  breaks: EmployeeBreaks | undefined,
  employeeId: string | null
): BreakBlock | null {
  if (!breaks || employeeId === null) return null
  return breaks[employeeId] ?? null
}

/**
 * EL descanso que se ve en la columna unica de movil. Definicion UNICA: la
 * usan tanto `DayView` para pintarlo como la pantalla para pasarselo a
 * `nextFreeSlot`, que es lo que impide que el recuadro "Libre" se ofrezca
 * encima del rayado del almuerzo.
 *
 * QUE DIBUJA EL ARTBOARD, para no atribuirle lo que no: el rayado del almuerzo
 * (`design/Calendario.dc.html:116-118`) esta pintado con el filtro puesto en
 * UNA empleada. La pildora de fondo #B4522F, texto blanco y peso 600 es la de
 * Laura (`:52-55`); la de "Todos" esta en reposo -- fondo #FFFFFF, peso 500
 * (`:51`) --, y la rejilla movil pinta los tres bloques de la columna de Laura
 * del artboard de escritorio (`CalendarioDesktop.dc.html:162,168,177`: dos
 * citas y el propio almuerzo) y ninguno de los otros SEIS. Las cuentas del
 * canvas, que conviene no torcer: nueve `.blk` en total, tres por columna, de
 * los que ocho son citas -- 2 de Laura + 3 de Sofia + 3 de Marc -- y el noveno
 * es este descanso. Movil solo anade un cuarto elemento que en escritorio no
 * existe, el recuadro "Libre" (`Calendario.dc.html:112`). O sea que el caso
 * dibujado es el de una sola columna, donde el descanso que se ve es el suyo.
 *
 * Aun asi la funcion no puede quedarse en "el del unico empleado": "Todos"
 * existe como eleccion explicita del usuario, y ahi la columna unica recibe
 * los descansos de N empleados. Apilar N cajas identicas -- lo que pasaria en
 * un salon donde toda la plantilla almuerza a la vez -- no es una opcion. Se
 * devuelve el primer tramo que haya: con un empleado sale el suyo, y con
 * descanso comun sale exactamente uno.
 */
export function visibleBreak(
  columns: EmployeeColumn[],
  breaks: EmployeeBreaks | undefined
): BreakBlock | null {
  for (const column of columns) {
    const rest = breakOfColumn(breaks, column.employeeId)
    if (rest) return rest
  }
  return null
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
 *
 * CONTRATO DE `paintedBreak` -- lo que tiene que pasarle la pantalla: EL MISMO
 * objeto que `DayView` va a pintar, es decir `visibleBreak(columns, breaks)`.
 * Ni los horarios del empleado seleccionado ni nada de lo que haya que deducir
 * el tramo por segunda vez. Antes esta funcion recibia `WorkingHoursResponse[]`
 * y resolvia el descanso por su cuenta, y con el filtro en "Todos" -- que no es
 * lo que dibuja el artboard, ver `visibleBreak`, pero si esta a un toque -- la
 * pantalla no tenia empleado que pasarle: le mandaba `null`, el descanso no
 * entraba en `busy` y el recuadro "Libre" caia a las 13:00, ENCIMA del rayado
 * del almuerzo que `visibleBreak` si estaba pintando. Pintar y calcular tienen
 * que leer el mismo dato; por eso el
 * parametro es el bloque ya resuelto y no su materia prima.
 */
export function nextFreeSlot(
  appointments: Appointment[],
  visibleDate: Date,
  now: Date,
  paintedBreak?: BreakBlock | null
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

  if (paintedBreak) {
    busy.push({
      start: timeToMinutes(paintedBreak.start),
      end: timeToMinutes(paintedBreak.end),
    })
  }

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
    // `continue`, no `return`: que un candidato no quepa en la rejilla no dice
    // nada del siguiente. Hoy es inalcanzable -- el bucle ya se para en
    // `gridEnd` --, pero mover `GRID_START_HOUR`/`GRID_END_HOUR` lo volveria
    // alcanzable y abandonar la busqueda entera dejaria el dia sin hueco.
    if (!position) continue

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
 * Hace falta en los dos anchos. En movil, cuando el usuario elige "Todos" en el
 * filtro: una sola columna recibe entonces las citas de N empleados y, como
 * bloques absolutos, se pintarian unas encima de otras. "Todos" NO es lo que
 * dibuja el artboard -- alli la pildora seleccionada es la de Laura (`:52-55`,
 * #B4522F sobre blanco), la de "Todos" esta en reposo (`:51`) y la rejilla
 * movil pinta exactamente los tres bloques de la columna de Laura del artboard
 * de escritorio --, es una eleccion que el usuario tiene a un toque. En
 * escritorio cubre el caso de un empleado con dos citas solapadas, que no
 * depende de ningun filtro.
 *
 * SOLO ENTRAN LAS CITAS QUE SE VAN A PINTAR. Una que cae fuera de la rejilla
 * -- `calculateBlockPosition` devuelve `null` y `AppointmentBlock` no monta
 * nada -- se queda fuera del resultado, asi que el array devuelto puede ser mas
 * corto que el recibido. Repartiendo por tiempo a secas, una cita invisible
 * gastaba carril: un dia con `06:00-07:30` (fuera) y `06:30-09:00` (recortada a
 * 08:00-09:00, esta si se pinta) daba carril 0 de 2 a la primera y 1 de 2 a la
 * segunda, y el UNICO bloque visible salia a media columna, pegado a la
 * derecha y con la mitad izquierda vacia. El filtro usa la misma funcion que
 * consulta el bloque al pintarse, no un criterio paralelo que pueda divergir.
 *
 * El CARRIL se reparte por grupo de solape transitivo -- si A pisa a B y B
 * pisa a C, ninguna reutiliza el carril de otra que siga en curso. Dos citas
 * que solo se tocan (una acaba justo cuando empieza la otra) NO se solapan.
 *
 * El NUMERO de carriles, en cambio, es por cita y no por grupo: es el maximo
 * de citas simultaneas DENTRO de su propio tramo. Repartirlo por grupo hacia
 * que una sola cita larga adelgazase el dia entero -- una formacion de
 * 08:00 a 21:00 mas dos citas solapadas por la manana metia a todo el dia en
 * un grupo de 3 carriles, y el bloque de las 19:00, que no pisa a ninguna de
 * las dos, salia a un tercio de ancho (~112px de los ~336 utiles en movil) con
 * el nombre del cliente truncado.
 */
export function assignLanes(appointments: Appointment[]): LaneAssignment[] {
  // `filter` ya devuelve un array nuevo, asi que ordenarlo no toca el que nos
  // dieron.
  const sorted = appointments.filter(isPainted).sort((a, b) => {
    const byStart = parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime()
    if (byStart !== 0) return byStart
    return parseISO(a.endTime).getTime() - parseISO(b.endTime).getTime()
  })

  const assignments: LaneAssignment[] = []
  let group: PlacedAppointment[] = []
  let laneEnds: number[] = []
  let groupEnd = Number.NEGATIVE_INFINITY

  const closeGroup = () => {
    resolveLaneCounts(group)
    for (const item of group) {
      assignments.push({ appointment: item.appointment, lane: item.lane, lanes: item.lanes })
    }
    group = []
    laneEnds = []
    groupEnd = Number.NEGATIVE_INFINITY
  }

  for (const appointment of sorted) {
    const start = parseISO(appointment.startTime).getTime()
    const end = parseISO(appointment.endTime).getTime()

    // El grupo se cierra por el final MAS TARDIO, no por el ultimo carril
    // ocupado: mientras quede una cita en curso, la siguiente no puede
    // reutilizar su carril.
    if (group.length > 0 && start >= groupEnd) closeGroup()

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = end

    group.push({ appointment, lane, lanes: 0, start, end })
    groupEnd = Math.max(groupEnd, end)
  }

  if (group.length > 0) closeGroup()

  return assignments
}

/**
 * Si la rejilla va a pintar el bloque de esta cita. Se pregunta con la MISMA
 * funcion que consulta `AppointmentBlock` antes de devolver `null`: dos
 * criterios distintos para "esto se ve" acabarian divergiendo, y el que
 * reparte el ancho es justo el que no puede equivocarse.
 */
function isPainted(appointment: Appointment): boolean {
  return calculateBlockPosition(appointment.startTime, appointment.endTime) !== null
}

/** Una cita ya colocada en su carril, con su tramo en milisegundos. */
interface PlacedAppointment extends LaneAssignment {
  start: number
  end: number
}

function overlap(a: PlacedAppointment, b: PlacedAppointment): boolean {
  return a.start < b.end && b.start < a.end
}

/**
 * El maximo de citas simultaneas dentro del tramo de `item`, el propio `item`
 * incluido (asi que nunca baja de 1).
 *
 * Solo se miran los ARRANQUES: entre dos arranques consecutivos el numero de
 * citas activas unicamente puede bajar, asi que el maximo de un tramo se
 * alcanza siempre en el arranque de alguna cita -- o en el del propio `item`.
 *
 * COSTE: un recorrido del grupo por cada arranque del grupo, o sea O(k²) con
 * k = citas del GRUPO de solape. Ver el coste total en `resolveLaneCounts`.
 */
function peakConcurrency(group: PlacedAppointment[], item: PlacedAppointment): number {
  let peak = 0

  for (const candidate of group) {
    const instant = candidate.start
    if (instant < item.start || instant >= item.end) continue

    let active = 0
    for (const other of group) {
      if (other.start <= instant && instant < other.end) active++
    }
    if (active > peak) peak = active
  }

  return peak
}

/**
 * Fija el `lanes` de cada cita del grupo.
 *
 * La INVARIANTE que hay que sostener es que dos citas solapadas nunca se pisen
 * en pantalla. Con `left = lane / lanes` y `width = 1 / lanes`
 * (`appointment-block.tsx`), un `lanes` distinto por cita no basta por si
 * solo: 1/4..2/4 y 2/5..3/5 se solapan. Se sostiene con esta regla, aplicada
 * en la segunda pasada -- entre dos citas que se solapan, la del carril MAS
 * BAJO nunca tiene menos carriles que la del carril mas alto. Con
 * `lanes(i) >= lanes(j)` y `lane(i) < lane(j)`:
 *
 *   borde derecho de i = (lane(i)+1)/lanes(i) <= lane(j)/lanes(i)
 *                                             <= lane(j)/lanes(j) = borde izquierdo de j
 *
 * La segunda pasada recorre de carril mas alto a mas bajo, asi que cuando le
 * toca a una cita todas las de carril superior ya estan cerradas y una sola
 * pasada alcanza el punto fijo.
 *
 * De regalo, `lanes >= lane + 1` para toda cita que llegue hasta aqui: una
 * cita solo cae en el carril L si en su arranque estaban ocupados los L de
 * debajo, o sea que en ese instante habia al menos L+1 citas activas, y
 * `peakConcurrency` evalua ese instante porque cae dentro de `[start, end)`.
 * La condicion es que el tramo NO sea vacio: con `start === end` ese intervalo
 * no contiene ningun instante, `peakConcurrency` devuelve 0 y la promesa se
 * rompe -- una cita de duracion cero entre dos que la envuelven salia con
 * `lane 2` y `lanes 0`. Por eso el filtro de `assignLanes` sostiene tambien
 * esta invariante y no solo la geometria: `calculateBlockPosition` devuelve
 * `null` tanto para el tramo vacio (`clampedStart >= clampedEnd`) como para la
 * hora que `parseISO` no sabe leer, asi que ninguna de las dos llega.
 *
 * Las DOS guardas hacen falta, y la segunda no se deduce de la primera: con
 * horas ilegibles los minutos salen `NaN`, `NaN >= NaN` es `false` y el tramo
 * se colaba entero por debajo de la comparacion. Y no rompia solo su propio
 * bloque: `isPainted` decia que si se pinta, la cita entraba al reparto y
 * `groupEnd = Math.max(groupEnd, NaN)` se quedaba en `NaN`, con lo que
 * `start >= groupEnd` no volvia a cumplirse y el grupo de solape no se cerraba
 * en todo el dia. Medido: dos pares solapados a horas distintas -- 09:00 y
 * 15:00, que no se pisan entre si ni pisan a la ilegible -- salian repartidos
 * como un solo grupo, y la segunda cita del primer par con `lane 2` sobre
 * `lanes 2`. Ese carril no existe, y `laneGeometry` (`appointment-block.tsx`)
 * no lo deja fuera de la columna: lo recorta a `lanes - 1`, o sea a la MISMA
 * banda que su vecina. Por eso la guarda vive en `calculateBlockPosition` y no
 * en el reparto: ahi cierra a la vez el tramo `NaN` y la contaminacion del
 * grupo.
 *
 * COSTE, medido y no supuesto: esta funcion llama a `peakConcurrency` -- que
 * es O(k²) -- una vez por cita, o sea O(k³) por grupo de solape. La k es la
 * del GRUPO, no la del dia: en cuanto la cadena de solapes se rompe se abre
 * grupo nuevo, y en una agenda real va en un digito. Los extremos, medidos con
 * k=200 en una sola llamada a `assignLanes`: ~3 ms con una cadena en la que
 * cada cita solo pisa a la siguiente, ~20 ms con las 200 a la misma hora. Es
 * de sobra para que esto no pueda correr en cada render, que es lo que hacia:
 * ver el `useMemo` de `ColumnBody` en `day-view.tsx`, el unico que lo llama.
 */
function resolveLaneCounts(group: PlacedAppointment[]): void {
  for (const item of group) item.lanes = peakConcurrency(group, item)

  const byLaneDesc = [...group].sort((a, b) => b.lane - a.lane)
  for (const item of byLaneDesc) {
    for (const other of group) {
      if (other.lane <= item.lane) continue
      if (!overlap(item, other)) continue
      if (other.lanes > item.lanes) item.lanes = other.lanes
    }
  }
}
