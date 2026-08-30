"use client"

import { useState, useMemo } from "react"
import { format, addDays, isSameDay } from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { useAvailability } from "@/hooks/use-availability"
import { useWizardStore } from "@/lib/stores/wizard-store"
import type { AvailableSlot } from "@/types/appointment"

const DAYS_AHEAD = 30
const today = new Date()
const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i))

export function DateTimeStep() {
  const {
    selectedEmployee,
    anyEmployee,
    selectedService,
    selectedDate,
    selectedSlot,
    selectDateTime,
    nextStep,
  } = useWizardStore()

  const [browseDateIndex, setBrowseDateIndex] = useState(0)
  const browseDate = dates[browseDateIndex]
  const dateStr = format(browseDate, "yyyy-MM-dd")

  const employeeId = anyEmployee ? undefined : selectedEmployee?.id
  const { data, isLoading } = useAvailability(
    employeeId ?? "any",
    selectedService?.id,
    dateStr
  )

  // El backend responde {date, employeeId, slots:[{startTime, endTime}]} con
  // las horas sueltas ("09:00:00"). CreateAppointmentRequest.startTime es un
  // LocalDateTime, asi que el hueco se guarda recompuesto como fecha+hora.
  const availabilityDate = data?.date ?? dateStr
  const slots = data?.slots ?? []

  const handleSlotSelect = (slot: AvailableSlot) => {
    selectDateTime(availabilityDate, `${availabilityDate}T${slot.startTime}`, selectedEmployee?.id ?? "")
    nextStep()
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Elige fecha y hora</h2>
        <p className="text-sm text-muted-foreground">
          Selecciona un hueco disponible
        </p>
      </div>

      {/* Date strip */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setBrowseDateIndex(Math.max(0, browseDateIndex - 1))}
            disabled={browseDateIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium capitalize">
            {format(browseDate, "MMMM yyyy", { locale: es })}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setBrowseDateIndex(Math.min(DAYS_AHEAD - 1, browseDateIndex + 1))}
            disabled={browseDateIndex >= DAYS_AHEAD - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="w-full">
          <div className="flex gap-1 pb-2">
            {dates.map((date, i) => {
              const isSelected = i === browseDateIndex
              const isToday = isSameDay(date, today)
              return (
                <button
                  key={i}
                  onClick={() => setBrowseDateIndex(i)}
                  className={`flex shrink-0 flex-col items-center rounded-lg px-3 py-2 text-center transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  <span className="text-[10px] uppercase">
                    {format(date, "EEE", { locale: es })}
                  </span>
                  <span className="text-lg font-semibold">{format(date, "d")}</span>
                  {isToday && !isSelected && (
                    <span className="h-1 w-1 rounded-full bg-primary" />
                  )}
                </button>
              )
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Time slots */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Huecos disponibles — {format(browseDate, "EEEE d MMM", { locale: es })}
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : slots.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay huecos disponibles este dia.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {slots.map((slot) => {
              const slotDateTime = `${availabilityDate}T${slot.startTime}`
              const isSelected =
                selectedDate === availabilityDate && selectedSlot === slotDateTime
              const display = slot.startTime.slice(0, 5)
              return (
                <button
                  key={slot.startTime}
                  onClick={() => handleSlotSelect(slot)}
                  className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary/50 hover:bg-muted"
                  }`}
                >
                  {display}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
