"use client"

import { CalendarCheck, Phone } from "lucide-react"
import { Card } from "@/components/ui/card"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { formatCurrency } from "@/lib/utils/format"
import { formatDuration } from "@/lib/utils/dates"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import type { SalonPublic } from "@/types/salon"

interface PublicSuccessStepProps {
  salon: SalonPublic
}

export function PublicSuccessStep({ salon }: PublicSuccessStepProps) {
  const { selectedService, selectedDate, selectedSlot, clientForm } = usePublicBookingStore()

  const slotDisplay = selectedSlot
    ? selectedSlot.length > 5
      ? format(parseISO(selectedSlot), "HH:mm")
      : selectedSlot
    : ""

  const dateDisplay = selectedDate
    ? format(parseISO(selectedDate), "EEEE d MMMM yyyy", { locale: es })
    : ""

  return (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <CalendarCheck className="h-8 w-8 text-green-600" />
      </div>

      <h2 className="text-xl font-bold">Reserva confirmada</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Te hemos enviado un email de confirmacion a {clientForm.email}
      </p>

      <Card className="mt-6 w-full space-y-2 p-4 text-left">
        <p className="text-sm font-medium capitalize">{dateDisplay}</p>
        <p className="text-sm">{slotDisplay} — {selectedService?.name}</p>
        <p className="text-xs text-muted-foreground">
          {selectedService && formatDuration(selectedService.durationMinutes)} · {selectedService && formatCurrency(selectedService.price)}
        </p>
        <p className="text-xs text-muted-foreground">
          {clientForm.firstName} {clientForm.lastName}
        </p>
      </Card>

      <Card className="mt-4 w-full p-3 text-left">
        <p className="text-xs font-medium">{salon.name}</p>
        {salon.address && (
          <p className="text-xs text-muted-foreground">{salon.address}</p>
        )}
        {salon.phone && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            {salon.phone}
          </div>
        )}
      </Card>

      <p className="mt-6 text-xs text-muted-foreground">
        Si necesitas cancelar o modificar tu cita, contacta directamente con el salon.
      </p>
    </div>
  )
}
