"use client"

import { useState } from "react"
import { Clock, User, Scissors, Phone, Mail, FileText } from "lucide-react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { AppointmentActions } from "./appointment-actions"
import { CancelAppointmentDialog } from "./cancel-appointment-dialog"
import { statusConfig } from "./status-badge"
import {
  getAppointmentTimeRange,
  getAppointmentDateAndDuration,
  getAppointmentServiceSummary,
  getAppointmentStatusLabel,
  getAppointmentSheetMeta,
} from "./appointment-detail-facts"
import { useUpdateAppointmentStatus } from "@/hooks/use-appointments"
import { useEmployees } from "@/hooks/use-staff"
import { employeeSolidColor } from "@/lib/utils/avatar"
import { formatPhone } from "@/lib/utils/format"
import type { Appointment, AppointmentStatus } from "@/types/appointment"

interface AppointmentDetailSheetProps {
  appointment: Appointment | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Hoja inferior de movil (`design/DetalleCita.dc.html`, 390x844), T8. Chasis y
 * valores propios de este ancho (D3); el escritorio vive en
 * `appointment-detail-panel.tsx` (T9) con sus propias diferencias (§1.2).
 */
export function AppointmentDetailSheet({
  appointment,
  open,
  onOpenChange,
}: AppointmentDetailSheetProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)

  const updateStatus = useUpdateAppointmentStatus()
  const { data: employeesData } = useEmployees()

  if (!appointment) return null

  const employees = employeesData?.content ?? []
  const employeeIndex = employees.findIndex((employee) => employee.id === appointment.employeeId)
  const employee = employeeIndex >= 0 ? employees[employeeIndex] : null
  // Empleado borrado (D11): color de reserva por posicion 0, sin cargo -- no
  // hay cargo que pintar en esta fila, la hoja no lo dibuja (§1.1).
  const pointColor = employeeSolidColor(employee?.colorHex ?? null, employeeIndex >= 0 ? employeeIndex : 0)

  const handleStatusChange = (status: AppointmentStatus) => {
    updateStatus.mutate(
      { id: appointment.id, status },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          overlayClassName="bg-[rgba(42,35,32,0.42)]"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl px-4 pt-[10px] pb-5 shadow-[0_-8px_30px_rgba(42,35,32,0.2)] data-[side=bottom]:border-t-0"
        >
          {/* Asa (`DetalleCita.dc.html:38-40`) -- sin boton de cerrar (§1.1). */}
          <div className="flex justify-center">
            <div data-testid="detail-sheet-grabber" className="h-1 w-9 rounded-full bg-grabber" />
          </div>

          {/* Cabecera (`:42-45`) */}
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="text-[23px] leading-[1.1] font-semibold tracking-display">
              Detalle de cita
            </SheetTitle>
            <span
              className={`inline-flex items-center rounded-full px-[10px] py-1 text-[11px] font-semibold ${statusConfig[appointment.status].className}`}
            >
              {getAppointmentStatusLabel(appointment, "sheet")}
            </span>
          </div>

          {/* Lista de hechos (`:47-93`) */}
          <div className="flex flex-col gap-3.5">
            <div className="flex items-start gap-3">
              <Clock className="mt-px size-[18px] shrink-0 text-muted-foreground-2" strokeWidth={1.75} />
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold tabular-nums">
                  {getAppointmentTimeRange(appointment)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {getAppointmentDateAndDuration(appointment)}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="mt-px size-[18px] shrink-0 text-muted-foreground-2" strokeWidth={1.75} />
              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-semibold">{appointment.clientName}</span>
                <div className="flex items-center gap-3.5 text-xs text-muted-foreground">
                  {appointment.clientPhone && (
                    <span className="flex items-center gap-[5px]">
                      <Phone className="size-3" strokeWidth={1.75} />
                      <span className="tabular-nums">{formatPhone(appointment.clientPhone)}</span>
                    </span>
                  )}
                  {appointment.clientEmail && (
                    <span className="flex items-center gap-[5px]">
                      <Mail className="size-3" strokeWidth={1.75} />
                      {appointment.clientEmail}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Scissors className="mt-px size-[18px] shrink-0 text-muted-foreground-2" strokeWidth={1.75} />
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{appointment.serviceName}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {getAppointmentServiceSummary(appointment)}
                </span>
              </div>
            </div>

            {/* Empleado: PUNTO solido, no icono (`:82-87`, D12). */}
            <div className="flex items-center gap-3">
              <div className="flex size-[18px] shrink-0 items-center justify-center">
                <div
                  data-testid="employee-color-dot"
                  className="size-[10px] rounded-full"
                  style={{ backgroundColor: pointColor }}
                />
              </div>
              <span className="text-sm">{appointment.employeeName}</span>
            </div>

            {appointment.notes && (
              <div className="flex items-start gap-3">
                <FileText className="mt-px size-[18px] shrink-0 text-muted-foreground-2" strokeWidth={1.75} />
                <p className="text-[13px] leading-[1.45] text-muted-foreground">{appointment.notes}</p>
              </div>
            )}
          </div>

          <Separator />

          <AppointmentActions
            status={appointment.status}
            variant="sheet"
            onStatusChange={handleStatusChange}
            onCancelRequest={() => setCancelDialogOpen(true)}
            isPending={updateStatus.isPending}
          />

          <span className="text-[11px] text-muted-foreground-2">
            {getAppointmentSheetMeta(appointment)}
          </span>
        </SheetContent>
      </Sheet>

      <CancelAppointmentDialog
        appointmentId={appointment.id}
        clientName={appointment.clientName}
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onCancelled={() => onOpenChange(false)}
      />
    </>
  )
}
