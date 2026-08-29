"use client"

import { useEffect, useState } from "react"
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
import { ApiError } from "@/lib/api/client"
import { Loader2 } from "lucide-react"

const FALLBACK_ERROR_MESSAGE = "No se ha podido cancelar la cita. Intentalo de nuevo."

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
  const [mutationError, setMutationError] = useState<string | null>(null)
  const cancelAppointment = useCancelAppointment()

  /**
   * El panel de detalle NO desmonta este dialogo al cambiar de cita
   * (`appointment-detail-panel.tsx:273` lo monta sin `key`) ni al cerrarlo con
   * "Volver": por D9 el panel solo cambia de contenido. Sin este reset, el
   * `reason` de una cita sobrevivia al cierre y se colaba en la siguiente
   * `cancelAppointment.mutate` con OTRO `appointmentId`. El estado tiene que
   * morir con la cita, dentro del propio dialogo -- no depender de que cada
   * consumidor (hoja/panel/movil) se acuerde de pasar una `key`.
   */
  useEffect(() => {
    setReason("")
    setMutationError(null)
  }, [appointmentId])

  useEffect(() => {
    if (!open) {
      setReason("")
      setMutationError(null)
    }
  }, [open])

  const handleCancel = () => {
    setMutationError(null)
    cancelAppointment.mutate(
      { id: appointmentId, reason: reason || undefined, cancelledBy: "SALON" },
      {
        onSuccess: () => {
          onOpenChange(false)
          setReason("")
          onCancelled?.()
        },
        onError: (error) => {
          setMutationError(
            error instanceof ApiError && error.problem.detail
              ? error.problem.detail
              : FALLBACK_ERROR_MESSAGE
          )
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
        {mutationError ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive-border bg-destructive-soft px-3 py-2 text-sm text-destructive"
          >
            {mutationError}
          </p>
        ) : null}
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
