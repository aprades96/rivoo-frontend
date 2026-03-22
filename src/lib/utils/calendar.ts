import { parseISO, differenceInMinutes, format, addDays, subDays } from "date-fns"

export const GRID_START_HOUR = 8
export const GRID_END_HOUR = 21
export const SLOT_MINUTES = 30
export const TOTAL_SLOTS = (GRID_END_HOUR - GRID_START_HOUR) * (60 / SLOT_MINUTES) // 26 slots
export const SLOT_HEIGHT_PX = 48

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
  const height = (clampedEnd - clampedStart) * pixelsPerMinute

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
