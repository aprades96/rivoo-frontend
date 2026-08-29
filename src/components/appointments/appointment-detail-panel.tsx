"use client"

// Columna acoplada de 360px de `/calendar` en escritorio
// (`design/DetalleCitaDesktop.dc.html:249-330`, T9). NO es una hoja modal
// (D1): es hermana de la rejilla, sin velo ni backdrop, y quien la coloca en
// el arbol es T10. El estado abierto/seleccionado vive en la pagina (D16):
// este componente solo recibe la cita ya derivada y un `onClose`.

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Clock, MessageSquare, Phone, Scissors, TriangleAlert, User, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Appointment, AppointmentStatus } from "@/types/appointment"
import { useEmployees } from "@/hooks/use-staff"
import { useUpdateAppointmentStatus } from "@/hooks/use-appointments"
import { initials, formatPhone } from "@/lib/utils/format"
import { formatDuration } from "@/lib/utils/dates"
import { employeeAvatarAlphaStyle, employeeFallbackAvatarClassName } from "@/lib/utils/avatar"
import { statusConfig } from "./status-badge"
import {
  getAppointmentTimeRange,
  getAppointmentDateAndDuration,
  getAppointmentServicePrice,
  getAppointmentStatusLabel,
  getAppointmentPanelMeta,
} from "./appointment-detail-facts"
import { AppointmentActions } from "./appointment-actions"
import { CancelAppointmentDialog } from "./cancel-appointment-dialog"

interface AppointmentDetailPanelProps {
  appointment: Appointment | null
  onClose: () => void
}

/**
 * Iniciales del empleado. Con `Employee` cargado se usan sus dos campos
 * (`initials(firstName, lastName)`). En la degradacion de D11 -- empleado
 * borrado, solo queda `appointment.employeeName` en una sola cadena -- hay
 * que partir por el espacio: llamar a `initials` con un solo argumento da una
 * unica letra ("L"), no "LM" (`format.ts:23`, IMPLEMENTATION_PLAN.md §1.4).
 */
function employeeInitialsFromName(employeeName: string): string {
  const parts = employeeName.trim().split(/\s+/)
  return initials(parts[0] || employeeName, parts.length > 1 ? parts[parts.length - 1] : undefined)
}

export function AppointmentDetailPanel({ appointment, onClose }: AppointmentDetailPanelProps) {
  const router = useRouter()
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const updateStatus = useUpdateAppointmentStatus()
  const { data: employeesData } = useEmployees()

  // D9: cierre por X y por Escape, sin trampa de foco. No es un dialogo, asi
  // que el listener es global -- no depende de donde este el foco -- y solo
  // vive mientras haya una cita mostrada.
  useEffect(() => {
    if (!appointment) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [appointment, onClose])

  if (!appointment) return null

  const employees = employeesData?.content ?? []
  const employeeIndex = employees.findIndex((candidate) => candidate.id === appointment.employeeId)
  const employee = employeeIndex >= 0 ? employees[employeeIndex] : undefined
  // Posicion en la paleta de reserva (D12): con empleado encontrado, su
  // posicion en la lista; sin el (borrado), la 0 -- no hay lista de la que
  // sacar una posicion real.
  const fallbackIndex = employeeIndex >= 0 ? employeeIndex : 0

  const avatarInitials = employee
    ? initials(employee.firstName, employee.lastName)
    : employeeInitialsFromName(appointment.employeeName)

  const handleStatusChange = (status: AppointmentStatus) => {
    // D16: el panel NO se cierra al cambiar de estado. La cita se deriva por
    // id en cada render (la pagina, T10); cerrar aqui reintroduciria el bug
    // que D16 documenta (el panel se quedaba diciendo el estado viejo).
    updateStatus.mutate({ id: appointment.id, status })
  }

  const handleReschedule = () => {
    // D6: "Reprogramar" solo se dibuja aqui -- si esta tarea no lo cablea, no
    // lo cablea nadie. Limitacion conocida (`calendar/page.tsx:238-252`): el
    // asistente de /appointments/new todavia no lee estos parametros.
    const date = appointment.startTime.slice(0, 10)
    const time = appointment.startTime.slice(11, 16)
    const params = new URLSearchParams({
      rescheduleId: appointment.id,
      date,
      time,
      employeeId: appointment.employeeId,
    })
    router.push(`/appointments/new?${params.toString()}`)
  }

  return (
    <aside
      data-testid="appointment-detail-panel"
      aria-label="Detalle de cita"
      className="flex h-full w-[360px] shrink-0 flex-col gap-[14px] border-l border-border bg-muted-subtle p-5"
    >
      {/* Rotulo + cierre (`:251-256`) -- fijo, no forma parte de la franja con scroll (D20). */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold tracking-[0.06em] text-muted-foreground-2 uppercase">
          Detalle de cita
        </span>
        <button
          type="button"
          aria-label="Cerrar"
          data-testid="appointment-panel-close"
          onClick={onClose}
          className="flex size-[30px] items-center justify-center rounded-lg border border-border bg-card"
        >
          <X className="size-[15px] text-muted-foreground" strokeWidth={1.75} />
        </button>
      </div>

      {/* D20: la franja "de la hora a la meta" lleva su propio scroll; el
          rotulo de arriba y las acciones de abajo quedan fijos. */}
      <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto">
        <div className="flex flex-col gap-[7px]">
          <span
            data-testid="appointment-panel-status"
            className={cn(
              "self-start rounded-full px-2.5 py-1 text-[11px] font-bold",
              statusConfig[appointment.status].className
            )}
          >
            {getAppointmentStatusLabel(appointment, "panel")}
          </span>
          <span className="text-[30px] leading-[1.1] font-semibold tracking-[-0.02em] tabular-nums">
            {getAppointmentTimeRange(appointment)}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {getAppointmentDateAndDuration(appointment)}
          </span>
        </div>

        {/* Tarjeta cliente (`:264-280`). SOLO nombre, telefono y contacto --
            el email es de la hoja de movil, no de aqui (§1.2 diferencia 5). */}
        <div className="flex items-center gap-3 rounded-[10px] border border-border bg-card p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <User className="size-[17px] text-primary" strokeWidth={1.75} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="truncate text-[14px] font-semibold">{appointment.clientName}</span>
            {appointment.clientPhone && (
              <span className="truncate text-[12px] tabular-nums text-muted-foreground">
                {formatPhone(appointment.clientPhone)}
              </span>
            )}
          </div>
          {appointment.clientPhone && (
            <div className="flex shrink-0 gap-1.5">
              <a
                href={`tel:${appointment.clientPhone}`}
                aria-label="Llamar"
                data-testid="appointment-panel-call"
                className="flex size-8 items-center justify-center rounded-lg border border-border bg-card"
              >
                <Phone className="size-[15px] text-muted-foreground" strokeWidth={1.75} />
              </a>
              <a
                href={`sms:${appointment.clientPhone}`}
                aria-label="Enviar mensaje"
                data-testid="appointment-panel-sms"
                className="flex size-8 items-center justify-center rounded-lg border border-border bg-card"
              >
                <MessageSquare className="size-[15px] text-muted-foreground" strokeWidth={1.75} />
              </a>
            </div>
          )}
        </div>

        {/* Tarjeta servicio (`:282-291`): precio AISLADO a 17px, no el combo
            de la hoja de movil (`getAppointmentServiceSummary` es exclusiva
            de esa, aviso explicito de T4). */}
        <div className="flex items-center gap-3 rounded-[10px] border border-border bg-card p-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Scissors className="size-[17px] text-primary" strokeWidth={1.75} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="truncate text-[14px] font-semibold">{appointment.serviceName}</span>
            <span className="text-[12px] text-muted-foreground">
              {formatDuration(appointment.serviceDurationMinutes)}
            </span>
          </div>
          <span className="shrink-0 text-[17px] font-semibold tracking-[-0.02em] tabular-nums">
            {getAppointmentServicePrice(appointment)}
          </span>
        </div>

        {/* Tarjeta empleado (`:293-299`): avatar de iniciales, sin `.ico` y
            sin acciones. Degradacion D11 si el empleado no aparece. */}
        <div className="flex items-center gap-3 rounded-[10px] border border-border bg-card p-3">
          <div
            data-testid="appointment-panel-employee-avatar"
            aria-hidden="true"
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
              !employee?.colorHex && employeeFallbackAvatarClassName(fallbackIndex)
            )}
            style={employee?.colorHex ? employeeAvatarAlphaStyle(employee.colorHex) : undefined}
          >
            {avatarInitials}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="truncate text-[14px] font-semibold">{appointment.employeeName}</span>
            {employee?.jobTitle && (
              <span className="truncate text-[12px] text-muted-foreground">{employee.jobTitle}</span>
            )}
          </div>
        </div>

        {/* Recuadro de nota (`:301-307`). Si no hay `notes`, no se pinta. */}
        {appointment.notes && (
          <div
            data-testid="appointment-panel-note"
            className="flex gap-2.5 rounded-[10px] border border-warning-border bg-warning-soft p-3"
          >
            <TriangleAlert
              className="mt-px size-[15px] shrink-0 text-(--color-status-pending-text)"
              strokeWidth={1.75}
            />
            <div className="flex flex-col gap-[3px]">
              <span className="text-[11px] font-semibold tracking-[0.06em] text-(--color-status-pending-text) uppercase">
                Nota
              </span>
              <span className="text-[12px] leading-[1.45] text-warning-text">{appointment.notes}</span>
            </div>
          </div>
        )}

        {/* Meta (`:309-312`): con relativo, SOLO en escritorio (D15). */}
        <div className="flex items-center gap-[7px]">
          <Clock className="size-[13px] text-muted-foreground-2" strokeWidth={1.75} />
          <span data-testid="appointment-panel-meta" className="text-[11px] text-muted-foreground-2">
            {getAppointmentPanelMeta(appointment)}
          </span>
        </div>
      </div>

      <AppointmentActions
        status={appointment.status}
        variant="panel"
        onStatusChange={handleStatusChange}
        onCancelRequest={() => setCancelDialogOpen(true)}
        onReschedule={handleReschedule}
        isPending={updateStatus.isPending}
      />

      <CancelAppointmentDialog
        appointmentId={appointment.id}
        clientName={appointment.clientName}
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onCancelled={onClose}
      />
    </aside>
  )
}
