import { format, parseISO, isToday, isTomorrow, isYesterday } from "date-fns"
import { es } from "date-fns/locale"
import { capitalizeFirst } from "./format"

const TIMEZONE = "Europe/Madrid"

// Corte manana/tarde: el artboard reparte los huecos por hora sin un limite
// explicito en el marcado; 14:00 es el corte de mediodia habitual y coincide
// con el hueco entre 11:30 y 16:00 que muestran ambos artboards.
export const AFTERNOON_HOUR = 14

export function formatTime(isoString: string): string {
  return format(parseISO(isoString), "HH:mm")
}

export function formatDate(isoString: string): string {
  return format(parseISO(isoString), "d MMM yyyy", { locale: es })
}

export function formatDateShort(isoString: string): string {
  return format(parseISO(isoString), "d MMM", { locale: es })
}

export function formatRelativeDay(isoString: string): string {
  const date = parseISO(isoString)
  if (isToday(date)) return "Hoy"
  if (isTomorrow(date)) return "Manana"
  if (isYesterday(date)) return "Ayer"
  return format(date, "EEEE d MMM", { locale: es })
}

// Con espacio bajo 60 min ("45 min"). La dibujan `DetalleEmpleadoDesktop.dc.html:245,255`
// y `FormularioEmpleadoDesktop.dc.html`, en una pantalla ya construida
// (`src/app/(app)/staff/[id]/page.tsx:240` -> `ServiceAssignment` ->
// `src/components/staff/service-assignment.tsx:73`). No unificar con
// `formatDurationTight`: cambiar el espacio aqui rompe esa pantalla.
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining > 0 ? `${hours}h ${remaining}min` : `${hours}h`
}

// Sin espacio bajo 60 min ("45min"). La dibujan los diez artboards del asistente
// de nueva cita (`design/NuevaCita*.dc.html`) y los siete de la reserva publica.
// Coincide con `formatDuration` desde 60 min en adelante. No unificar con
// `formatDuration`: esa funcion ya tiene consumidores en produccion que exigen
// el espacio (ver comentario alli).
export function formatDurationTight(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining > 0 ? `${hours}h ${remaining}min` : `${hours}h`
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} - ${formatTime(end)}`
}

// "Martes, 27 de agosto" (`DetalleCita.dc.html:53`, `DetalleCitaDesktop.dc.html:261`).
// `formatDate` NO sirve para esto: da "27 ago 2026". date-fns devuelve el dia de la
// semana en minuscula en castellano, de ahi `capitalizeFirst`.
export function formatDateLong(isoString: string): string {
  return capitalizeFirst(format(parseISO(isoString), "EEEE, d 'de' MMMM", { locale: es }))
}

// Relativo abreviado propio (D15): `formatDistanceToNow` de date-fns con locale `es`
// da "hace alrededor de 2 horas", que no es lo dibujado ("hace 2 h"). `now` es
// inyectable para que los tests sean deterministas sin congelar `Date` global.
export function formatRelativeTime(isoString: string, now: Date = new Date()): string {
  const date = parseISO(isoString)
  const diffMinutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000))

  if (diffMinutes < 60) return `hace ${diffMinutes} min`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `hace ${diffHours} h`

  const diffDays = Math.floor(diffHours / 24)
  return `hace ${diffDays} d`
}

/**
 * Convenio de `WorkingHoursResponse.dayOfWeek`: lunes = 1 ... domingo = 7
 * (`business-hours.ts:79`, `calendar/page.test.tsx:128`). `Date#getDay()`
 * devuelve domingo = 0, de ahi la envoltura. Compartida por el paso 1 del
 * asistente de nueva cita (`wizard/employee-step.tsx`) y `today-facts.ts`:
 * los dos necesitan el mismo criterio de "que dia es hoy" y no pueden
 * divergir en silencio.
 */
export function todayDayOfWeek(now: Date): number {
  const jsDay = now.getDay()
  return jsDay === 0 ? 7 : jsDay
}

export { TIMEZONE }
