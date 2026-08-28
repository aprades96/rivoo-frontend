import type { BusinessHoursResponse } from "@/types/salon"

const DAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
const FULL_DAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]

export function dayName(dayOfWeek: number): string {
  return DAYS[dayOfWeek - 1] ?? ""
}

function fullDayName(dayOfWeek: number): string {
  return FULL_DAYS[dayOfWeek - 1] ?? ""
}

export interface BusinessHoursGroup {
  /** "Viernes" for a single day, "Lun - Jue" for a consecutive range. */
  label: string
  isOpen: boolean
  openTime: string
  closeTime: string
}

interface OpenGroup {
  isOpen: boolean
  openTime: string
  closeTime: string
  firstDayOfWeek: number
  lastDayOfWeek: number
}

/**
 * Groups consecutive days that share the same schedule into a single row,
 * as `design/ReservaDesktopPaso1.dc.html:137-140` renders them: a range gets
 * the abbreviated "Lun - Jue" form, a lone day (open or closed) gets its full
 * name ("Viernes", "Domingo"). `hours` is expected sorted by `dayOfWeek`
 * (1-7); a day whose schedule differs from its predecessor -- including a
 * change in `isOpen` -- starts a new group.
 */
export function groupBusinessHours(hours: BusinessHoursResponse[]): BusinessHoursGroup[] {
  const groups: OpenGroup[] = []

  for (const day of hours) {
    const last = groups[groups.length - 1]
    const sameSchedule =
      last !== undefined &&
      last.isOpen === day.isOpen &&
      last.openTime === day.openTime &&
      last.closeTime === day.closeTime

    if (sameSchedule && last) {
      last.lastDayOfWeek = day.dayOfWeek
    } else {
      groups.push({
        isOpen: day.isOpen,
        openTime: day.openTime,
        closeTime: day.closeTime,
        firstDayOfWeek: day.dayOfWeek,
        lastDayOfWeek: day.dayOfWeek,
      })
    }
  }

  return groups.map(({ isOpen, openTime, closeTime, firstDayOfWeek, lastDayOfWeek }) => ({
    label:
      firstDayOfWeek === lastDayOfWeek
        ? fullDayName(firstDayOfWeek)
        : `${dayName(firstDayOfWeek)} - ${dayName(lastDayOfWeek)}`,
    isOpen,
    openTime,
    closeTime,
  }))
}
