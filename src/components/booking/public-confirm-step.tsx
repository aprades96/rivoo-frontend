"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Info } from "lucide-react"
import { addMinutes, format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { BookingStepShell } from "@/components/booking/booking-step-shell"
import { BookingSummaryAside, type BookingSummaryRow } from "@/components/booking/booking-summary-aside"
import { appointmentsApi } from "@/lib/api/appointments"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { formatCurrency } from "@/lib/utils/format"
import { formatDuration } from "@/lib/utils/dates"
import type { SalonPublic } from "@/types/salon"

interface PublicConfirmStepProps {
  salon: SalonPublic
}

/**
 * `design/ReservaDesktopPaso5.dc.html:64` carries a subtitle under the title
 * ("Ultimo paso. Revisa que todo esta bien."); `design/ReservaPaso5.dc.html:46`
 * has no such line -- the mobile card goes straight from the title into the
 * booking card. `BookingStepShell`'s `subtitle` prop renders unconditionally
 * (only its font-size varies by breakpoint, not its presence -- see
 * `booking-step-shell.tsx:82`), and the shell is shared by every step, so it
 * cannot gain a "desktop-only" prop for this single step without touching a
 * file outside this task's scope. Resolved by NOT passing `subtitle` to the
 * shell and instead rendering it here, hidden below `lg:` (the same
 * breakpoint the shell itself uses to switch the aside/footer). Trade-off:
 * this loses the artboard's tight 6px title-subtitle gap (design line 65) in
 * favour of the container's normal 18px/26px section gap, since that gap
 * lives inside the shell's own title block and is not reachable from here.
 * Content-per-breakpoint correctness (no subtitle on mobile) wins over that
 * spacing nuance.
 */
const DESKTOP_SUBTITLE = "Ultimo paso. Revisa que todo esta bien."

export function PublicConfirmStep({ salon }: PublicConfirmStepProps) {
  const {
    salonSlug,
    selectedService,
    selectedEmployeeId,
    selectedDate,
    selectedSlot,
    clientForm,
    honeypot,
    nextStep,
    prevStep,
  } = usePublicBookingStore()

  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedEmployeeId) {
        // Should never happen: the employee/datetime steps always resolve a
        // concrete employeeId (even for "sin preferencia") before this step
        // is reachable. Fail loudly instead of sending a request the backend
        // is guaranteed to reject with 400 (employeeExternalId is @NotBlank).
        throw new Error("No se ha podido determinar el profesional para la reserva")
      }
      return appointmentsApi.bookPublic({
        salonSlug,
        serviceExternalId: selectedService!.id,
        employeeExternalId: selectedEmployeeId,
        requestedTime: selectedSlot!,
        clientFirstName: clientForm.firstName,
        clientLastName: clientForm.lastName,
        clientEmail: clientForm.email,
        clientPhone: clientForm.phone,
        honeypot: honeypot || undefined,
      })
    },
    onSuccess: () => {
      nextStep() // → step 6 (success)
    },
    // -----------------------------------------------------------------
    // TODO(T10): the backend cannot tell "the slot was just taken by
    // someone else" apart from any other business-rule failure here.
    // AppointmentConflictException extends BusinessValidationException,
    // which always answers 422 with the same RFC7807 `type`/title as every
    // other business error -- there is no 409 and no discriminator to
    // branch on by status code. Do NOT try to detect the conflict from
    // `err` in this handler: it would silently never fire. The next task
    // resolves it by re-querying availability after a failure and routing
    // to the dedicated conflict screen (`usePublicBookingStore.setConflict`,
    // `BookingResultShell` tone="error") when the slot is confirmed gone.
    // Until then this preserves today's behaviour: any mutation failure
    // paints the generic banner below unchanged.
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Error al crear la reserva"
      setErrorMessage(message)
    },
    // -----------------------------------------------------------------
  })

  const employee = salon.employees.find((candidate) => candidate.id === selectedEmployeeId) ?? null
  const employeeName = employee ? `${employee.firstName} ${employee.lastName}`.trim() : ""
  const clientName = `${clientForm.firstName} ${clientForm.lastName}`.trim()

  const startDate = selectedSlot ? parseISO(selectedSlot) : null
  const endDate = startDate && selectedService ? addMinutes(startDate, selectedService.durationMinutes) : null

  const timeRangeDisplay = startDate
    ? endDate
      ? `${format(startDate, "HH:mm")} - ${format(endDate, "HH:mm")}`
      : format(startDate, "HH:mm")
    : ""

  // Artboard: "Miercoles, 28 de agosto" -- comma + "de", no year (design/ReservaDesktopPaso5.dc.html:68).
  const dateDisplay = selectedDate ? format(parseISO(selectedDate), "EEEE, d 'de' MMMM", { locale: es }) : ""
  // Aside "Fecha y hora" row: "Mie 28, 11:00 - 12:30" (design/ReservaDesktopPaso5.dc.html:90).
  const shortDateDisplay = selectedDate ? format(parseISO(selectedDate), "EEE d", { locale: es }) : ""

  const priceDisplay = selectedService ? formatCurrency(selectedService.price, selectedService.currency) : ""
  const durationDisplay = selectedService ? formatDuration(selectedService.durationMinutes) : ""

  const isSending = mutation.isPending

  const asideRows: BookingSummaryRow[] = [
    { label: "Servicio", value: selectedService?.name, detail: selectedService ? `${durationDisplay} · ${priceDisplay}` : undefined },
    { label: "Profesional", value: employeeName || undefined },
    { label: "Fecha y hora", value: startDate ? `${shortDateDisplay}, ${timeRangeDisplay}` : undefined },
  ]

  return (
    <BookingStepShell
      salon={salon}
      step={5}
      title="Confirma tu reserva"
      onBack={prevStep}
      aside={
        <BookingSummaryAside
          rows={asideRows}
          total={priceDisplay}
          ctaLabel={isSending ? "Reservando..." : "Confirmar reserva"}
          ctaDisabled={isSending}
          onCtaClick={() => mutation.mutate()}
        />
      }
      footer={
        <div className="flex flex-col gap-2.5">
          <Button
            size="2xl"
            onClick={() => mutation.mutate()}
            disabled={isSending}
          >
            {isSending ? "Reservando..." : "Confirmar reserva"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground-2">
            Cancela gratis hasta 24h antes
          </p>
        </div>
      }
    >
      {/* Solo en escritorio -- ver el comentario sobre `DESKTOP_SUBTITLE` mas arriba. */}
      <p className="hidden text-sm text-muted-foreground lg:block">{DESKTOP_SUBTITLE}</p>

      <div className="flex flex-col gap-3.5 rounded-[12px] border border-border bg-card p-[18px] lg:gap-[18px] lg:p-6">
        <div className="flex flex-col gap-0.5 border-b border-hairline pb-3.5 lg:gap-[3px] lg:pb-4">
          <span className="font-heading text-[26px] leading-[1.1] font-semibold tracking-display tabular-nums lg:text-[30px] lg:leading-[1.05]">
            {timeRangeDisplay}
          </span>
          <span className="text-[13px] text-muted-foreground capitalize lg:text-sm">{dateDisplay}</span>
        </div>

        {/*
          Mobile stacks service+price, professional and "A nombre de" with a
          single divider before the last block (design/ReservaPaso5.dc.html:59-73).
          Desktop lays the same three fields as a 3-column grid with no
          dividers, and its copy genuinely differs per field (separate
          "Profesional" label + plain name vs mobile's single "Con {name}"
          line, and the "A nombre de" column drops the phone that mobile
          shows) -- two literal blocks instead of one reflowed with CSS,
          same convention `public-success-step.tsx` uses for its
          mobile/desktop split.
        */}
        <div className="flex flex-col gap-3.5 lg:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-[15px] font-semibold">{selectedService?.name}</p>
              <p className="text-xs text-muted-foreground-2">{durationDisplay}</p>
            </div>
            <span className="font-heading text-xl font-semibold tabular-nums tracking-display">
              {priceDisplay}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="size-2 shrink-0 rounded-full bg-primary" />
            <span className="text-sm">Con {employeeName}</span>
          </div>

          <div className="h-px bg-hairline" />

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground-2">A nombre de</span>
            <span className="text-sm font-semibold">{clientName}</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {clientForm.email} · {clientForm.phone}
            </span>
          </div>
        </div>

        <div className="hidden lg:grid lg:grid-cols-3 lg:gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground-2">Servicio</span>
            <span className="text-[15px] font-semibold">{selectedService?.name}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{durationDisplay}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground-2">Profesional</span>
            <div className="flex items-center gap-[7px]">
              <div className="size-2 shrink-0 rounded-full bg-primary" />
              <span className="text-[15px]">{employeeName}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground-2">A nombre de</span>
            <span className="text-[15px]">{clientName}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{clientForm.email}</span>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-warning-border bg-status-pending-bg px-3.5 py-3 lg:rounded-[10px] lg:px-4 lg:py-3.5">
        <Info className="mt-px size-4 shrink-0 text-status-pending-text lg:size-[17px]" strokeWidth={1.75} />
        <span className="text-xs leading-relaxed text-status-pending-text lg:text-[13px]">
          El salon confirmara tu reserva. Recibiras un email en cuanto lo haga.
        </span>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}
    </BookingStepShell>
  )
}
