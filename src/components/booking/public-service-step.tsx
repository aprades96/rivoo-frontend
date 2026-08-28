"use client"

import { Card } from "@/components/ui/card"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { formatCurrency } from "@/lib/utils/format"
import { formatDuration } from "@/lib/utils/dates"
import { dayName } from "@/lib/utils/business-hours"
import type { SalonPublic, ServicePublic } from "@/types/salon"

interface PublicServiceStepProps {
  salon: SalonPublic
}

export function PublicServiceStep({ salon }: PublicServiceStepProps) {
  const { selectedService, selectService, nextStep } = usePublicBookingStore()

  const services: ServicePublic[] = salon.services

  const handleSelect = (service: ServicePublic) => {
    selectService(service)
    nextStep()
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Elige un servicio</h2>
        {salon.description && (
          <p className="mt-1 text-sm text-muted-foreground">{salon.description}</p>
        )}
      </div>

      {/*
        No dead-end branch here for `services.length === 0`: this component
        has a single caller, book/[slug]/page.tsx:52, which already returns
        its own screen (the "unavailable catalogue" / "no acepta reservas"
        split, using `salon.servicesUnavailable`) before ever reaching step 1
        with an empty catalogue. Reintroducing that split here would be
        unreachable production code covered only by tests that render this
        component directly -- false confidence, not a real regression net.
      */}
      <div className="space-y-2">
        {services.map((service) => {
          const isSelected = selectedService?.id === service.id
          return (
            <Card
              key={service.id}
              className={`cursor-pointer p-3 transition-colors hover:bg-muted/50 ${
                isSelected ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => handleSelect(service)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{service.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDuration(service.durationMinutes)}
                  </p>
                </div>
                <span className="text-sm font-semibold">
                  {formatCurrency(service.price, service.currency)}
                </span>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Business hours info */}
      {salon.businessHours && salon.businessHours.length > 0 && (
        <div className="rounded-lg bg-muted p-3">
          <p className="mb-1 text-xs font-medium">Horario</p>
          <div className="space-y-0.5 text-xs text-muted-foreground">
            {salon.businessHours
              .filter((h) => h.isOpen)
              .map((h) => (
                <p key={h.dayOfWeek}>
                  {dayName(h.dayOfWeek)}: {h.openTime} - {h.closeTime}
                </p>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
