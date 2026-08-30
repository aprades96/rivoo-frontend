"use client"

import { Scissors } from "lucide-react"
import { useEmployees } from "@/hooks/use-staff"
import { useWizardStore } from "@/lib/stores/wizard-store"
import {
  employeeAvatarAlphaStyle,
  employeeFallbackAvatarClassName,
  employeePaletteIndex,
} from "@/lib/utils/avatar"
import { formatDurationTight } from "@/lib/utils/dates"
import { initials } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { formatWizardContextPill } from "./wizard-summary"
import type { Employee } from "@/types/employee"
import type { ServiceOffering } from "@/types/service"

/**
 * Contexto ya elegido, en pildoras -- MOVIL unicamente
 * (`design/NuevaCita{Paso2,Paso3,Paso4}.dc.html`). Ningun artboard de
 * escritorio las dibuja: ahi ese contexto vive en el subtitulo y en el
 * aside (`NewAppointmentShell`) -- brief T3.
 *
 * Sin props: los cuatro campos (incluido `step`) salen del store
 * directamente, igual que el resto de pasos del asistente
 * (`employee-step.tsx`). La variante se deriva del PASO (D32), no de si ya
 * hay fecha/hora elegida: cada paso pinta como contexto lo YA resuelto en
 * pasos ANTERIORES, nunca lo que el propio paso esta pidiendo ahora mismo.
 * Derivar de `hasDateTime` rompia justo el frame que cada artboard retrata --
 * `NuevaCitaPaso3.dc.html:49-58` dibuja el hueco de las 11:00 ya elegido EN
 * esa misma pantalla y aun asi solo pinta 2 pildoras (profesional + servicio
 * con tijeras+duracion), nunca una tercera de fecha/hora. Y al volver de
 * 3->2 el store conserva servicio/fecha/hora (`wizard-store.ts` solo los
 * limpia al ELEGIR de nuevo, no al retroceder), asi que un paso 2 basado en
 * los datos pintaria de mas -- `NuevaCitaPaso2.dc.html:49-54` solo dibuja la
 * de profesional. Leer `step` del store evita ademas anadir un prop que los
 * cinco ficheros de paso tendrian que mantener en sincronia.
 *
 * Formas medidas: 2 pildoras de 32px con tijeras+duracion en el paso 3
 * (`NuevaCitaPaso3.dc.html:50,54-56`), 1 sola (profesional) en el paso 2
 * (`NuevaCitaPaso2.dc.html:49-54`), 3 de 30px sin tijeras ni duracion desde
 * el paso 4 (`NuevaCitaPaso4.dc.html:51-58`).
 */
export function WizardContextPills() {
  const { step, selectedEmployee, selectedService, selectedDate, selectedSlot } = useWizardStore()
  const { data } = useEmployees()
  const employees = data?.content ?? []

  if (!selectedEmployee && !selectedService) return null

  const isLateVariant = step >= 4
  const heightClass = isLateVariant ? "h-[30px]" : "h-[32px]"
  // `gap: 7px` en las pildoras de profesional de los pasos 2-3
  // (`NuevaCitaPaso2.dc.html:50`, `NuevaCitaPaso3.dc.html:50`); la del paso 4
  // usa el `gap: 6px` de `.chip` (`NuevaCitaPaso4.dc.html:20,52`) -- no tocar
  // ese caso, es el que ya estaba bien.
  const employeeGapClass = isLateVariant ? "gap-1.5" : "gap-[7px]"
  const showService = step >= 3 && Boolean(selectedService)
  const showDateTime = step >= 4 && Boolean(selectedDate && selectedSlot)

  return (
    <div className="flex gap-1.5">
      {selectedEmployee && (
        <EmployeePill
          employee={selectedEmployee}
          employees={employees}
          heightClass={heightClass}
          gapClass={employeeGapClass}
        />
      )}
      {showService && selectedService && (
        <ServicePill service={selectedService} withDetail={step === 3} heightClass={heightClass} />
      )}
      {showDateTime && selectedDate && selectedSlot && (
        <DateTimePill date={selectedDate} slot={selectedSlot} heightClass={heightClass} />
      )}
    </div>
  )
}

function EmployeePill({
  employee,
  employees,
  heightClass,
  gapClass,
}: {
  employee: Employee
  employees: Employee[]
  heightClass: string
  gapClass: string
}) {
  // Nunca del hex del artboard: dos de estas pildoras dibujan a la misma
  // empleada de dos colores distintos, y ese desliz del canvas no se
  // replica. `-1 -> 0` cuando el empleado todavia no esta en la lista
  // (`useEmployees` en vuelo o empleado inactivo) -- OJO, no
  // `employeePaletteIndex` en si (que ya normaliza negativos con modulo):
  // pasar -1 directamente a `employeeFallbackAvatarClassName` caeria en el
  // ULTIMO color de la paleta (modulo negativo), no en el primero, que es lo
  // que aqui se quiere para "todavia no esta en la lista".
  const rawIndex = employeePaletteIndex(employees, employee.id)
  const fallbackIndex = rawIndex === -1 ? 0 : rawIndex

  return (
    <div
      className={cn(
        "flex items-center rounded-full border border-border bg-card pr-[11px] pl-[5px] text-xs",
        gapClass,
        heightClass
      )}
    >
      <span
        className={cn(
          "flex size-[22px] shrink-0 items-center justify-center rounded-full text-[9px] leading-none font-bold",
          !employee.colorHex && employeeFallbackAvatarClassName(fallbackIndex)
        )}
        style={employee.colorHex ? employeeAvatarAlphaStyle(employee.colorHex) : undefined}
      >
        {initials(employee.firstName, employee.lastName)}
      </span>
      {employee.firstName}
    </div>
  )
}

function ServicePill({
  service,
  withDetail,
  heightClass,
}: {
  service: ServiceOffering
  withDetail: boolean
  heightClass: string
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-border bg-card px-[11px] text-xs whitespace-nowrap",
        heightClass
      )}
    >
      {withDetail && <Scissors className="size-[13px] shrink-0 text-muted-foreground" aria-hidden="true" />}
      {withDetail ? `${service.name} · ${formatDurationTight(service.durationMinutes)}` : service.name}
    </div>
  )
}

function DateTimePill({ date, slot, heightClass }: { date: string; slot: string; heightClass: string }) {
  return (
    <div
      className={cn(
        "flex items-center rounded-full border border-border bg-card px-[11px] text-xs tabular-nums",
        heightClass
      )}
    >
      {formatWizardContextPill(date, slot)}
    </div>
  )
}
