"use client"

import type { ReactNode } from "react"
import { addMinutes, format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { BookingStepShell } from "@/components/booking/booking-step-shell"
import { BookingSummaryAside } from "@/components/booking/booking-summary-aside"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { formatCurrency } from "@/lib/utils/format"
import { formatDuration } from "@/lib/utils/dates"
import type { SalonPublic } from "@/types/salon"

interface PublicClientStepProps {
  salon: SalonPublic
}

const CONSENT_LABEL =
  "Acepto que mis datos se utilicen para gestionar esta reserva. Puedo solicitar su eliminacion en cualquier momento. *"

// `.fld`/`.fldok` (`design/ReservaPaso4.dc.html:19-20`) y `.in`
// (`design/ReservaDesktopPaso4.dc.html:28`): mismo campo, dos alturas/paddings
// segun viewport -- movil 46px/14px, escritorio 42px/12px.
const FIELD_CLASS =
  "h-[46px] w-full rounded-lg border border-border bg-card px-3.5 text-sm text-foreground placeholder:text-muted-foreground-2 lg:h-[42px] lg:px-3"

export function PublicClientStep({ salon }: PublicClientStepProps) {
  const {
    selectedService,
    selectedEmployeeId,
    selectedSlot,
    clientForm,
    setClientForm,
    honeypot,
    setHoneypot,
    nextStep,
    prevStep,
  } = usePublicBookingStore()

  const isValid = Boolean(
    clientForm.firstName &&
      clientForm.lastName &&
      clientForm.email &&
      clientForm.phone &&
      clientForm.gdprConsent
  )

  const employee = salon.employees.find((e) => e.id === selectedEmployeeId) ?? null
  const startDateTime = selectedSlot ? parseISO(selectedSlot) : null
  const endDateTime =
    startDateTime && selectedService
      ? addMinutes(startDateTime, selectedService.durationMinutes)
      : null

  // Resumen del footer movil, `design/ReservaPaso4.dc.html:83`:
  // "Corte + Tinte con Laura · miercoles 28, 11:00". El dia de la semana sale
  // de date-fns con acento ("miercoles"): igual que en el resto del asistente
  // (`public-confirm-step.tsx`, `dates.ts`), no se fuerza a ASCII solo porque
  // el artboard este escrito sin tildes.
  const mobileSummary =
    selectedService && employee && startDateTime
      ? `${selectedService.name} con ${employee.firstName} · ${format(startDateTime, "EEEE d", { locale: es })}, ${format(startDateTime, "HH:mm")}`
      : null

  const dateTimeValue =
    startDateTime && endDateTime
      ? `${format(startDateTime, "EEE d", { locale: es })}, ${format(startDateTime, "HH:mm")} - ${format(endDateTime, "HH:mm")}`
      : undefined

  return (
    <BookingStepShell
      salon={salon}
      step={4}
      title="Tus datos"
      subtitle="Solo para gestionar esta reserva."
      onBack={prevStep}
      aside={
        <BookingSummaryAside
          rows={[
            {
              label: "Servicio",
              value: selectedService?.name,
              detail: selectedService
                ? `${formatDuration(selectedService.durationMinutes)} · ${formatCurrency(selectedService.price, selectedService.currency)}`
                : undefined,
            },
            {
              label: "Profesional",
              value: employee ? `${employee.firstName} ${employee.lastName}`.trim() : undefined,
            },
            {
              label: "Fecha y hora",
              value: dateTimeValue ? <span className="capitalize">{dateTimeValue}</span> : undefined,
            },
          ]}
          ctaLabel="Revisar reserva"
          ctaDisabled={!isValid}
          onCtaClick={nextStep}
        />
      }
      footer={
        <div className="flex flex-col gap-2.5">
          {mobileSummary && (
            <span className="text-center text-xs text-muted-foreground capitalize">
              {mobileSummary}
            </span>
          )}
          <Button size="2xl" onClick={nextStep} disabled={!isValid}>
            Revisar reserva
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3.5 lg:gap-[18px] lg:rounded-[12px] lg:border lg:border-border lg:bg-card lg:p-6">
        <div className="grid grid-cols-2 gap-2.5 lg:gap-4">
          <Field id="client-firstName" label="Nombre *">
            <Input
              id="client-firstName"
              value={clientForm.firstName}
              onChange={(e) => setClientForm({ firstName: e.target.value })}
              placeholder="Nombre"
              className={FIELD_CLASS}
            />
          </Field>
          <Field id="client-lastName" label="Apellidos *">
            <Input
              id="client-lastName"
              value={clientForm.lastName}
              onChange={(e) => setClientForm({ lastName: e.target.value })}
              placeholder="Apellidos"
              className={FIELD_CLASS}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-2 lg:gap-4">
          <Field id="client-email" label="Email *">
            <Input
              id="client-email"
              type="email"
              value={clientForm.email}
              onChange={(e) => setClientForm({ email: e.target.value })}
              placeholder="tu@email.com"
              className={FIELD_CLASS}
            />
          </Field>
          <Field id="client-phone" label="Telefono *">
            <Input
              id="client-phone"
              type="tel"
              value={clientForm.phone}
              onChange={(e) => setClientForm({ phone: e.target.value })}
              placeholder="612 345 678"
              className={FIELD_CLASS}
            />
          </Field>
        </div>

        {/* Honeypot — hidden from real users */}
        <div className="absolute -left-[9999px] opacity-0" aria-hidden="true">
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        {/* GDPR consent -- primitiva Checkbox de `src/components/ui/checkbox.tsx`.
            El <label> va asociado por htmlFor/id, no anidado alrededor del
            Checkbox: CheckboxRoot ya redispara un click sintetico sobre su
            input oculto (`node_modules/@base-ui/react/checkbox/root/CheckboxRoot.js`),
            y anidarlo dentro de un <label> nativo dispararia un segundo click
            del propio label sobre ese mismo input -- doble toggle. */}
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card p-3 lg:bg-background lg:p-3.5">
          <Checkbox
            id="client-gdpr-consent"
            checked={clientForm.gdprConsent}
            onCheckedChange={(checked) => setClientForm({ gdprConsent: checked })}
            className="mt-px"
          />
          <label
            htmlFor="client-gdpr-consent"
            className="cursor-pointer text-xs leading-[1.5] text-muted-foreground lg:text-[13px]"
          >
            {CONSENT_LABEL}
          </label>
        </div>
      </div>
    </BookingStepShell>
  )
}

interface FieldProps {
  id: string
  label: string
  children: ReactNode
}

function Field({ id, label, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}
