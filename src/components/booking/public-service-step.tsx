"use client"

import { BookingStepShell } from "@/components/booking/booking-step-shell"
import { SalonInfoAside } from "@/components/booking/salon-info-aside"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { formatCurrency } from "@/lib/utils/format"
import { formatDuration } from "@/lib/utils/dates"
import type { SalonPublic, ServicePublic } from "@/types/salon"

interface PublicServiceStepProps {
  salon: SalonPublic
}

/**
 * `design/ReservaDesktopPaso1.dc.html:67,103` groups the desktop grid under
 * section labels ("Cabello", "Barberia y unas"). There is no data behind that
 * grouping: `ServicePublic` (the public catalogue salon-service actually
 * returns, see `src/types/salon.ts`) carries no `category` field at all --
 * unlike the owner-facing `ServiceOffering` (`src/types/service.ts`), which
 * has one but is never wired into this public flow. Rendering fake or
 * inferred categories would be worse than none, so this grid stays flat
 * (ungrouped) until the public endpoint actually exposes a category; see the
 * task report for the flag raised to the orchestrator.
 */
export function PublicServiceStep({ salon }: PublicServiceStepProps) {
  const { selectedService, selectService, nextStep } = usePublicBookingStore()

  const services: ServicePublic[] = salon.services

  const handleSelect = (service: ServicePublic) => {
    selectService(service)
    nextStep()
  }

  return (
    <BookingStepShell
      salon={salon}
      step={1}
      title="Elige un servicio"
      subtitle="Reserva en menos de un minuto. No necesitas crear cuenta."
      aside={<SalonInfoAside salon={salon} />}
    >
      {/*
        No dead-end branch here for `services.length === 0`: this component
        has a single caller, book/[slug]/page.tsx, which already returns
        its own screen (the "unavailable catalogue" / "no acepta reservas"
        split, using `salon.servicesUnavailable`) before ever reaching step 1
        with an empty catalogue. Reintroducing that split here would be
        unreachable production code covered only by tests that render this
        component directly -- false confidence, not a real regression net.
      */}
      <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-[14px]">
        {services.map((service) => {
          const isSelected = selectedService?.id === service.id
          return (
            // `button`, no `Card`: `Card` pinta un `div`, y con el `onClick`
            // encima la pantalla se quedaba sin UN SOLO elemento enfocable --
            // ni teclado ni lector de pantalla podian elegir servicio en una
            // pagina publica y anonima. `aria-pressed` porque el estado
            // elegido se comunicaba solo con color.
            <button
              key={service.id}
              type="button"
              aria-pressed={isSelected}
              className={`flex w-full flex-row items-center justify-between gap-3 rounded-[10px] border border-border bg-card p-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:gap-[14px] lg:p-4 cursor-pointer ${
                isSelected ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => handleSelect(service)}
            >
              <div className="flex min-w-0 flex-col gap-[3px]">
                <p className="text-[15px] font-semibold">{service.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDuration(service.durationMinutes)}
                </p>
              </div>
              <span className="whitespace-nowrap text-[22px] font-semibold tabular-nums lg:text-xl">
                {formatCurrency(service.price, service.currency)}
              </span>
            </button>
          )
        })}
      </div>
    </BookingStepShell>
  )
}
