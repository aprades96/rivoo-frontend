"use client"

import { useRef, useState } from "react"
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
import { employeePaletteIndex, employeeSolidColor } from "@/lib/utils/avatar"
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

  /**
   * Hallazgo 5: `calendar/page.tsx:428-429` pasa `open={selectedAppointment
   * !== null}` y limpia la cita en el MISMO render en que `open` pasa a
   * `false`. Sin conservar la ultima cita, el componente devolvia `null` de
   * golpe, desmontando el `<Sheet>` entero -- y con el su estado interno de
   * transicion -- antes de que `data-ending-style` llegase a aplicarse. Se
   * guarda DENTRO del componente para que la animacion no dependa de como lo
   * conduzca cada pagina (`/today` la conserva ella misma y por eso ahi la
   * hoja si se desliza).
   */
  const lastAppointmentRef = useRef<Appointment | null>(null)
  if (appointment) lastAppointmentRef.current = appointment
  const activeAppointment = appointment ?? lastAppointmentRef.current

  if (!activeAppointment) return null

  const employees = employeesData?.content ?? []
  const employee = employees.find((candidate) => candidate.id === activeAppointment.employeeId) ?? null
  // Hallazgo 2: la posicion en la paleta se calcula sobre empleados ACTIVOS
  // (`employeePaletteIndex`), igual que `groupByEmployee` y `EmployeeFilter`
  // -- no sobre la lista cruda de `useEmployees()`, que desincroniza el color
  // de este punto del de todo lo demas. Empleado ausente o inactivo en la
  // paleta (D11): color de reserva por posicion 0 -- `paletteIndex` normaliza
  // negativos con modulo, y pasarle -1 tal cual caeria en la ULTIMA entrada.
  const paletteIndex = employeePaletteIndex(employees, activeAppointment.employeeId)
  const pointColor = employeeSolidColor(employee?.colorHex ?? null, paletteIndex >= 0 ? paletteIndex : 0)

  const handleStatusChange = (status: AppointmentStatus) => {
    updateStatus.mutate(
      { id: activeAppointment.id, status },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          // Hallazgo 3: `#2A2320` es el token `--foreground` (`globals.css:114`);
          // mismo color y misma opacidad (42%) que la `rgba` a pelo del artboard.
          overlayClassName="bg-foreground/42"
          // Hallazgo 3: `rounded-t-2xl` = `calc(0.5rem * 1.8)` = 14,4px
          // (`globals.css:65`), no los 16px que dibuja `:36`.
          className="max-h-[85vh] overflow-y-auto rounded-t-[16px] px-4 pt-[10px] pb-5 shadow-[0_-8px_30px_rgba(42,35,32,0.2)] data-[side=bottom]:border-t-0"
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
              className={`inline-flex items-center rounded-full px-[10px] py-1 text-[11px] font-semibold ${statusConfig[activeAppointment.status].className}`}
            >
              {getAppointmentStatusLabel(activeAppointment, "sheet")}
            </span>
          </div>

          {/*
            Lista de hechos (`:47-93`). Hallazgo 1: el artboard no declara
            `line-height` en ninguna de estas lineas (`:52,53,60,61,77,78,86`),
            asi que valen `normal` (~1,25); sin `leading-tight` heredan el 1,5
            de la preflight de Tailwind (mismo diagnostico que
            `appointment-block.tsx:116-126`). El orden importa: `leading-*`
            SIEMPRE detras del `text-[Npx]`/`text-xs`/`text-sm` que acompana,
            porque tailwind-merge descarta en silencio un `leading-*` que vaya
            antes.
          */}
          <div data-testid="detail-sheet-facts" className="flex flex-col gap-3.5">
            <div className="flex items-start gap-3">
              <Clock className="mt-px size-[18px] shrink-0 text-muted-foreground-2" strokeWidth={1.75} />
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] leading-tight font-semibold tabular-nums">
                  {getAppointmentTimeRange(activeAppointment)}
                </span>
                <span className="text-xs leading-tight text-muted-foreground">
                  {getAppointmentDateAndDuration(activeAppointment)}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="mt-px size-[18px] shrink-0 text-muted-foreground-2" strokeWidth={1.75} />
              <div className="flex flex-col gap-1">
                <span className="text-[15px] leading-tight font-semibold">{activeAppointment.clientName}</span>
                <div className="flex items-center gap-3.5 text-xs leading-tight text-muted-foreground">
                  {activeAppointment.clientPhone && (
                    <span className="flex items-center gap-[5px]">
                      <Phone className="size-3" strokeWidth={1.75} />
                      <span className="tabular-nums">{formatPhone(activeAppointment.clientPhone)}</span>
                    </span>
                  )}
                  {activeAppointment.clientEmail && (
                    <span className="flex items-center gap-[5px]">
                      <Mail className="size-3" strokeWidth={1.75} />
                      {activeAppointment.clientEmail}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Scissors className="mt-px size-[18px] shrink-0 text-muted-foreground-2" strokeWidth={1.75} />
              <div className="flex flex-col gap-0.5">
                <span className="text-[15px] leading-tight font-semibold">{activeAppointment.serviceName}</span>
                <span className="text-xs leading-tight tabular-nums text-muted-foreground">
                  {getAppointmentServiceSummary(activeAppointment)}
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
              <span className="text-sm leading-tight">{activeAppointment.employeeName}</span>
            </div>

            {activeAppointment.notes && (
              <div className="flex items-start gap-3">
                <FileText className="mt-px size-[18px] shrink-0 text-muted-foreground-2" strokeWidth={1.75} />
                {/* `:91` SI declara line-height (1.45): se deja tal cual. */}
                <p className="text-[13px] leading-[1.45] text-muted-foreground">{activeAppointment.notes}</p>
              </div>
            )}
          </div>

          <Separator />

          <AppointmentActions
            status={activeAppointment.status}
            variant="sheet"
            onStatusChange={handleStatusChange}
            onCancelRequest={() => setCancelDialogOpen(true)}
            isPending={updateStatus.isPending}
          />

          <span className="text-[11px] leading-tight text-muted-foreground-2">
            {getAppointmentSheetMeta(activeAppointment)}
          </span>
        </SheetContent>
      </Sheet>

      <CancelAppointmentDialog
        appointmentId={activeAppointment.id}
        clientName={activeAppointment.clientName}
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        onCancelled={() => onOpenChange(false)}
      />
    </>
  )
}
