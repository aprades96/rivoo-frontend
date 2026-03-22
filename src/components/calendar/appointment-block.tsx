"use client"

import { calculateBlockPosition } from "@/lib/utils/calendar"
import { StatusBadge } from "@/components/appointments/status-badge"
import { formatTime } from "@/lib/utils/dates"
import type { Appointment } from "@/types/appointment"

interface AppointmentBlockProps {
  appointment: Appointment
  onTap?: (appointment: Appointment) => void
}

const STATUS_BORDER_COLORS: Record<string, string> = {
  PENDING: "border-l-yellow-500",
  CONFIRMED: "border-l-green-500",
  IN_PROGRESS: "border-l-blue-500",
  COMPLETED: "border-l-zinc-400",
  CANCELLED: "border-l-red-500",
  NO_SHOW: "border-l-red-700",
}

export function AppointmentBlock({ appointment, onTap }: AppointmentBlockProps) {
  const pos = calculateBlockPosition(appointment.startTime, appointment.endTime)
  if (!pos) return null

  const borderColor = STATUS_BORDER_COLORS[appointment.status] ?? "border-l-zinc-300"

  return (
    <button
      className={`absolute inset-x-0 mx-1 overflow-hidden rounded-md border-l-[3px] bg-card p-1.5 text-left shadow-sm ring-1 ring-border/50 transition-colors hover:bg-muted/50 ${borderColor}`}
      style={{ top: pos.top, height: pos.height }}
      onClick={() => onTap?.(appointment)}
    >
      <p className="truncate text-xs font-medium leading-tight">
        {appointment.clientName}
      </p>
      {pos.height > 36 && (
        <p className="truncate text-[10px] text-muted-foreground">
          {appointment.serviceName} · {formatTime(appointment.startTime)}
        </p>
      )}
    </button>
  )
}
