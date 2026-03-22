"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Check, Loader2, Calendar, User, Scissors, Clock } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { appointmentsApi } from "@/lib/api/appointments"
import { clientsApi } from "@/lib/api/clients"
import { useAuth } from "@/hooks/use-auth"
import { useWizardStore } from "@/lib/stores/wizard-store"
import { formatCurrency } from "@/lib/utils/format"
import { formatDuration } from "@/lib/utils/dates"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

export function ConfirmationStep() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()
  const {
    selectedEmployee,
    anyEmployee,
    selectedService,
    selectedDate,
    selectedSlot,
    selectedClient,
    newClientData,
    notes,
    setNotes,
    reset,
  } = useWizardStore()

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleConfirm = async () => {
    if (!selectedService || !selectedSlot || !accessToken) return

    setIsSubmitting(true)
    try {
      // Create client if new
      let clientId = selectedClient?.id
      let clientName = selectedClient
        ? `${selectedClient.firstName} ${selectedClient.lastName}`
        : undefined

      if (newClientData && !clientId) {
        const newClient = await clientsApi.create(
          {
            firstName: newClientData.firstName,
            lastName: newClientData.lastName,
            email: newClientData.email || undefined,
            phone: newClientData.phone || undefined,
          },
          accessToken
        )
        clientId = newClient.id
        clientName = `${newClientData.firstName} ${newClientData.lastName}`
      }

      // Create appointment
      await appointmentsApi.create(
        {
          employeeId: selectedEmployee?.id ?? "",
          serviceId: selectedService.id,
          startTime: selectedSlot,
          clientId: clientId || undefined,
          clientName: clientName || newClientData
            ? `${newClientData?.firstName ?? ""} ${newClientData?.lastName ?? ""}`.trim()
            : undefined,
          clientEmail: newClientData?.email || selectedClient?.email || undefined,
          clientPhone: newClientData?.phone || selectedClient?.phone || undefined,
          notes: notes || undefined,
        },
        accessToken
      )

      // Success
      queryClient.invalidateQueries({ queryKey: ["appointments"] })
      queryClient.invalidateQueries({ queryKey: ["clients"] })
      toast.success("Cita creada correctamente")
      reset()
      router.push("/today")
    } catch (err) {
      toast.error("Error al crear la cita. Puede que el hueco ya no este disponible.")
    } finally {
      setIsSubmitting(false)
    }
  }

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
        <h2 className="text-base font-semibold">Confirma la cita</h2>
        <p className="text-sm text-muted-foreground">
          Revisa los detalles antes de confirmar
        </p>
      </div>

      <Card className="space-y-3 p-4">
        {/* Date & Time */}
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium capitalize">{dateDisplay}</p>
            <p className="text-xs text-muted-foreground">{slotDisplay}</p>
          </div>
        </div>

        <Separator />

        {/* Employee */}
        <div className="flex items-center gap-3">
          <User className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm">
            {anyEmployee
              ? "Cualquier profesional disponible"
              : `${selectedEmployee?.firstName} ${selectedEmployee?.lastName}`}
          </p>
        </div>

        {/* Service */}
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

        {/* Client */}
        <div className="flex items-center gap-3">
          <User className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm">
            {selectedClient
              ? `${selectedClient.firstName} ${selectedClient.lastName}`
              : newClientData
                ? `${newClientData.firstName} ${newClientData.lastName} (nuevo)`
                : "Sin cliente asignado"}
          </p>
        </div>
      </Card>

      {/* Notes */}
      <div>
        <Textarea
          placeholder="Notas (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>

      {/* Confirm button */}
      <Button
        className="w-full"
        size="lg"
        onClick={handleConfirm}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creando cita...
          </>
        ) : (
          <>
            <Check className="mr-2 h-4 w-4" />
            Confirmar cita
          </>
        )}
      </Button>
    </div>
  )
}
