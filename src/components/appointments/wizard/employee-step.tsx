"use client"

import { useEffect, useMemo } from "react"
import type { CSSProperties } from "react"
import { format } from "date-fns"
import { ChevronRight, Users } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { WizardSummaryAside } from "@/components/wizard/wizard-summary-aside"
import { NewAppointmentShell } from "./new-appointment-shell"
import { useWizardNavigation } from "./use-wizard-navigation"
import { getWizardSummaryCta, getWizardSummaryRows, type WizardSummaryState } from "./wizard-summary"
import { useEmployees, useEmployeesWorkingHours } from "@/hooks/use-staff"
import { useTodayAppointments } from "@/hooks/use-appointments"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useWizardStore } from "@/lib/stores/wizard-store"
import { initials } from "@/lib/utils/format"
import {
  employeeAvatarAlphaStyle,
  employeeFallbackAvatarClassName,
  employeePaletteIndex,
} from "@/lib/utils/avatar"
import { cn } from "@/lib/utils"
import type { Employee, WorkingHoursResponse } from "@/types/employee"

// Tailwind's `lg:` breakpoint (1024px) -- keep in sync with `new-appointment-shell.tsx`.
// Needed here (not just inside the shell) because the mobile/desktop row
// markup genuinely differs (column list vs 2-col grid, chevron vs "citas
// hoy" column, avatar 40px vs 44px), so per the width-difference rule this
// is decided once in JS, not with `hidden lg:...` pairs that would leave
// both variants in the DOM (see `booking-step-shell.test.tsx:24`).
const DESKTOP_QUERY = "(min-width: 1024px)"

/**
 * Convenio de `WorkingHoursResponse.dayOfWeek`: lunes = 1 ... domingo = 7
 * (`business-hours.ts:79`, `calendar/page.test.tsx:128`). `Date#getDay()`
 * devuelve domingo = 0, de ahi la envoltura.
 */
function todayDayOfWeek(now: Date): number {
  const jsDay = now.getDay()
  return jsDay === 0 ? 7 : jsDay
}

/**
 * `undefined` (horario todavia sin resolver, `useEmployeesWorkingHours`
 * asincrona) cuenta como "trabaja": atenuar antes de saber la respuesta real
 * pintaria un parpadeo, y un instante sin atenuar es menos enganoso que un
 * instante atenuado por error.
 */
function isWorkingToday(hours: WorkingHoursResponse[] | undefined, dayOfWeek: number): boolean {
  if (!hours) return true
  return hours.find((h) => h.dayOfWeek === dayOfWeek)?.isOpen ?? true
}

interface AvatarVisual {
  className?: string
  style?: CSSProperties
}

/**
 * El empleado que hoy no trabaja lleva SIEMPRE el par fijo `avatar-muted`,
 * por delante de su propio `colorHex` -- la atenuacion es del avatar entero
 * (`NuevaCitaPaso1.dc.html:89`), no solo del texto que lo acompana.
 */
function resolveAvatarVisual(employee: Employee, employees: Employee[], working: boolean): AvatarVisual {
  if (!working) return { className: "bg-avatar-muted text-muted-foreground-2" }

  if (employee.colorHex) return { style: employeeAvatarAlphaStyle(employee.colorHex) }

  // El backend nunca deja `colorHex` nulo en la practica
  // (`EmployeeService.java:81`), asi que esta rama casi no corre -- se
  // cablea igual porque es el mismo contrato que ya usan el calendario y la
  // ficha de empleado. `findIndex` devuelve -1 si no esta; `paletteIndex`
  // normaliza los negativos hacia el ULTIMO color, asi que aqui se fuerza a
  // 0 en vez de dejar que la reserva caiga en la posicion final.
  const index = employeePaletteIndex(employees, employee.id)
  return { className: employeeFallbackAvatarClassName(index === -1 ? 0 : index) }
}

/**
 * Subtitulo bajo el nombre. El empleado que hoy no trabaja lleva un texto
 * DISTINTO por ancho: movil conserva el puesto ("Estilista · hoy no
 * trabaja", `NuevaCitaPaso1.dc.html:92`), escritorio lo sustituye entero por
 * "Hoy no trabaja" (`NuevaCitaDesktopPaso1.dc.html:116`) -- dos textos
 * medidos, no una variacion de mayusculas del mismo.
 */
function employeeSubtitle(employee: Employee, working: boolean, isDesktop: boolean): string | null {
  if (working) return employee.jobTitle
  if (isDesktop) return "Hoy no trabaja"
  return [employee.jobTitle, "hoy no trabaja"].filter(Boolean).join(" · ")
}

/**
 * Paso 1 del asistente de nueva cita (Profesional). Unico paso del bloque
 * que resuelve el prefill de `?employeeId=...`: `NewAppointmentPageContent`
 * (`(fullscreen)/appointments/new/page.tsx`) solo siembra
 * `preferredEmployeeId` porque `selectedEmployee` guarda el `Employee`
 * COMPLETO y su unica fuente es `useEmployees`, asincrona -- este es el
 * unico paso que ya monta esa query.
 */
export function EmployeeStep() {
  const { data, isLoading: employeesLoading } = useEmployees()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const { onClose } = useWizardNavigation()

  const {
    selectedEmployee,
    anyEmployee,
    selectedService,
    selectedDate,
    selectedSlot,
    selectedClient,
    newClientData,
    preferredEmployeeId,
    selectEmployee,
    nextStep,
  } = useWizardStore()

  const employees = useMemo(() => data?.content?.filter((e) => e.isActive) ?? [], [data])
  const employeeIds = useMemo(() => employees.map((e) => e.id), [employees])

  const { data: workingHoursByEmployee } = useEmployeesWorkingHours(employeeIds)

  const today = format(new Date(), "yyyy-MM-dd")
  const { data: todayAppointments } = useTodayAppointments(today)

  // Sin las CANCELLED: una cita cancelada no es carga de trabajo, y contarla
  // desalinearia el numero de lo que ese empleado ve en su propia columna
  // del calendario.
  const appointmentCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const appointment of todayAppointments?.content ?? []) {
      if (appointment.status === "CANCELLED") continue
      counts[appointment.employeeId] = (counts[appointment.employeeId] ?? 0) + 1
    }
    return counts
  }, [todayAppointments])

  const dayOfWeek = todayDayOfWeek(new Date())

  // Resuelve el prefill: si `preferredEmployeeId` casa con un empleado
  // activo de la lista ya cargada, lo selecciona y avanza al paso 2; si no
  // casa (id de un empleado desactivado, borrado, o invalido), limpia la
  // preferencia para no dejarla colgada y que el usuario elija a mano.
  useEffect(() => {
    if (!preferredEmployeeId || employeesLoading) return

    const matched = employees.find((employee) => employee.id === preferredEmployeeId)
    if (matched) {
      selectEmployee(matched, false)
      nextStep()
    } else {
      useWizardStore.setState({ preferredEmployeeId: null })
    }
  }, [preferredEmployeeId, employeesLoading, employees, selectEmployee, nextStep])

  const handleSelect = (employee: Employee | null, any: boolean) => {
    selectEmployee(employee, any)
    nextStep()
  }

  const summaryState: WizardSummaryState = {
    selectedEmployee,
    anyEmployee,
    selectedService,
    selectedDate,
    selectedSlot,
    selectedClient,
    newClientData,
  }
  const summaryRows = getWizardSummaryRows(summaryState, 1)
  const cta = getWizardSummaryCta(summaryState, 1)

  // `heading`/`note` por defecto de `WizardSummaryAside` son los de la
  // reserva PUBLICA (`NuevaCitaDesktopPaso1.dc.html:123` dice "Resumen", y
  // ningun artboard del asistente interno dibuja la nota de confianza: una
  // cita creada a mano por el salon ni es "sin registro" ni se cancela
  // gratis).
  const aside = (
    <WizardSummaryAside
      rows={summaryRows}
      ctaLabel={cta.label}
      ctaDisabled={cta.disabled}
      heading="Resumen"
      note={null}
    />
  )

  return (
    <NewAppointmentShell
      step={1}
      title="Elige un profesional"
      // El artboard de escritorio (`:61`) dice "Solo aparecen los que
      // trabajan hoy." y el MISMO artboard pinta a Julia Ventura, que hoy no
      // trabaja (`:112`) -- se contradice. La linea del chasis solo se pinta
      // en escritorio (`NewAppointmentShellProps.subtitle`), asi que basta
      // con pasarla siempre: en movil el propio chasis la ignora.
      subtitle="Quien atendera al cliente."
      onClose={onClose}
      aside={aside}
    >
      {employeesLoading ? (
        <LoadingSkeleton count={4} />
      ) : (
        <div
          data-testid="employee-options"
          className={cn("flex flex-col gap-2.5", isDesktop && "grid grid-cols-2 gap-[14px]")}
        >
          <button
            type="button"
            aria-pressed={anyEmployee}
            onClick={() => handleSelect(null, true)}
            className={cn(
              "flex w-full items-center gap-3 rounded-[10px] border border-dashed border-border-dashed bg-muted p-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              isDesktop && "gap-[14px] p-4",
              anyEmployee && "border-primary bg-primary/5"
            )}
          >
            <div
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full bg-border text-muted-foreground",
                isDesktop ? "size-11" : "size-10"
              )}
            >
              <Users className={isDesktop ? "size-5" : "size-[19px]"} />
            </div>
            <div className="flex flex-1 flex-col gap-0.5">
              <p className="text-[15px] leading-tight font-semibold">Sin preferencia</p>
              <p className="text-xs leading-tight text-muted-foreground">Cualquier disponible</p>
            </div>
            {!isDesktop && <ChevronRight className="size-[18px] shrink-0 text-text-subtle" />}
          </button>

          {employees.map((employee) => {
            const working = isWorkingToday(workingHoursByEmployee[employee.id], dayOfWeek)
            const isSelected = !anyEmployee && selectedEmployee?.id === employee.id
            const avatarVisual = resolveAvatarVisual(employee, employees, working)
            const subtitle = employeeSubtitle(employee, working, isDesktop)
            const fullName = `${employee.firstName} ${employee.lastName}`.trim()
            const appointmentCount = appointmentCounts[employee.id] ?? 0

            return (
              <button
                key={employee.id}
                type="button"
                aria-pressed={isSelected}
                // El que hoy no trabaja SIGUE siendo pulsable: el empleado
                // se elige aqui y la fecha en el paso 3, y el asistente
                // reserva a 30 dias vista -- bloquear la fila dejaria a esa
                // persona sin poder recibir ninguna cita, ningun dia, por
                // librar HOY. La atenuacion informa, no deshabilita.
                onClick={() => handleSelect(employee, false)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[10px] border border-border bg-card p-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  isDesktop && "gap-[14px] p-4",
                  !working && (isDesktop ? "opacity-50" : "opacity-[0.55]"),
                  isSelected && "border-primary bg-primary/5"
                )}
              >
                <Avatar className={isDesktop ? "size-11" : "size-10"}>
                  <AvatarFallback
                    className={cn(
                      isDesktop ? "text-sm" : "text-[13px] leading-tight",
                      "font-semibold",
                      avatarVisual.className
                    )}
                    style={avatarVisual.style}
                  >
                    {initials(employee.firstName, employee.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-1 flex-col gap-0.5">
                  <p className="text-[15px] leading-tight font-semibold">{fullName}</p>
                  {subtitle && <p className="text-xs leading-tight text-muted-foreground">{subtitle}</p>}
                </div>
                {isDesktop ? (
                  // Sin columna de citas para quien hoy no trabaja
                  // (`NuevaCitaDesktopPaso1.dc.html:112`): un "0 citas hoy"
                  // leeria como que si trabaja pero esta libre, cuando lo
                  // cierto es que no hay agenda ese dia.
                  working && (
                    <div className="flex shrink-0 flex-col items-end">
                      <span className="text-[13px] leading-tight font-semibold tabular-nums">{appointmentCount}</span>
                      <span className="text-[10px] leading-tight text-muted-foreground-2">citas hoy</span>
                    </div>
                  )
                ) : (
                  <ChevronRight className="size-[18px] shrink-0 text-text-subtle" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </NewAppointmentShell>
  )
}
