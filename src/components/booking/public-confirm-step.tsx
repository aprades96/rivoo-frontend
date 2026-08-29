"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
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
 * `design/ReservaDesktopPaso5.dc.html:64` lleva subtitulo bajo el titulo;
 * `design/ReservaPaso5.dc.html:46` no: la tarjeta movil pasa del titulo
 * directamente al bloque de la reserva. Va por la prop `subtitle` del chasis
 * —que acepta un nodo justamente para esto— con su propia visibilidad, en vez
 * de pintarse aparte dentro del contenido: asi conserva el espaciado de 6px
 * del artboard, que vive en el bloque de titulo del chasis.
 */
const DESKTOP_SUBTITLE = (
  <span className="hidden lg:inline">Ultimo paso. Revisa que todo esta bien.</span>
)

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
    setConflict,
  } = usePublicBookingStore()

  const queryClient = useQueryClient()

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Ventana entre "la reserva ha fallado" y "sabemos si es el conflicto de
  // hueco o cualquier otro fallo": `mutation.isPending` ya se apaga en cuanto
  // `mutationFn` rechaza (antes de que este `onError` ni empiece), asi que sin
  // este estado propio el CTA parpadearia a "Confirmar reserva" -- clicable de
  // nuevo -- durante la re-consulta de disponibilidad de mas abajo.
  const [isCheckingConflict, setIsCheckingConflict] = useState(false)

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
    // T10: the backend cannot tell "the slot was just taken by someone
    // else" apart from any other business-rule failure -- AppointmentConflictException
    // extends BusinessValidationException, which always answers 422 with the
    // same RFC7807 `type`/title as every other business error. There is no
    // 409 and no discriminator to branch on by status code (verified, not
    // reopening it), so `err` itself is useless here. Instead, re-query
    // public availability for the same day/employee: if the slot the visitor
    // picked is confirmed gone from that response, it is the conflict --
    // `setConflict` routes `page.tsx` to the dedicated error screen, and this
    // same response becomes its "already loaded" alternatives because it is
    // cached under the exact query key `PublicBookingError` reads
    // (`["public-availability", employeeId, serviceId, date]`, same shape
    // `public-datetime-step.tsx` already uses). If the slot is still there,
    // it is a different business failure -- fall through to the banner.
    onError: async (err) => {
      const conflictSlot = selectedSlot
      const conflictDate = selectedDate

      if (conflictSlot && conflictDate && selectedEmployeeId) {
        setIsCheckingConflict(true)
        try {
          const availability = await queryClient.fetchQuery({
            queryKey: ["public-availability", selectedEmployeeId, selectedService?.id, conflictDate],
            queryFn: () =>
              appointmentsApi.getPublicAvailability({
                salonSlug,
                employeeId: selectedEmployeeId,
                date: conflictDate,
                serviceId: selectedService?.id,
              }),
            // Load-bearing, and it is not a tuning knob. `fetchQuery` honours
            // `staleTime`, and this app sets it globally to five minutes
            // (`query-provider.tsx:13`). Step 3 read this exact key seconds
            // ago to paint the slot the visitor then picked, so without this
            // the "re-query" is served from that cache -- the very response
            // that listed the slot as free -- `stillAvailable` is always true,
            // the conflict is never detected, and the whole error screen is
            // unreachable. The tests cannot catch it either unless they set the
            // real staleTime: with the default 0, a cache hit and a network
            // call look identical. `public-confirm-step.test.tsx` pins it.
            staleTime: 0,
          })

          const stillAvailable = availability.slots.some(
            (slot) => `${availability.date}T${slot.startTime}` === conflictSlot
          )

          if (!stillAvailable) {
            setConflict({ slot: conflictSlot, date: conflictDate })
            return
          }
        } catch {
          // The re-check itself failed (network blip, etc.) -- fall through
          // to the generic banner with the *original* booking error instead
          // of masking it with an unrelated re-query failure.
        } finally {
          setIsCheckingConflict(false)
        }
      }

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

  const isSending = mutation.isPending || isCheckingConflict

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
      subtitle={DESKTOP_SUBTITLE}
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
