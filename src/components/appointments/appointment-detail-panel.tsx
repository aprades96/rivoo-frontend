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
import {
  employeeAvatarAlphaStyle,
  employeeFallbackAvatarClassName,
  employeePaletteIndex,
} from "@/lib/utils/avatar"
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
  //
  // Hallazgo 3: ese mismo caracter global lo deja ciego a que OTRO listener
  // atienda el mismo Escape. Dos guardas, de naturaleza distinta:
  //   - `event.defaultPrevented` -- SENAL EXPLICITA. El buscador
  //     (`calendar-search.tsx`) llama a `preventDefault()` en su propio
  //     `onKeyDown` cuando pliega el campo con Escape: es la forma estandar de
  //     decir "esto ya lo he consumido yo", y cualquier otro emisor futuro
  //     puede sumarse con el mismo gesto sin que este componente tenga que
  //     conocerlo. Antes se adivinaba mirando si el foco seguia en un
  //     INPUT/TEXTAREA, una heuristica que dejaba de cubrir en cuanto el foco
  //     se movia (o si el emisor no era un campo de texto) -- una senal
  //     explicita la hace innecesaria.
  //   - `[role="dialog"], [role="alertdialog"]` -- SIGUE haciendo falta, y no
  //     se puede sustituir por lo de arriba: Base UI (dialogo de cancelacion)
  //     no llama a `preventDefault` en su Escape, y su listener vive en el
  //     MISMO nodo `document` (`useDismiss.js:399`), asi que ni
  //     `defaultPrevented` ni `stopPropagation` lo frenan -- el orden de
  //     registro tampoco es una garantia estable de la que fiarse. Por eso se
  //     comprueba el ESTADO real del documento: mientras el dialogo este
  //     montado, esta abierto.
  useEffect(() => {
    if (!appointment) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      if (event.defaultPrevented) return
      const dialogIsOpen = document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
      if (dialogIsOpen) return
      onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [appointment, onClose])

  if (!appointment) return null

  const employees = employeesData?.content ?? []
  const employeeIndex = employees.findIndex((candidate) => candidate.id === appointment.employeeId)
  const employee = employeeIndex >= 0 ? employees[employeeIndex] : undefined
  // Posicion en la paleta de reserva (D12, hallazgo 2): resolutor UNICO
  // (`lib/utils/avatar.ts`) compartido con `groupByEmployee` y
  // `EmployeeFilter`, que calcula sobre la lista de ACTIVOS -- no sobre la
  // cruda de `useEmployees()` como hacia antes este fichero. `-1` (no
  // encontrado o inactivo) se mapea a 0, la misma posicion que ya documenta
  // la funcion para el empleado ausente: pasarle -1 tal cual caeria en la
  // ULTIMA entrada de la paleta (normalizacion de negativos de
  // `paletteIndex`) y cambiaria el color de hoy en silencio.
  const resolvedPaletteIndex = employeePaletteIndex(employees, appointment.employeeId)
  const fallbackIndex = resolvedPaletteIndex === -1 ? 0 : resolvedPaletteIndex

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
        <span
          data-testid="appointment-panel-label"
          className="text-[12px] leading-tight font-semibold tracking-[0.06em] text-muted-foreground-2 uppercase"
        >
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
      <div
        data-testid="appointment-panel-scroll"
        className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto"
      >
        <div className="flex flex-col gap-[7px]">
          <span
            data-testid="appointment-panel-status"
            className={cn(
              "self-start rounded-full px-2.5 py-1 text-[11px] leading-tight font-bold",
              statusConfig[appointment.status].className
            )}
          >
            {getAppointmentStatusLabel(appointment, "panel")}
          </span>
          <span
            data-testid="appointment-panel-time"
            className="text-[30px] leading-[1.1] font-semibold tracking-[-0.02em] tabular-nums"
          >
            {getAppointmentTimeRange(appointment)}
          </span>
          <span data-testid="appointment-panel-date" className="text-[13px] leading-tight text-muted-foreground">
            {getAppointmentDateAndDuration(appointment)}
          </span>
        </div>

        {/* Tarjeta cliente (`:264-280`). SOLO nombre, telefono y contacto --
            el email es de la hoja de movil, no de aqui (§1.2 diferencia 5). */}
        <div
          data-testid="appointment-panel-client-card"
          className="flex items-center gap-3 rounded-[10px] border border-border bg-card p-3"
        >
          <div
            data-testid="appointment-panel-client-icon"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"
          >
            <User className="size-[17px] text-primary" strokeWidth={1.75} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="truncate text-[14px] leading-tight font-semibold">{appointment.clientName}</span>
            {appointment.clientPhone && (
              <span className="truncate text-[12px] leading-tight tabular-nums text-muted-foreground">
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
        <div
          data-testid="appointment-panel-service-card"
          className="flex items-center gap-3 rounded-[10px] border border-border bg-card p-3"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <Scissors className="size-[17px] text-primary" strokeWidth={1.75} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="truncate text-[14px] leading-tight font-semibold">{appointment.serviceName}</span>
            <span className="text-[12px] leading-tight text-muted-foreground">
              {formatDuration(appointment.serviceDurationMinutes)}
            </span>
          </div>
          <span
            data-testid="appointment-panel-price"
            className="shrink-0 text-[17px] leading-tight font-semibold tracking-[-0.02em] tabular-nums"
          >
            {getAppointmentServicePrice(appointment)}
          </span>
        </div>

        {/* Tarjeta empleado (`:293-299`): avatar de iniciales, sin `.ico` y
            sin acciones. Degradacion D11 si el empleado no aparece. */}
        <div
          data-testid="appointment-panel-employee-card"
          className="flex items-center gap-3 rounded-[10px] border border-border bg-card p-3"
        >
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
            <span className="truncate text-[14px] leading-tight font-semibold">{appointment.employeeName}</span>
            {employee?.jobTitle && (
              <span className="truncate text-[12px] leading-tight text-muted-foreground">{employee.jobTitle}</span>
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
              <span className="text-[11px] leading-tight font-semibold tracking-[0.06em] text-(--color-status-pending-text) uppercase">
                Nota
              </span>
              <span className="text-[12px] leading-[1.45] text-warning-text">{appointment.notes}</span>
            </div>
          </div>
        )}

        {/* Meta (`:309-312`): con relativo, SOLO en escritorio (D15). */}
        <div className="flex items-center gap-[7px]">
          <Clock className="size-[13px] text-muted-foreground-2" strokeWidth={1.75} />
          <span data-testid="appointment-panel-meta" className="text-[11px] leading-tight text-muted-foreground-2">
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

      {/*
        SIN `onCancelled`: cancelar NO cierra el panel, igual que confirmar
        tampoco lo cierra. Solo lo cierran la X y `Escape` (D9).

        Tratar las dos acciones distinto era incoherente dentro del mismo
        componente, y ademas sobraba: el calendario NO esconde las citas
        canceladas (`(app)/calendar/page.tsx:149-155` -- una cancelada sigue
        ocupando su franja hasta que alguien la reasigne), asi que la cita
        sigue en `dayAppointments` y el panel, que la DERIVA por id (D16), pasa
        solo a "Cancelada" y se queda sin acciones porque es un estado
        terminal. Eso es informacion; cerrarse de golpe la esconde.

        La hoja de movil SI se cierra tras actuar, y es correcto: tapa la
        pantalla entera, asi que quedarse abierta esconderia la agenda. El
        panel convive con la rejilla.

        `key={appointment.id}` NO es decorativo, es quien sostiene la
        invariante (hallazgo 1 de la re-revision): D9 dice que este panel NO
        se desmonta al cambiar de cita, solo cambia de contenido -- y sin
        `key` este dialogo seria la MISMA instancia de React al saltar de una
        cita a otra. Eso deja dos fugas demostradas: un `onError` que aterriza
        tarde escribe el error de la cita VIEJA sobre el dialogo de la NUEVA
        (cancelas a Ana, "Volver", falla, abres el de Carla y ahi esta el
        error de Ana), y `useCancelAppointment()` -- que vive DENTRO de
        `CancelAppointmentDialog`, no aqui -- es la misma instancia para las
        dos citas, asi que el boton de Carla sale deshabilitado por la
        mutacion en vuelo de Ana. Cambiar el `key` fuerza a React a destruir
        la instancia vieja y montar una limpia: es la unica via, porque un
        efecto no puede cancelar una mutacion ya en vuelo ni impedir que su
        callback aterrice sobre el estado equivocado.
      */}
      <CancelAppointmentDialog
        key={appointment.id}
        appointmentId={appointment.id}
        clientName={appointment.clientName}
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
      />
    </aside>
  )
}
