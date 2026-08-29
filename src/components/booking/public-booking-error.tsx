"use client"

import { useQuery } from "@tanstack/react-query"
import { Calendar, CalendarX } from "lucide-react"
import { addMinutes, format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { BookingResultShell } from "@/components/booking/booking-result-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useMediaQuery } from "@/hooks/use-media-query"
import { appointmentsApi } from "@/lib/api/appointments"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/format"
import { formatDuration } from "@/lib/utils/dates"
import type { AvailabilityResponse, AvailableSlot } from "@/types/appointment"
import type { SalonPublic } from "@/types/salon"

interface PublicBookingErrorProps {
  salon: SalonPublic
}

// Same breakpoint `BookingResultShell` and `PublicSuccessStep` key off (`md:`,
// not the step chassis' `lg:`) -- this screen belongs to the result chassis
// family, not the wizard one (`booking-result-shell.tsx:32-41` comment).
const DESKTOP_QUERY = "(min-width: 768px)"

/**
 * `design/ReservaError.dc.html` (mobile) / `design/ReservaErrorDesktop.dc.html`
 * (desktop). Mounts through `BookingResultShell` tone="error" -- same chassis
 * `PublicSuccessStep` (step 6) uses, see that file's own top comment.
 *
 * Reached when `usePublicBookingStore().conflict` is set (see
 * `public-confirm-step.tsx`'s mutation `onError`, task T10): the slot the
 * visitor picked was taken by someone else while they were confirming. The
 * store is deliberately NOT reset here or by the caller -- the artboard's own
 * copy promises "Guardamos tus datos" (both variants below), so
 * `selectedService`/`selectedEmployeeId`/`clientForm` must survive this whole
 * screen untouched.
 */
export function PublicBookingError({ salon }: PublicBookingErrorProps) {
  const {
    salonSlug,
    selectedService,
    selectedEmployeeId,
    clientForm,
    conflict,
    selectDateTime,
    clearConflict,
    clearDateTime,
    setStep,
  } = usePublicBookingStore()

  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  // Same query key `public-confirm-step.tsx`'s `onError` re-check uses --
  // that fetch is what actually detected the conflict, so by the time this
  // screen mounts the alternatives are already sitting in the cache under
  // this exact key ("con las alternativas ya cargadas", brief T10 paso 1):
  // this `useQuery` reads them back instantly instead of re-fetching blind.
  const { data } = useQuery<AvailabilityResponse>({
    queryKey: ["public-availability", selectedEmployeeId, selectedService?.id, conflict?.date],
    queryFn: () =>
      appointmentsApi.getPublicAvailability({
        salonSlug,
        employeeId: selectedEmployeeId!,
        date: conflict!.date,
        serviceId: selectedService?.id,
      }),
    enabled: !!conflict && !!selectedEmployeeId && !!selectedService,
  })

  const alternativeSlots = data?.slots ?? []

  const employee = salon.employees.find((candidate) => candidate.id === selectedEmployeeId) ?? null
  const employeeName = employee ? `${employee.firstName} ${employee.lastName}`.trim() : ""
  const clientName = `${clientForm.firstName} ${clientForm.lastName}`.trim()

  // `conflict` is what routes `page.tsx` to this component in the first
  // place -- defensive only, this component is never meant to render without
  // it (see the report handed to the orchestrator for what `page.tsx` must
  // guarantee).
  if (!conflict) return null

  const startDate = parseISO(conflict.slot)
  const endDate = selectedService ? addMinutes(startDate, selectedService.durationMinutes) : null
  const timeRangeDisplay = endDate
    ? `${format(startDate, "HH:mm")} - ${format(endDate, "HH:mm")}`
    : format(startDate, "HH:mm")
  const takenTimeDisplay = format(startDate, "HH:mm")

  // Artboard: "Miercoles, 28 de agosto" -- comma + "de", no year (same
  // convention `public-confirm-step.tsx` uses for its own date display).
  const dateDisplay = format(parseISO(conflict.date), "EEEE, d 'de' MMMM", { locale: es })

  const priceDisplay = selectedService ? formatCurrency(selectedService.price, selectedService.currency) : ""
  const durationDisplay = selectedService ? formatDuration(selectedService.durationMinutes) : ""

  const handleSelectAlternative = (slot: AvailableSlot) => {
    selectDateTime(conflict.date, `${conflict.date}T${slot.startTime}`)
    clearConflict() // step stays 5 -- `page.tsx` falls back to the confirm step with the new hour.
  }

  const handlePickAnotherDay = () => {
    // Descartar el hueco es la parte que importa, no volver al paso 3. El
    // backend acaba de rechazarlo: esta muerto. Dejandolo puesto, y cuando el
    // conflicto es sobre una cita de HOY -- el caso mas frecuente --,
    // `selectedDate` coincide con el dia que el paso 3 muestra por defecto, asi
    // que su CTA sale habilitado con el hueco muerto aunque ninguna tecla
    // aparezca resaltada. Continuar -> confirmar -> 422 -> aqui otra vez: un
    // bucle cerrado del que el visitante no sale.
    // Los datos del cliente NO se tocan: el artboard promete por escrito
    // "Guardamos tus datos: solo tienes que elegir hora."
    clearDateTime()
    clearConflict()
    setStep(3)
  }

  return (
    <BookingResultShell
      salon={salon}
      tone="error"
      icon={<CalendarX className="size-8 md:size-[38px]" strokeWidth={1.75} />}
      title="Ese hueco se acaba de ocupar"
      subtitle={
        <>
          <span className="md:hidden">
            Alguien ha reservado las {takenTimeDisplay} mientras
            <br />
            confirmabas. Tu cita no se ha creado.
          </span>
          <span className="hidden md:inline">
            Alguien ha reservado las {takenTimeDisplay} mientras confirmabas. Tu cita no se ha creado.
          </span>
        </>
      }
    >
      {isDesktop ? (
        <DesktopLayout
          timeRangeDisplay={timeRangeDisplay}
          dateDisplay={dateDisplay}
          serviceName={selectedService?.name ?? ""}
          durationDisplay={durationDisplay}
          priceDisplay={priceDisplay}
          employeeName={employeeName}
          clientName={clientName}
          alternativeSlots={alternativeSlots}
          onSelectAlternative={handleSelectAlternative}
          onPickAnotherDay={handlePickAnotherDay}
        />
      ) : (
        <MobileLayout
          timeRangeDisplay={timeRangeDisplay}
          dateDisplay={dateDisplay}
          serviceName={selectedService?.name ?? ""}
          durationDisplay={durationDisplay}
          priceDisplay={priceDisplay}
          employeeName={employeeName}
          clientName={clientName}
          alternativeSlots={alternativeSlots}
          onSelectAlternative={handleSelectAlternative}
          onPickAnotherDay={handlePickAnotherDay}
        />
      )}
    </BookingResultShell>
  )
}

interface LayoutProps {
  timeRangeDisplay: string
  dateDisplay: string
  serviceName: string
  durationDisplay: string
  priceDisplay: string
  employeeName: string
  clientName: string
  alternativeSlots: AvailableSlot[]
  onSelectAlternative: (slot: AvailableSlot) => void
  onPickAnotherDay: () => void
}

function SlotButton({
  slot,
  heightClass,
  onSelect,
}: {
  slot: AvailableSlot
  heightClass: string
  onSelect: (slot: AvailableSlot) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(slot)}
      className={cn(
        "flex items-center justify-center rounded-lg border border-border bg-card text-sm font-medium tabular-nums transition-colors hover:border-primary/50 hover:bg-muted",
        heightClass
      )}
    >
      {slot.startTime.slice(0, 5)}
    </button>
  )
}

/**
 * `design/ReservaError.dc.html`. Lost-slot card first, alternatives below
 * (no border/card around them, plain list -- line 54), "Elegir otro dia" as a
 * fixed-bottom full-width CTA (brief T10 paso 4). `BookingResultShell` has no
 * `footer` slot (unlike `BookingStepShell`), so the fixed footer is built
 * here the same way `booking-step-shell.tsx:101` does it, plus a spacer so it
 * does not cover the last row of slot buttons.
 */
function MobileLayout({
  timeRangeDisplay,
  dateDisplay,
  serviceName,
  durationDisplay,
  priceDisplay,
  employeeName,
  clientName,
  alternativeSlots,
  onSelectAlternative,
  onPickAnotherDay,
}: LayoutProps) {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex w-full flex-col gap-2.5 rounded-[12px] border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3 border-b border-hairline pb-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="font-heading text-[22px] leading-[1.1] font-semibold tracking-display tabular-nums text-text-subtle line-through">
              {timeRangeDisplay}
            </span>
            <span className="text-xs text-muted-foreground-2">{dateDisplay}</span>
          </div>
          <Badge variant="destructive-outline">Ocupada</Badge>
        </div>
        <span className="text-sm font-semibold">{serviceName}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {durationDisplay} · {priceDisplay}
        </span>
        <span className="text-xs text-muted-foreground">
          Con {employeeName} · a nombre de {clientName}
        </span>
      </div>

      <div className="flex w-full flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-2.5">
          <span className="text-xs font-semibold tracking-[0.05em] text-muted-foreground-2 uppercase">
            Otras horas ese dia
          </span>
          <span className="text-[11px] text-muted-foreground-2">Huecos de {employeeName}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {alternativeSlots.map((slot) => (
            <SlotButton key={slot.startTime} slot={slot} heightClass="h-[46px]" onSelect={onSelectAlternative} />
          ))}
        </div>
      </div>

      {/* Reserves room for the fixed footer below so it does not cover the slot grid. */}
      <div className="h-[124px]" aria-hidden="true" />

      <div className="fixed inset-x-0 bottom-0 z-10 flex flex-col gap-2.5 border-t border-border bg-background px-5 pt-3.5 pb-5">
        <Button
          type="button"
          variant="outline"
          size="2xl"
          onClick={onPickAnotherDay}
          className="gap-2 bg-card text-[15px] font-semibold"
        >
          <Calendar className="size-[17px]" strokeWidth={1.75} />
          Elegir otro dia
        </Button>
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground-2">
          Guardamos tus datos: solo tienes que elegir hora.
        </p>
      </div>
    </div>
  )
}

/**
 * `design/ReservaErrorDesktop.dc.html:47-90`. Standard layout (not
 * inverted): alternatives are the main column (`flex-grow`), lost slot is the
 * 320px sidebar (`flex-shrink-0`) -- brief T10 paso 6.
 */
function DesktopLayout({
  timeRangeDisplay,
  dateDisplay,
  serviceName,
  durationDisplay,
  priceDisplay,
  employeeName,
  clientName,
  alternativeSlots,
  onSelectAlternative,
  onPickAnotherDay,
}: LayoutProps) {
  return (
    <div className="flex w-full flex-col items-center gap-1">
      <div className="flex w-full gap-5">
        <div className="flex flex-grow flex-col gap-4 rounded-[12px] border border-border bg-card p-6">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold tracking-[0.05em] text-muted-foreground-2 uppercase">
              Otras horas ese dia
            </span>
            <span className="text-xs text-muted-foreground-2">
              {dateDisplay} · huecos de {employeeName}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2.5">
            {alternativeSlots.map((slot) => (
              <SlotButton key={slot.startTime} slot={slot} heightClass="h-11" onSelect={onSelectAlternative} />
            ))}
          </div>

          <div className="h-px bg-hairline" />

          <div className="flex items-center justify-between gap-4">
            <span className="text-[13px] text-muted-foreground">Ninguna hora te encaja?</span>
            <Button
              type="button"
              variant="outline"
              onClick={onPickAnotherDay}
              className="h-10 gap-2 bg-card px-[18px] text-sm font-semibold"
            >
              <Calendar className="size-4" strokeWidth={1.75} />
              Elegir otro dia
            </Button>
          </div>
        </div>

        <div className="flex w-[320px] shrink-0 flex-col gap-3.5 rounded-[12px] border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-2.5 border-b border-hairline pb-3.5">
            <div className="flex min-w-0 flex-col gap-[3px]">
              <span className="font-heading text-[26px] leading-[1.05] font-semibold tracking-display tabular-nums text-text-subtle line-through">
                {timeRangeDisplay}
              </span>
              <span className="text-[13px] text-muted-foreground-2">{dateDisplay}</span>
            </div>
            <Badge variant="destructive-outline">Ocupada</Badge>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs text-muted-foreground-2">Servicio</span>
            <span className="text-right text-sm font-semibold">{serviceName}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs text-muted-foreground-2">Profesional</span>
            <span className="text-right text-sm font-semibold">{employeeName}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs text-muted-foreground-2">A nombre de</span>
            <span className="text-right text-sm font-semibold">{clientName}</span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs text-muted-foreground-2">Total</span>
            <span className="font-heading text-xl font-semibold tabular-nums tracking-display">
              {priceDisplay}
            </span>
          </div>
        </div>
      </div>

      <span className="mt-1 text-[13px] text-muted-foreground-2">
        Guardamos tus datos: solo tienes que elegir otra hora. No se ha creado ninguna reserva.
      </span>
    </div>
  )
}
