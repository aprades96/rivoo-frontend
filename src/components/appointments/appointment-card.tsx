"use client"

import { Clock, User, Scissors } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { StatusBadge } from "./status-badge"
import { formatTime, formatTimeRange, formatDuration } from "@/lib/utils/dates"
import { formatCurrency, initials } from "@/lib/utils/format"
import type { Appointment } from "@/types/appointment"

interface AppointmentCardProps {
  appointment: Appointment
  onTap?: (appointment: Appointment) => void
}

export function AppointmentCard({ appointment, onTap }: AppointmentCardProps) {
  const {
    clientName,
    employeeName,
    serviceName,
    servicePrice,
    serviceDurationMinutes,
    startTime,
    endTime,
    status,
  } = appointment

  return (
    <Card
      className="cursor-pointer p-3 transition-colors hover:bg-muted/50 active:bg-muted"
      onClick={() => onTap?.(appointment)}
    >
      <div className="flex items-stretch gap-3">
        {/* Time column — centrada respecto al contenido de la derecha */}
        <div className="flex w-14 shrink-0 flex-col items-center justify-center text-center">
          <span className="text-lg font-semibold leading-tight tabular-nums">
            {formatTime(startTime)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatDuration(serviceDurationMinutes)}
          </span>
        </div>

        {/* Divider — ocupa toda la altura de la tarjeta */}
        <div className="w-0.5 shrink-0 rounded-full bg-primary/20" />

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{clientName}</p>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Scissors className="h-3 w-3 shrink-0" />
                <span className="truncate">{serviceName}</span>
                <span>·</span>
                <span className="shrink-0">{formatCurrency(servicePrice)}</span>
              </div>
            </div>
            <StatusBadge status={status} />
          </div>

          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span className="truncate">{employeeName}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatTimeRange(startTime, endTime)}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
