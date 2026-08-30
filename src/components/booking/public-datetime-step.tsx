"use client"

import { useEffect, useState } from "react"
import { addDays, addMinutes, format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { useQuery } from "@tanstack/react-query"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { BookingStepShell } from "@/components/booking/booking-step-shell"
import { WizardSummaryAside } from "@/components/wizard/wizard-summary-aside"
import { useMediaQuery } from "@/hooks/use-media-query"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { appointmentsApi } from "@/lib/api/appointments"
import { cn } from "@/lib/utils"
import { formatCurrency, initials } from "@/lib/utils/format"
import { AFTERNOON_HOUR, formatDuration } from "@/lib/utils/dates"
import type { AvailabilityResponse, AvailableSlot } from "@/types/appointment"
import type { BusinessHoursResponse, SalonPublic } from "@/types/salon"

// Tailwind's `lg:` breakpoint (1024px), same one `BookingStepShell` and
// `useMediaQuery` already key off (`booking-step-shell.tsx:15`).
const DESKTOP_QUERY = "(min-width: 1024px)"

// Movil: tira horizontal scrolleable (`design/ReservaPaso3.dc.html:52-77`),
// sin flechas -- el artboard no las pinta, a diferencia del navegador de mes
// de escritorio. 30 dias es el mismo horizonte que ya tenia el componente.
const MOBILE_STRIP_DAYS = 30

// Escritorio: rejilla fija de 7 columnas (`design/ReservaDesktopPaso3.dc.html:89`)
// paginada de 7 en 7 con las flechas junto al rotulo de mes. Ver el informe de
// la tarea para la justificacion de "7 siguientes" frente a semana natural.
const DESKTOP_WEEK_SIZE = 7
const DESKTOP_WEEK_PAGES = 4 // 4 x 7 = 28 dias, horizonte similar al de la tira movil.

/**
 * Si `date` cae en un dia que el salon tiene cerrado, segun
 * `salon.businessHours`. Mismo convenio de `dayOfWeek` que
 * `getTodayBusinessHours` (Lunes=1 ... Domingo=7,
 * `src/lib/utils/business-hours.ts:79-88`) pero resuelto para una fecha
 * cualquiera en vez de "ahora". No hay ya un helper para eso en
 * `business-hours.ts`, y esta es su unica llamadora: se queda local en vez de
 * ampliar la superficie publica de ese modulo para un solo caso de uso.
 */
function isDayClosed(date: Date, businessHours: BusinessHoursResponse[]): boolean {
  const jsDay = date.getDay()
  const dayOfWeek = jsDay === 0 ? 7 : jsDay
  const hours = businessHours.find((h) => h.dayOfWeek === dayOfWeek)
  return hours ? !hours.isOpen : false
}

interface PublicDateTimeStepProps {
  salon: SalonPublic
}

export function PublicDateTimeStep({ salon }: PublicDateTimeStepProps) {
  const {
    salonSlug,
    selectedService,
    selectedEmployeeId,
    anyEmployee,
    selectedDate,
    selectedSlot,
    selectDateTime,
    selectEmployee,
    nextStep,
    prevStep,
  } = usePublicBookingStore()

  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  // Ancla fijada al montar: la aritmetica de fechas de este paso (tira movil,
  // rejilla de escritorio) se basa en desplazamientos desde "hoy" y no debe
  // recalcularse en cada render.
  const [today] = useState(() => new Date())

  // Dia que se esta consultando, como desplazamiento en dias desde `today`.
  // Unica fuente de verdad compartida por la tira movil y la rejilla de
  // escritorio -- cada una solo decide como pintar y navegar, no que dia esta
  // seleccionado.
  const [dayOffset, setDayOffset] = useState(0)
  // Pagina de 7 dias que muestra la rejilla de escritorio; independiente de
  // `dayOffset` (se puede paginar sin perder la seleccion, y viceversa).
  const [weekPage, setWeekPage] = useState(0)

  const browseDate = addDays(today, dayOffset)
  const dateStr = format(browseDate, "yyyy-MM-dd")

  // "Sin preferencia" carries anyEmployee=true but no employeeId. The public
  // availability endpoint needs a concrete employee, so pin the first one that
  // offers the selected service while keeping anyEmployee=true for the UI.
  useEffect(() => {
    if (!anyEmployee || selectedEmployeeId || !selectedService) return
    const fallback = salon.employees.find((e) => e.serviceIds.includes(selectedService.id))
    if (fallback) selectEmployee(fallback.id, true)
  }, [anyEmployee, selectedEmployeeId, selectedService, salon.employees, selectEmployee])

  // Public availability — no auth token, resolved via the salon slug
  const { data, isLoading } = useQuery<AvailabilityResponse>({
    queryKey: ["public-availability", selectedEmployeeId, selectedService?.id, dateStr],
    queryFn: () =>
      appointmentsApi.getPublicAvailability({
        salonSlug,
        employeeId: selectedEmployeeId!,
        date: dateStr,
        serviceId: selectedService?.id,
      }),
    enabled: !!selectedService && !!selectedEmployeeId,
  })

  // El backend responde {date, employeeId, slots:[{startTime, endTime}]} con
  // las horas sueltas ("09:00:00"). PublicBookingRequest.requestedTime es un
  // LocalDateTime, asi que el hueco se guarda recompuesto como fecha+hora.
  const availabilityDate = data?.date ?? dateStr
  const slots = data?.slots ?? []
  const morningSlots = slots.filter((s) => Number(s.startTime.slice(0, 2)) < AFTERNOON_HOUR)
  const afternoonSlots = slots.filter((s) => Number(s.startTime.slice(0, 2)) >= AFTERNOON_HOUR)

  /*
   * NOTA sobre huecos ocupados (brief T6 punto 4): el artboard
   * (`design/ReservaPaso3.dc.html:84-85`) tambien pinta los huecos ya
   * reservados, tachados y no pulsables. `AvailabilityResponse.slots`
   * (`src/types/appointment.ts:99-103`) solo trae los huecos LIBRES -- no hay
   * ningun campo con los ocupados ni con el total de la agenda del dia. No se
   * puede distinguir "hueco ocupado" de "hueco que no existe" con lo que
   * manda el backend, asi que esta vista no los pinta. Ver el informe de la
   * tarea: hueco de backend, no un olvido de esta implementacion.
   */

  const selectedEmployee = salon.employees.find((e) => e.id === selectedEmployeeId)

  // Solo se avisa de "huecos de X" cuando el visitante eligio profesional a
  // proposito. Con "Sin preferencia" (anyEmployee=true) el empleado fijado
  // arriba es un detalle de implementacion (el primero que ofrece el
  // servicio), no una eleccion del visitante -- anunciarlo seria filtrar ese
  // detalle y no informar de nada real.
  const subtitleParts: string[] = []
  if (selectedService) {
    subtitleParts.push(
      `${selectedService.name} · ${formatDuration(selectedService.durationMinutes)} · ${formatCurrency(selectedService.price, selectedService.currency)}`
    )
  }
  if (!anyEmployee && selectedEmployee) {
    subtitleParts.push(`Solo huecos de ${selectedEmployee.firstName} ${selectedEmployee.lastName}`.trim())
  }

  // La seleccion solo cuenta si pertenece al dia que se esta viendo: al
  // cambiar de dia sin volver a elegir hora, un `selectedSlot` de un dia
  // anterior no debe dejar el CTA activo ni aparecer en el resumen.
  const hasValidSelection = selectedDate === availabilityDate && !!selectedSlot
  const slotStart = hasValidSelection && selectedSlot ? parseISO(selectedSlot) : null
  const slotEnd = slotStart && selectedService ? addMinutes(slotStart, selectedService.durationMinutes) : null

  const handleSlotSelect = (slot: AvailableSlot) => {
    selectDateTime(availabilityDate, `${availabilityDate}T${slot.startTime}`)
  }

  const asideBody = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-[3px]">
          <span className="text-base font-semibold">{selectedService?.name}</span>
          <span className="text-xs text-muted-foreground">
            {selectedService && formatDuration(selectedService.durationMinutes)}
          </span>
        </div>
        <span className="text-[22px] font-semibold tabular-nums">
          {selectedService && formatCurrency(selectedService.price, selectedService.currency)}
        </span>
      </div>

      <div className="h-px bg-hairline" />

      {selectedEmployee && (
        <>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary">
              {initials(selectedEmployee.firstName, selectedEmployee.lastName)}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">
                {selectedEmployee.firstName} {selectedEmployee.lastName}
              </span>
              {selectedEmployee.jobTitle && (
                <span className="text-[11px] text-muted-foreground-2">{selectedEmployee.jobTitle}</span>
              )}
            </div>
          </div>

          <div className="h-px bg-hairline" />
        </>
      )}

      <div className="flex flex-col gap-[3px]">
        {slotStart && slotEnd ? (
          <>
            <span className="text-2xl leading-[1.1] font-semibold tabular-nums">
              {format(slotStart, "HH:mm")} - {format(slotEnd, "HH:mm")}
            </span>
            <span className="text-[13px] text-muted-foreground capitalize">
              {format(slotStart, "EEEE, d 'de' MMMM", { locale: es })}
            </span>
          </>
        ) : (
          <span className="text-sm text-text-placeholder">Elige un hueco disponible</span>
        )}
      </div>
    </>
  )

  return (
    <BookingStepShell
      salon={salon}
      step={3}
      title="Elige fecha y hora"
      subtitle={subtitleParts.join(" · ")}
      onBack={prevStep}
      aside={
        <WizardSummaryAside
          body={asideBody}
          ctaLabel="Continuar"
          ctaDisabled={!hasValidSelection}
          onCtaClick={nextStep}
          ctaHeight={48}
        />
      }
      asideWidth={340}
      footer={
        <div className="flex flex-col gap-2.5">
          {slotStart && slotEnd && (
            <span className="text-center text-xs text-muted-foreground capitalize">
              {format(slotStart, "EEEE d 'de' MMMM", { locale: es })} ·{" "}
              <span className="tabular-nums">
                {format(slotStart, "HH:mm")} - {format(slotEnd, "HH:mm")}
              </span>
            </span>
          )}
          <Button size="2xl" disabled={!hasValidSelection} onClick={nextStep}>
            Continuar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-[18px] lg:gap-[26px]">
        {isDesktop ? (
          <DesktopCalendar
            today={today}
            weekPage={weekPage}
            setWeekPage={setWeekPage}
            dayOffset={dayOffset}
            setDayOffset={setDayOffset}
            businessHours={salon.businessHours}
          />
        ) : (
          <MobileDayStrip
            today={today}
            dayOffset={dayOffset}
            setDayOffset={setDayOffset}
            businessHours={salon.businessHours}
          />
        )}

        {isLoading ? (
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
              <SlotSection label="Mañana" slots={morningSlots} onSelect={handleSlotSelect} isSelected={(slot) => selectedDate === availabilityDate && selectedSlot === `${availabilityDate}T${slot.startTime}`} />
            )}
            {afternoonSlots.length > 0 && (
              <SlotSection label="Tarde" slots={afternoonSlots} onSelect={handleSlotSelect} isSelected={(slot) => selectedDate === availabilityDate && selectedSlot === `${availabilityDate}T${slot.startTime}`} />
            )}
          </>
        )}
      </div>
    </BookingStepShell>
  )
}

interface SlotSectionProps {
  label: string
  slots: AvailableSlot[]
  onSelect: (slot: AvailableSlot) => void
  isSelected: (slot: AvailableSlot) => boolean
}

function SlotSection({ label, slots, onSelect, isSelected }: SlotSectionProps) {
  return (
    <div className="flex flex-col gap-2.5 lg:gap-3">
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
  businessHours: BusinessHoursResponse[]
}

function MobileDayStrip({ today, dayOffset, setDayOffset, businessHours }: MobileDayStripProps) {
  const dates = Array.from({ length: MOBILE_STRIP_DAYS }, (_, i) => addDays(today, i))

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-2 pb-2">
        {dates.map((date, i) => {
          const closed = isDayClosed(date, businessHours)
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
  businessHours: BusinessHoursResponse[]
}

function DesktopCalendar({
  today,
  weekPage,
  setWeekPage,
  dayOffset,
  setDayOffset,
  businessHours,
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
          const closed = isDayClosed(date, businessHours)
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
                libres del dia ("9 huecos", `design/ReservaDesktopPaso3.dc.html:98`),
                pero `getPublicAvailability` (`src/lib/api/appointments.ts`)
                recibe un unico `date` -- pintar los 7 contadores exigiria 7
                llamadas solo para esta rejilla, fuera de alcance de esta
                tarea. Se deja vacia (reservando igualmente los 68px de alto
                para no descuadrar la rejilla) salvo cuando el dia esta
                cerrado, que si sabemos de `salon.businessHours`.
              */}
              <span className="text-[10px]">{closed ? "Cerrado" : ""}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
