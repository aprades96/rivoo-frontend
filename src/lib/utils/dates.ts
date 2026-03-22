import { format, parseISO, isToday, isTomorrow, isYesterday } from "date-fns"
import { es } from "date-fns/locale"

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

export { TIMEZONE }
