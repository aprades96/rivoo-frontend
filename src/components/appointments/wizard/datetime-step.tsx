"use client"

import { useEffect, useMemo, useState } from "react"
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { WizardSummaryAside } from "@/components/wizard/wizard-summary-aside"
import { NewAppointmentShell } from "./new-appointment-shell"
import { WizardContextPills } from "./wizard-context-pills"
import { useWizardNavigation } from "./use-wizard-navigation"
import {
  formatWizardDayFooter,
  formatWizardTimeRange,
  getWizardSummaryCta,
  getWizardSummaryRows,
} from "./wizard-summary"
import { useWizardAvailability, type WizardSlot } from "@/hooks/use-wizard-availability"
import { useEmployees, useEmployeesServices, useEmployeesWorkingHours } from "@/hooks/use-staff"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useWizardStore } from "@/lib/stores/wizard-store"
import { AFTERNOON_HOUR, formatDurationTight } from "@/lib/utils/dates"
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import type { WorkingHoursResponse } from "@/types/employee"

// Tailwind's `lg:` breakpoint (1024px) -- keep in sync with `new-appointment-shell.tsx`.
const DESKTOP_QUERY = "(min-width: 1024px)"

// Horizonte de reserva: 30 dias, igual que `public-datetime-step.tsx:28`. Los
// artboards (`design/NuevaCita{,Desktop}Paso3.dc.html`) dibujan una tira de
// seis celdas y una rejilla de siete, pero eso es el ANCHO visible, no el
// limite -- recortar el horizonte a esas celdas seria una regresion del
// asistente ya existente (`datetime-step.tsx` original, `DAYS_AHEAD = 30`).
const MOBILE_STRIP_DAYS = 30
const DESKTOP_WEEK_SIZE = 7
const DESKTOP_WEEK_PAGES = 4 // 4 x 7 = 28 dias, horizonte similar al de la tira movil.

/**
 * Si NINGUN empleado de `employeeIds` trabaja `date`, segun `hoursByEmployee`
 * (`useEmployeesWorkingHours`). Mismo convenio de `dayOfWeek` que
 * `isDayClosed` de `public-datetime-step.tsx:45-50`, pero resuelto POR
 * EMPLEADO en vez de por salon: con "Sin preferencia" el dia esta abierto si
 * al menos uno del subconjunto trabaja. Un empleado sin dato todavia
 * (peticion en vuelo, o simplemente ninguno resuelto aun) cuenta como "podria
 * trabajar" -- nunca cierra un dia por falta de dato, y una lista vacia de
 * `employeeIds` nunca esta cerrada (no hay a quien preguntar todavia).
 */
function isDayClosed(
  date: Date,
  hoursByEmployee: Record<string, WorkingHoursResponse[]>,
  employeeIds: string[]
): boolean {
  if (employeeIds.length === 0) return false
  const jsDay = date.getDay()
  const dayOfWeek = jsDay === 0 ? 7 : jsDay
  return employeeIds.every((employeeId) => {
    const hours = hoursByEmployee[employeeId]?.find((h) => h.dayOfWeek === dayOfWeek)
    return hours ? !hours.isOpen : false
  })
}

export function DateTimeStep() {
  const { onClose, onBack } = useWizardNavigation()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  const wizardState = useWizardStore()
  const {
    selectedEmployee,
    anyEmployee,
    selectedService,
    selectedDate,
    selectedSlot,
    preferredDate,
    preferredSlot,
    selectDateTime,
    nextStep,
  } = wizardState

  // Ancla fijada al montar, igual que `public-datetime-step.tsx:75`: la
  // aritmetica de este paso (tira, rejilla, resolucion del primer dia
  // abierto) se basa en desplazamientos desde "hoy" y no debe recalcularse en
  // cada render.
  const [today] = useState(() => new Date())
  const [dayOffset, setDayOffset] = useState(0)
  const [weekPage, setWeekPage] = useState(0)
  const [resolved, setResolved] = useState(false)

  const { data: employeesData, isLoading: employeesLoading } = useEmployees()
  const activeEmployees = useMemo(
    () => employeesData?.content?.filter((e) => e.isActive) ?? [],
    [employeesData]
  )
  const activeEmployeeIds = useMemo(() => activeEmployees.map((e) => e.id), [activeEmployees])

  // Solo se consulta con "Sin preferencia": con un empleado concreto ya
  // elegido no hace falta saber que mas ofrece el servicio.
  const { data: employeeServicesById, isLoading: employeeServicesLoading } = useEmployeesServices(
    anyEmployee ? activeEmployeeIds : []
  )

  // Empleados sobre los que se pregunta disponibilidad. Con un profesional
  // concreto, el suyo. Con "Sin preferencia", los activos que ofrezcan el
  // servicio elegido -- nunca "any" sin filtrar: `AppointmentService.java:86`
  // obtiene el servicio solo para duracion y precio y no comprueba que el
  // empleado lo ofrezca, asi que preguntar sin filtrar dejaria crear una cita
  // en silencio con alguien que no hace ese servicio.
  const subsetEmployeeIds = useMemo(() => {
    if (!anyEmployee) return selectedEmployee ? [selectedEmployee.id] : []
    if (!selectedService) return []
    return activeEmployees
      .filter((e) => employeeServicesById[e.id]?.some((es) => es.serviceId === selectedService.id))
      .map((e) => e.id)
  }, [anyEmployee, selectedEmployee, selectedService, activeEmployees, employeeServicesById])

  const subsetLoading = anyEmployee && (employeesLoading || employeeServicesLoading)
  // Solo cuando la lista llega vacia Y ya se sabe con certeza (no a medio
  // cargar): el paso 2 pinta todos los servicios activos sin atenuar con
  // "Sin preferencia", asi que el usuario puede elegir uno que ningun
  // empleado ofrezca -- sin este aviso la pantalla se quedaria en blanco (no
  // se lanza ninguna peticion) sin causa visible.
  const noOneOffersService = anyEmployee && !subsetLoading && subsetEmployeeIds.length === 0

  const { data: hoursByEmployee } = useEmployeesWorkingHours(subsetEmployeeIds)

  const browseDate = addDays(today, dayOffset)
  const dateStr = format(browseDate, "yyyy-MM-dd")

  const { slots, isLoading: slotsLoading } = useWizardAvailability({
    employeeIds: subsetEmployeeIds,
    serviceId: selectedService?.id,
    date: dateStr,
  })

  const morningSlots = slots.filter((s) => Number(s.startTime.slice(0, 2)) < AFTERNOON_HOUR)
  const afternoonSlots = slots.filter((s) => Number(s.startTime.slice(0, 2)) >= AFTERNOON_HOUR)

  /*
   * NOTA sobre huecos ocupados (misma redaccion que
   * `public-datetime-step.tsx:119-128`, para que las dos pantallas digan lo
   * mismo): el artboard (`design/NuevaCitaPaso3.dc.html:92-93,98`) tambien
   * pinta los huecos ya reservados, tachados y no pulsables.
   * `AvailabilityResponse.slots` (`src/types/appointment.ts:99-103`) solo
   * trae los huecos LIBRES -- no hay ningun campo con los ocupados ni con el
   * total de la agenda del dia. No se puede distinguir "hueco ocupado" de
   * "hueco que no existe" con lo que manda el backend, asi que esta vista no
   * los pinta. Hueco de backend, no un olvido de esta implementacion.
   */

  // Resolucion del dia inicial: la preferencia de prefill si sigue vigente y
  // cae dentro del horizonte, si no "hoy" -- y desde ahi, el primer dia que SI
  // trabaje alguien del subconjunto (si el profesional elegido hoy no
  // trabaja, el paso abre en el primer dia que si trabaje, no en hoy). Se
  // espera a tener el subconjunto y sus horarios resueltos para no fijar un
  // dia con datos a medias.
  //
  // Ajuste DURANTE el render, no en un efecto: es una derivacion pura de
  // datos ya disponibles (nada de DOM ni de sistemas externos), y
  // `resolved` la deja correr una unica vez -- el patron que React
  // documenta para "ajustar estado a partir de props/datos" sin la
  // cascada de renders extra que provoca un `setState` sincrono dentro de
  // `useEffect` (`react-hooks/set-state-in-effect`).
  if (!resolved && !subsetLoading && !(anyEmployee && subsetEmployeeIds.length === 0)) {
    let offset = 0
    if (preferredDate) {
      const preferredOffset = differenceInCalendarDays(parseISO(preferredDate), today)
      if (preferredOffset >= 0 && preferredOffset < MOBILE_STRIP_DAYS) offset = preferredOffset
    }
    while (
      offset < MOBILE_STRIP_DAYS - 1 &&
      isDayClosed(addDays(today, offset), hoursByEmployee, subsetEmployeeIds)
    ) {
      offset += 1
    }

    setDayOffset(offset)
    setWeekPage(Math.floor(offset / DESKTOP_WEEK_SIZE))
    setResolved(true)
  }

  // Prefill del hueco: si el preferido sigue en la lista del dia ya resuelto
  // arriba, se selecciona formalmente (fecha+hora+empleado); si no aparece,
  // el dia se queda abierto sin hueco elegido. `selectDateTime` limpia
  // `preferredSlot` en el store, asi que este efecto se auto-desactiva en
  // cuanto aplica -- sin bandera aparte.
  useEffect(() => {
    if (!preferredSlot || !preferredDate || preferredDate !== dateStr) return
    if (slotsLoading) return
    const match = slots.find((slot) => `${dateStr}T${slot.startTime}` === preferredSlot)
    if (match) selectDateTime(dateStr, preferredSlot, match.employeeId)
  }, [preferredSlot, preferredDate, dateStr, slotsLoading, slots, selectDateTime])

  const handleSlotSelect = (slot: WizardSlot) => {
    selectDateTime(dateStr, `${dateStr}T${slot.startTime}`, slot.employeeId)
  }

  const isSlotSelected = (slot: WizardSlot) =>
    selectedDate === dateStr && selectedSlot === `${dateStr}T${slot.startTime}`

  const subtitle = selectedService
    ? !anyEmployee && selectedEmployee
      ? `Huecos libres de ${selectedEmployee.firstName} para ${selectedService.name} (${formatDurationTight(selectedService.durationMinutes)}).`
      : `Huecos libres para ${selectedService.name} (${formatDurationTight(selectedService.durationMinutes)}).`
    : undefined

  const rows = getWizardSummaryRows(wizardState, 3)
  const cta = getWizardSummaryCta(wizardState, 3)
  const aside = (
    <WizardSummaryAside rows={rows} ctaLabel={cta.label} ctaDisabled={cta.disabled} onCtaClick={nextStep} />
  )

  const footer = (
    <>
      {selectedDate && selectedSlot && selectedService && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {formatWizardDayFooter(selectedDate)} &middot;{" "}
            <span className="tabular-nums">
              {formatWizardTimeRange(selectedSlot, selectedService.durationMinutes)}
            </span>
          </span>
          <span className="font-heading text-[20px] leading-tight font-semibold tracking-display tabular-nums">
            {formatCurrency(selectedService.price)}
          </span>
        </div>
      )}
      <Button size="2xl" disabled={cta.disabled} onClick={nextStep}>
        {cta.label}
      </Button>
    </>
  )

  return (
    <NewAppointmentShell
      step={3}
      title="Elige fecha y hora"
      subtitle={subtitle}
      onBack={onBack}
      onClose={onClose}
      aside={aside}
      footer={footer}
    >
      {!isDesktop && <WizardContextPills />}

      {noOneOffersService ? (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">Ningún profesional ofrece este servicio</p>
          {/*
            Texto "Volver a servicios", no "Volver" a secas: el boton de
            cabecera movil (`new-appointment-shell.tsx:155-162`) ya usa
            `aria-label="Volver"` para el icono de retroceso, y un
            `getByRole("button", { name: "Volver" })` ambiguo tumbaria
            cualquier prueba que monte los dos a la vez.
          */}
          <Button variant="outline" className="mt-4" onClick={onBack}>
            Volver a servicios
          </Button>
        </div>
      ) : (
        <>
          {isDesktop ? (
            <DesktopCalendar
              today={today}
              weekPage={weekPage}
              setWeekPage={setWeekPage}
              dayOffset={dayOffset}
              setDayOffset={setDayOffset}
              hoursByEmployee={hoursByEmployee}
              employeeIds={subsetEmployeeIds}
            />
          ) : (
            <MobileDayStrip
              today={today}
              dayOffset={dayOffset}
              setDayOffset={setDayOffset}
              hoursByEmployee={hoursByEmployee}
              employeeIds={subsetEmployeeIds}
            />
          )}

          {slotsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : slots.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay huecos disponibles este dia.
            </p>
          ) : (
            <>
              {morningSlots.length > 0 && (
                <SlotSection
                  label="Mañana"
                  slots={morningSlots}
                  onSelect={handleSlotSelect}
                  isSelected={isSlotSelected}
                />
              )}
              {afternoonSlots.length > 0 && (
                <SlotSection
                  label="Tarde"
                  slots={afternoonSlots}
                  onSelect={handleSlotSelect}
                  isSelected={isSlotSelected}
                />
              )}
            </>
          )}
        </>
      )}
    </NewAppointmentShell>
  )
}

interface SlotSectionProps {
  label: string
  slots: WizardSlot[]
  onSelect: (slot: WizardSlot) => void
  isSelected: (slot: WizardSlot) => boolean
}

function SlotSection({ label, slots, onSelect, isSelected }: SlotSectionProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-xs font-semibold tracking-[0.05em] text-muted-foreground-2 uppercase">
        {label}
      </span>
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-6 lg:gap-2.5">
        {slots.map((slot) => {
          const selected = isSelected(slot)
          const display = slot.startTime.slice(0, 5)
          return (
            <button
              key={slot.startTime}
              type="button"
              onClick={() => onSelect(slot)}
              className={cn(
                "flex h-[46px] items-center justify-center rounded-lg border text-sm font-medium tabular-nums transition-colors lg:h-11",
                selected
                  ? "border-primary bg-primary font-semibold text-primary-foreground"
                  : "border-border bg-card hover:border-primary/50 hover:bg-muted"
              )}
            >
              {display}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface MobileDayStripProps {
  today: Date
  dayOffset: number
  setDayOffset: (offset: number) => void
  hoursByEmployee: Record<string, WorkingHoursResponse[]>
  employeeIds: string[]
}

function MobileDayStrip({ today, dayOffset, setDayOffset, hoursByEmployee, employeeIds }: MobileDayStripProps) {
  const dates = Array.from({ length: MOBILE_STRIP_DAYS }, (_, i) => addDays(today, i))

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-2 pb-2">
        {dates.map((date, i) => {
          const closed = isDayClosed(date, hoursByEmployee, employeeIds)
          const selected = i === dayOffset
          return (
            <button
              key={i}
              type="button"
              disabled={closed}
              onClick={() => setDayOffset(i)}
              data-testid={`mobile-day-${i}`}
              className={cn(
                "flex h-[62px] w-[52px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[10px] border",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : closed
                    ? "border-hairline bg-muted text-text-subtle"
                    : "border-border bg-card hover:bg-muted/50"
              )}
            >
              <span className={cn("text-[10px] uppercase", selected && "opacity-[0.85]")}>
                {format(date, "EEE", { locale: es })}
              </span>
              <span className="text-xl leading-none font-semibold tabular-nums">{format(date, "d")}</span>
            </button>
          )
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}

interface DesktopCalendarProps {
  today: Date
  weekPage: number
  setWeekPage: (updater: (page: number) => number) => void
  dayOffset: number
  setDayOffset: (offset: number) => void
  hoursByEmployee: Record<string, WorkingHoursResponse[]>
  employeeIds: string[]
}

function DesktopCalendar({
  today,
  weekPage,
  setWeekPage,
  dayOffset,
  setDayOffset,
  hoursByEmployee,
  employeeIds,
}: DesktopCalendarProps) {
  const dates = Array.from({ length: DESKTOP_WEEK_SIZE }, (_, i) => addDays(today, weekPage * DESKTOP_WEEK_SIZE + i))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-[0.05em] text-muted-foreground-2 uppercase">
          {format(dates[0], "MMMM yyyy", { locale: es })}
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label="Semana anterior"
            disabled={weekPage === 0}
            onClick={() => setWeekPage((p) => Math.max(0, p - 1))}
            className="flex size-8 items-center justify-center rounded-lg border border-border bg-card disabled:opacity-40"
          >
            <ChevronLeft className="size-[15px]" />
          </button>
          <button
            type="button"
            aria-label="Semana siguiente"
            disabled={weekPage >= DESKTOP_WEEK_PAGES - 1}
            onClick={() => setWeekPage((p) => Math.min(DESKTOP_WEEK_PAGES - 1, p + 1))}
            className="flex size-8 items-center justify-center rounded-lg border border-border bg-card disabled:opacity-40"
          >
            <ChevronRight className="size-[15px]" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2.5">
        {dates.map((date, i) => {
          const offset = weekPage * DESKTOP_WEEK_SIZE + i
          const closed = isDayClosed(date, hoursByEmployee, employeeIds)
          const selected = offset === dayOffset
          return (
            <button
              key={offset}
              type="button"
              disabled={closed}
              onClick={() => setDayOffset(offset)}
              data-testid={`desktop-day-${offset}`}
              className={cn(
                "flex h-[68px] flex-col items-center justify-center gap-[3px] rounded-[10px] border",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : closed
                    ? "border-hairline bg-muted text-text-subtle"
                    : "border-border bg-card hover:bg-muted/50"
              )}
            >
              <span className={cn("text-[11px] uppercase", selected && "opacity-[0.85]")}>
                {format(date, "EEE", { locale: es })}
              </span>
              <span className="text-xl leading-none font-semibold tabular-nums">{format(date, "d")}</span>
              {/*
                Tercera linea: el artboard pinta aqui el numero de huecos
                libres del dia ("9 huecos",
                `design/NuevaCitaDesktopPaso3.dc.html:78,83`), pero
                `getAvailability` (`src/lib/api/appointments.ts`) recibe un
                unico `date` y un unico `employeeId` -- pintar los 7
                contadores exigiria hasta 7 llamadas por cada empleado del
                subconjunto solo para esta rejilla, fuera de alcance de esta
                tarea. Se deja vacia (reservando igualmente los 68px de alto
                para no descuadrar la rejilla) salvo cuando el dia esta
                cerrado, que si sabemos de `useEmployeesWorkingHours`. Mismo
                hueco de backend que ya documenta
                `public-datetime-step.tsx:441-450`, para que las dos
                pantallas digan lo mismo.
              */}
              <span className="text-[10px]">{closed ? "Cerrado" : ""}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
