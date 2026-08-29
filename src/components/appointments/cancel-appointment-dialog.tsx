"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useCancelAppointment } from "@/hooks/use-appointments"
import { Loader2 } from "lucide-react"

interface CancelAppointmentDialogProps {
  appointmentId: string
  clientName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Se llama TRAS cancelar con exito, ademas de cerrar este dialogo -- lo usan la hoja y el panel para cerrarse ellos tambien. */
  onCancelled?: () => void
}

/**
 * Extraido de `appointment-detail-sheet.tsx:176-205` (T5, `IMPLEMENTATION_PLAN.md`).
 * Va en fichero propio porque en escritorio la hoja NO se monta (T10): si se
 * quedara dentro de ella, "Cancelar" en el panel no haria nada. Es la unica
 * via para mandar el `reason` que acepta `useCancelAppointment`
 * (`hooks/use-appointments.ts:139-147`).
 */
export function CancelAppointmentDialog({
  appointmentId,
  clientName,
  open,
  onOpenChange,
  onCancelled,
}: CancelAppointmentDialogProps) {
  const [reason, setReason] = useState("")
  const cancelAppointment = useCancelAppointment()

  const handleCancel = () => {
    cancelAppointment.mutate(
      { id: appointmentId, reason: reason || undefined, cancelledBy: "SALON" },
      {
        onSuccess: () => {
          onOpenChange(false)
          setReason("")
          onCancelled?.()
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar cita</DialogTitle>
          <DialogDescription>
            Esta accion cancelara la cita de {clientName}.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Motivo de cancelacion (opcional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Volver
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={cancelAppointment.isPending}
          >
            {cancelAppointment.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Cancelar cita
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
