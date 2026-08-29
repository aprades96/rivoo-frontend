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
   * El estado de este dialogo se limpia por DOS ejes distintos, y hacen falta
   * los dos -- ninguno cubre al otro:
   *
   * 1. CAMBIO DE CITA -> lo sostiene el `key={appointment.id}` con que lo
   *    montan sus dos consumidores (`appointment-detail-sheet.tsx` y
   *    `appointment-detail-panel.tsx`). Tiene que ser el `key` y no un efecto,
   *    porque un efecto no puede cancelar una mutacion en vuelo ni evitar que
   *    su `onError` aterrice tarde sobre la cita siguiente; destruir la
   *    instancia si.
   * 2. CIERRE SOBRE LA MISMA CITA -> lo sostiene `close`, aqui abajo. El `key`
   *    NO cubre este eje: cerrar y reabrir sobre la misma cita no cambia el id,
   *    asi que no remonta nada y el motivo escrito antes seguiria en el
   *    textarea (y la alerta de un intento fallido reapareceria sin que el
   *    usuario haya hecho nada).
   *
   * Va en el MANEJADOR y no en un `useEffect` a proposito: el efecto equivalente
   * disparaba `react-hooks/set-state-in-effect`, y aqui no hace falta -- el
   * cierre es un evento, no una sincronizacion.
   */
  const close = (next: boolean) => {
    if (!next) {
      setReason("")
      setMutationError(null)
    }
    onOpenChange(next)
  }

  const handleCancel = () => {
    setMutationError(null)
    cancelAppointment.mutate(
      { id: appointmentId, reason: reason || undefined, cancelledBy: "SALON" },
      {
        onSuccess: () => {
          close(false)
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
    <Dialog open={open} onOpenChange={close}>
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
          <Button variant="outline" onClick={() => close(false)}>
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
