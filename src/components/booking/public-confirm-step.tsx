"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Calendar, User, Scissors, Loader2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { appointmentsApi } from "@/lib/api/appointments"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { formatCurrency } from "@/lib/utils/format"
import { formatDuration } from "@/lib/utils/dates"
import type { SalonPublic } from "@/types/salon"

interface PublicConfirmStepProps {
  salon: SalonPublic
}

export function PublicConfirmStep({ salon }: PublicConfirmStepProps) {
  const {
    salonSlug,
    selectedService,
    selectedEmployeeId,
    selectedDate,
    selectedSlot,
    clientForm,
    honeypot,
    nextStep,
    setStep,
  } = usePublicBookingStore()

  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      appointmentsApi.bookPublic({
        salonSlug,
        serviceExternalId: selectedService!.id,
        employeeExternalId: selectedEmployeeId ?? undefined,
        requestedTime: selectedSlot!,
        clientFirstName: clientForm.firstName,
        clientLastName: clientForm.lastName,
        clientEmail: clientForm.email,
        clientPhone: clientForm.phone,
        honeypot: honeypot || undefined,
      }),
    onSuccess: () => {
      nextStep() // → step 5 (success)
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Error al crear la reserva"
      setErrorMessage(message)
    },
  })

  const slotDisplay = selectedSlot
    ? selectedSlot.length > 5
      ? format(parseISO(selectedSlot), "HH:mm")
      : selectedSlot
    : ""

  const dateDisplay = selectedDate
    ? format(parseISO(selectedDate), "EEEE d MMMM", { locale: es })
    : ""

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Confirma tu reserva</h2>
        <p className="text-sm text-muted-foreground">
          Revisa los detalles antes de confirmar
        </p>
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium capitalize">{dateDisplay}</p>
            <p className="text-xs text-muted-foreground">{slotDisplay}</p>
          </div>
        </div>

        <Separator />

        <div className="flex items-center gap-3">
          <Scissors className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm">{selectedService?.name}</p>
            <p className="text-xs text-muted-foreground">
              {selectedService && formatDuration(selectedService.durationMinutes)}
            </p>
          </div>
          <span className="text-sm font-semibold">
            {selectedService && formatCurrency(selectedService.price)}
          </span>
        </div>

        <Separator />

        <div className="flex items-center gap-3">
          <User className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm">{clientForm.firstName} {clientForm.lastName}</p>
            <p className="text-xs text-muted-foreground">{clientForm.email} · {clientForm.phone}</p>
          </div>
        </div>
      </Card>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <Button
        className="w-full"
        size="lg"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Reservando...
          </>
        ) : (
          "Confirmar reserva"
        )}
      </Button>
    </div>
  )
}
