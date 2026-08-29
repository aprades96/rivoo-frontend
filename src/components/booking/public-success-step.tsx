"use client"

import { CalendarCheck, Phone } from "lucide-react"
import { addMinutes, format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { BookingResultShell } from "@/components/booking/booking-result-shell"
import { Button } from "@/components/ui/button"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { formatCurrency, formatPhone } from "@/lib/utils/format"
import { formatDuration } from "@/lib/utils/dates"
import type { SalonPublic } from "@/types/salon"

interface PublicSuccessStepProps {
  salon: SalonPublic
}

/**
 * RFC 5545 §3.3.11: backslash first (or the escapes below double-escape
 * themselves), then `;`, `,` and embedded newlines. Every TEXT-valued
 * property we write (SUMMARY, DESCRIPTION, LOCATION) goes through this --
 * addresses and service names routinely carry commas
 * ("Carrer de Verdi 42, Gracia").
 */
function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n")
}

/** `date-fns` local `Date` -> floating iCal DATE-TIME ("20260828T110000"). No `Z`/TZID on
 * purpose: the appointment time is whatever the salon's wall clock says, not a UTC instant --
 * a floating value is read back by every calendar app as "this literal local time". */
function toIcsDateTime(date: Date): string {
  return format(date, "yyyyMMdd'T'HHmmss")
}

/** DTSTAMP, unlike DTSTART/DTEND, is always a UTC instant (RFC 5545 §3.8.7.2) --
 * `toISOString()` guarantees UTC regardless of the runner's local timezone,
 * where `date-fns format()` would read back the machine's local wall clock. */
function toIcsUtcTimestamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`
}

interface IcsEventInput {
  uid: string
  now: Date
  start: Date
  end: Date
  serviceName: string
  salonName: string
  address: string
  employeeName: string
  clientName: string
}

/** Pure by design (no `Blob`/DOM here) so the escaping and field mapping can be asserted
 * directly, without mocking `URL.createObjectURL` for every case. */
export function buildIcsContent(input: IcsEventInput): string {
  const { uid, now, start, end, serviceName, salonName, address, employeeName, clientName } = input

  const descriptionLines = [
    employeeName ? `Con ${employeeName}` : null,
    `A nombre de ${clientName}`,
  ].filter((line): line is string => Boolean(line))

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rivoo//Reserva publica//ES",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtcTimestamp(now)}`,
    `DTSTART:${toIcsDateTime(start)}`,
    `DTEND:${toIcsDateTime(end)}`,
    `SUMMARY:${escapeIcsText(`${serviceName} - ${salonName}`)}`,
    `DESCRIPTION:${escapeIcsText(descriptionLines.join("\n"))}`,
    `LOCATION:${escapeIcsText(address)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]

  // CRLF: RFC 5545 §3.1 line ending, not a Windows-vs-Unix accident.
  return lines.join("\r\n")
}

function downloadIcsFile(content: string, fileName: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function SummaryRow({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-muted-foreground-2">{label}</span>
      {emphasize ? (
        <span className="font-heading text-xl font-semibold tabular-nums tracking-display">{value}</span>
      ) : (
        <span className="text-right text-sm font-semibold">{value}</span>
      )}
    </div>
  )
}

/**
 * Step 6 chassis: terminal screen, `BookingResultShell` (not
 * `BookingStepShell`) paints the icon circle, centered title and subtitle --
 * this component only supplies the icon and the booking-specific content
 * below it. `design/ReservaPaso6.dc.html` (mobile) /
 * `design/ReservaDesktopPaso6.dc.html` (desktop).
 */
export function PublicSuccessStep({ salon }: PublicSuccessStepProps) {
  const { selectedService, selectedEmployeeId, selectedDate, selectedSlot, clientForm } = usePublicBookingStore()

  const employee = salon.employees.find((candidate) => candidate.id === selectedEmployeeId) ?? null
  const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : ""
  const clientName = `${clientForm.firstName} ${clientForm.lastName}`.trim()

  const startDate = selectedSlot ? parseISO(selectedSlot) : null
  const endDate = startDate && selectedService ? addMinutes(startDate, selectedService.durationMinutes) : null

  const timeRangeDisplay = startDate
    ? endDate
      ? `${format(startDate, "HH:mm")} - ${format(endDate, "HH:mm")}`
      : format(startDate, "HH:mm")
    : ""

  // Artboard: "Miercoles, 28 de agosto" -- comma + "de", no year (design/ReservaDesktopPaso6.dc.html:57).
  const dateDisplay = selectedDate ? format(parseISO(selectedDate), "EEEE, d 'de' MMMM", { locale: es }) : ""

  const totalDisplay = selectedService ? formatCurrency(selectedService.price, selectedService.currency) : ""

  const handleAddToCalendar = () => {
    if (!startDate || !endDate || !selectedService) return

    const content = buildIcsContent({
      uid: `rivoo-booking-${salon.slug}-${startDate.getTime()}@rivoo`,
      now: new Date(),
      start: startDate,
      end: endDate,
      serviceName: selectedService.name,
      salonName: salon.name,
      address: `${salon.addressStreet}, ${salon.addressPostalCode} ${salon.addressCity}`,
      employeeName,
      clientName,
    })

    downloadIcsFile(content, "reserva-rivoo.ics")
  }

  return (
    <BookingResultShell
      salon={salon}
      tone="success"
      icon={<CalendarCheck className="size-8 md:size-[38px]" strokeWidth={1.75} />}
      title="Reserva confirmada"
      subtitle={
        <>
          {/* Artboard breaks the line before the email on mobile only (design/ReservaPaso6.dc.html:33
              vs design/ReservaDesktopPaso6.dc.html:49) -- two literal variants instead of a single
              node with a conditional <br>, so neither layout carries a stray collapsed space. */}
          <span className="md:hidden">
            Te hemos enviado un email de confirmacion a
            <br />
            {clientForm.email}
          </span>
          <span className="hidden md:inline">
            Te hemos enviado un email de confirmacion a {clientForm.email}
          </span>
        </>
      }
    >
      <div className="flex flex-col gap-3 md:flex-row md:gap-5">
        <div className="flex flex-col gap-3 rounded-[12px] border border-border bg-card p-4 md:flex-1 md:gap-3.5 md:p-6">
          <div className="flex flex-col gap-1 md:border-b md:border-hairline md:pb-3.5">
            <span className="font-heading text-2xl font-semibold tabular-nums tracking-display md:text-[28px]">
              {timeRangeDisplay}
            </span>
            <span className="text-sm text-muted-foreground">{dateDisplay}</span>
          </div>

          {/* Desktop: explicit label/value rows (design/ReservaDesktopPaso6.dc.html:58-61) */}
          <div className="hidden md:flex md:flex-col md:gap-3.5">
            <SummaryRow label="Servicio" value={selectedService?.name ?? ""} />
            {employeeName && <SummaryRow label="Profesional" value={employeeName} />}
            <SummaryRow label="A nombre de" value={clientName} />
            <SummaryRow label="Total" value={totalDisplay} emphasize />
          </div>

          {/* Mobile: running text, no labels (design/ReservaPaso6.dc.html:42-45) */}
          <div className="flex flex-col gap-0.5 border-t border-hairline pt-3 md:hidden">
            {selectedService && <span className="text-sm font-semibold">{selectedService.name}</span>}
            {selectedService && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatDuration(selectedService.durationMinutes)} · {totalDisplay}
              </span>
            )}
            {employeeName && <span className="text-xs text-muted-foreground">Con {employeeName}</span>}
            <span className="text-xs text-muted-foreground">A nombre de {clientName}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-[12px] border border-border bg-card p-3 md:w-[320px] md:shrink-0 md:gap-3 md:p-6">
          <span className="text-sm font-semibold md:text-[15px]">{salon.name}</span>

          {/* Postal code shows on the desktop card only -- brief T9 step 3, not in the mobile artboard. */}
          <span className="text-xs leading-relaxed text-muted-foreground md:hidden">
            {salon.addressStreet}, {salon.addressCity}
          </span>
          <span className="hidden text-[13px] leading-relaxed text-muted-foreground md:block">
            {salon.addressStreet}
            <br />
            {salon.addressPostalCode} {salon.addressCity}
          </span>

          {salon.phone && (
            <a
              href={`tel:${salon.phone}`}
              className="flex items-center gap-1.5 text-primary hover:text-primary/80 md:gap-2"
            >
              <Phone className="size-3.5" />
              <span className="text-[13px] font-semibold tabular-nums md:text-sm">
                {formatPhone(salon.phone)}
              </span>
            </a>
          )}

          <div className="hidden border-t border-hairline md:block" />

          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleAddToCalendar}
            className="hidden h-[42px] w-full justify-center text-[13px] font-semibold md:flex"
          >
            Anadir al calendario
          </Button>
        </div>
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground-2 md:mt-4 md:text-[13px]">
        <span className="md:hidden">
          Si necesitas cancelar o modificar tu cita,
          <br />
          contacta directamente con el salon.
        </span>
        <span className="hidden md:inline">
          Si necesitas cancelar o modificar tu cita, contacta directamente con el salon.
        </span>
      </p>
    </BookingResultShell>
  )
}
