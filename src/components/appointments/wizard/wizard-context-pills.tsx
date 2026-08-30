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
 * Sin props: los tres campos salen del store directamente, igual que el
 * resto de pasos del asistente (`employee-step.tsx`). La ALTURA y el
 * contenido de la pildora de servicio cambian los DOS a la vez en cuanto hay
 * fecha/hora elegida -- 32px con tijeras+duracion en los pasos 2-3
 * (`NuevaCitaPaso{2,3}.dc.html:50`), 30px en texto pelado en el paso 4
 * (`NuevaCitaPaso4.dc.html:20,56`) -- asi que se deriva de un unico booleano
 * (`hasDateTime`) en vez de un prop "step" que cada paso de la ola siguiente
 * tendria que mantener en sincronia con lo que el store ya sabe.
 */
export function WizardContextPills() {
  const { selectedEmployee, selectedService, selectedDate, selectedSlot } = useWizardStore()
  const { data } = useEmployees()
  const employees = data?.content ?? []

  if (!selectedEmployee && !selectedService) return null

  const hasDateTime = Boolean(selectedDate && selectedSlot)
  const heightClass = hasDateTime ? "h-[30px]" : "h-[32px]"

  return (
    <div className="flex gap-1.5">
      {selectedEmployee && (
        <EmployeePill employee={selectedEmployee} employees={employees} heightClass={heightClass} />
      )}
      {selectedService && (
        <ServicePill service={selectedService} withDetail={!hasDateTime} heightClass={heightClass} />
      )}
      {selectedDate && selectedSlot && (
        <DateTimePill date={selectedDate} slot={selectedSlot} heightClass={heightClass} />
      )}
    </div>
  )
}

function EmployeePill({
  employee,
  employees,
  heightClass,
}: {
  employee: Employee
  employees: Employee[]
  heightClass: string
}) {
  // Nunca del hex del artboard: dos de estas pildoras dibujan a la misma
  // empleada de dos colores distintos, y ese desliz del canvas no se
  // replica. `-1 -> 0` cuando el empleado todavia no esta en la lista
  // (`useEmployees` en vuelo o empleado inactivo).
  const rawIndex = employeePaletteIndex(employees, employee.id)
  const fallbackIndex = rawIndex === -1 ? 0 : rawIndex

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-border bg-card pr-[11px] pl-[5px] text-xs",
        heightClass
      )}
    >
      <span
        className={cn(
          "flex size-[22px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
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
