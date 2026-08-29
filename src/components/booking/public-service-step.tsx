"use client"

import { Card } from "@/components/ui/card"
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
            <Card
              key={service.id}
              className={`flex-row items-center justify-between gap-3 rounded-[10px] border border-border bg-card p-3.5 transition-colors hover:bg-muted/50 lg:gap-[14px] lg:p-4 cursor-pointer ${
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
            </Card>
          )
        })}
      </div>
    </BookingStepShell>
  )
}
