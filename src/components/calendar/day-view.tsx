"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { TimeGrid } from "./time-grid"
import { AppointmentBlock } from "./appointment-block"
import { generateTimeLabels, SLOT_HEIGHT_PX } from "@/lib/utils/calendar"
import type { Appointment } from "@/types/appointment"

const labels = generateTimeLabels()

interface DayViewProps {
  appointments: Appointment[]
  onAppointmentTap?: (appointment: Appointment) => void
  onSlotTap?: (time: string) => void
}

export function DayView({ appointments, onAppointmentTap, onSlotTap }: DayViewProps) {
  const gridHeight = labels.length * SLOT_HEIGHT_PX

  return (
    <ScrollArea className="h-[calc(100vh-16rem)]">
      <div className="flex">
        {/* Time labels */}
        <TimeGrid />

        {/* Appointment column */}
        <div className="relative flex-1" style={{ height: gridHeight }}>
          {/* Grid lines */}
          {labels.map((label, i) => (
            <div
              key={label}
              className="border-t border-dashed border-muted"
              style={{ height: SLOT_HEIGHT_PX }}
              onClick={() => onSlotTap?.(label)}
            />
          ))}

          {/* Appointment blocks */}
          {appointments.map((apt) => (
            <AppointmentBlock
              key={apt.id}
              appointment={apt}
              onTap={onAppointmentTap}
            />
          ))}
        </div>
      </div>
    </ScrollArea>
  )
}
