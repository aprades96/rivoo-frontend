"use client"

import { useState } from "react"
import { format, addDays, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { appointmentsApi } from "@/lib/api/appointments"
import type { AvailabilityResponse } from "@/types/appointment"

const DAYS_AHEAD = 30
const today = new Date()
const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i))

export function PublicDateTimeStep() {
  const {
    selectedService,
    selectedEmployeeId,
    selectedDate,
    selectedSlot,
    selectDateTime,
    nextStep,
  } = usePublicBookingStore()

  const [browseDateIndex, setBrowseDateIndex] = useState(0)
  const browseDate = dates[browseDateIndex]
  const dateStr = format(browseDate, "yyyy-MM-dd")

  // Public availability — uses the same endpoint but without auth token
  const { data, isLoading } = useQuery<AvailabilityResponse>({
    queryKey: ["public-availability", selectedEmployeeId, selectedService?.id, dateStr],
    queryFn: () =>
      appointmentsApi.getAvailability(
        {
          employeeId: selectedEmployeeId ?? "any",
          date: dateStr,
          serviceId: selectedService?.id,
        },
        "" // no token for public
      ),
    enabled: !!selectedService,
  })

  const slots = data?.availableSlots ?? []

  const handleSlotSelect = (slot: string) => {
    selectDateTime(dateStr, slot)
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
                </button>
              )
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Time slots */}
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
            const isSelected = selectedDate === dateStr && selectedSlot === slot
            const display = slot.length > 5 ? format(parseISO(slot), "HH:mm") : slot
            return (
              <button
                key={slot}
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
  )
}
