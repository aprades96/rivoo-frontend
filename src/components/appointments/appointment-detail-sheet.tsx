"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { StatusBadge } from "./status-badge"
import { useUpdateAppointmentStatus, useCancelAppointment } from "@/hooks/use-appointments"
import { formatTime, formatTimeRange, formatDate, formatDuration } from "@/lib/utils/dates"
import { formatCurrency } from "@/lib/utils/format"
import {
  Clock,
  User,
  Scissors,
  Phone,
  Mail,
  FileText,
  Check,
  Play,
  CircleCheck,
  X,
  UserX,
  Loader2,
} from "lucide-react"
import type { Appointment, AppointmentStatus } from "@/types/appointment"

interface AppointmentDetailSheetProps {
  appointment: Appointment | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AppointmentDetailSheet({
  appointment,
  open,
  onOpenChange,
}: AppointmentDetailSheetProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")

  const updateStatus = useUpdateAppointmentStatus()
  const cancelAppointment = useCancelAppointment()

  if (!appointment) return null

  const handleStatusChange = (status: AppointmentStatus) => {
    updateStatus.mutate(
      { id: appointment.id, status },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  const handleCancel = () => {
    cancelAppointment.mutate(
      { id: appointment.id, reason: cancelReason || undefined, cancelledBy: "SALON" },
      {
        onSuccess: () => {
          setCancelDialogOpen(false)
          setCancelReason("")
          onOpenChange(false)
        },
      }
    )
  }

  const isLoading = updateStatus.isPending || cancelAppointment.isPending

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="text-left">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base">Detalle de cita</SheetTitle>
              <StatusBadge status={appointment.status} />
            </div>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* Time & Date */}
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {formatTimeRange(appointment.startTime, appointment.endTime)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(appointment.startTime)} · {formatDuration(appointment.serviceDurationMinutes)}
                </p>
              </div>
            </div>

            {/* Client */}
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{appointment.clientName}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {appointment.clientPhone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {appointment.clientPhone}
                    </span>
                  )}
                  {appointment.clientEmail && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {appointment.clientEmail}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Service */}
            <div className="flex items-center gap-3">
              <Scissors className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{appointment.serviceName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDuration(appointment.serviceDurationMinutes)} · {formatCurrency(appointment.servicePrice)}
                </p>
              </div>
            </div>

            {/* Employee */}
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm">{appointment.employeeName}</p>
            </div>

            {/* Notes */}
            {appointment.notes && (
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{appointment.notes}</p>
              </div>
            )}

            <Separator />

            {/* Actions */}
            <div className="space-y-2">
              <StatusActions
                status={appointment.status}
                onStatusChange={handleStatusChange}
                onCancelRequest={() => setCancelDialogOpen(true)}
                isLoading={isLoading}
              />
            </div>

            {/* Meta */}
            <div className="text-[10px] text-muted-foreground">
              <span>Fuente: {sourceLabel(appointment.source)}</span>
              {appointment.reminderSent && <span> · Recordatorio enviado</span>}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Cancel confirmation dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar cita</DialogTitle>
            <DialogDescription>
              Esta accion cancelara la cita de {appointment.clientName}.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motivo de cancelacion (opcional)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
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
    </>
  )
}

function StatusActions({
  status,
  onStatusChange,
  onCancelRequest,
  isLoading,
}: {
  status: AppointmentStatus
  onStatusChange: (status: AppointmentStatus) => void
  onCancelRequest: () => void
  isLoading: boolean
}) {
  const actions: { label: string; status?: AppointmentStatus; icon: typeof Check; variant?: "default" | "outline" | "destructive"; cancel?: boolean }[] = []

  switch (status) {
    case "PENDING":
      actions.push({ label: "Confirmar", status: "CONFIRMED", icon: Check })
      actions.push({ label: "Cancelar", icon: X, variant: "destructive", cancel: true })
      break
    case "CONFIRMED":
      actions.push({ label: "Iniciar", status: "IN_PROGRESS", icon: Play })
      actions.push({ label: "No asistio", status: "NO_SHOW", icon: UserX, variant: "outline" })
      actions.push({ label: "Cancelar", icon: X, variant: "destructive", cancel: true })
      break
    case "IN_PROGRESS":
      actions.push({ label: "Completar", status: "COMPLETED", icon: CircleCheck })
      actions.push({ label: "Cancelar", icon: X, variant: "destructive", cancel: true })
      break
    // COMPLETED, CANCELLED, NO_SHOW — no actions
    default:
      return null
  }

  return (
    <div className="flex flex-col gap-2">
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <Button
            key={action.label}
            variant={action.variant ?? "default"}
            className="w-full justify-start"
            disabled={isLoading}
            onClick={() =>
              action.cancel ? onCancelRequest() : onStatusChange(action.status!)
            }
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Icon className="mr-2 h-4 w-4" />
            )}
            {action.label}
          </Button>
        )
      })}
    </div>
  )
}

function sourceLabel(source: string): string {
  switch (source) {
    case "ONLINE": return "Reserva online"
    case "PHONE": return "Telefono"
    case "WALK_IN": return "Sin cita"
    case "MANUAL": return "Manual"
    default: return source
  }
}
