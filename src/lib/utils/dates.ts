import { format, parseISO, isToday, isTomorrow, isYesterday } from "date-fns"
import { es } from "date-fns/locale"
import { capitalizeFirst } from "./format"

const TIMEZONE = "Europe/Madrid"

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

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
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

export { TIMEZONE }
