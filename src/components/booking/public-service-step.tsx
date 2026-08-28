"use client"

import { Card } from "@/components/ui/card"
import { UnavailableNotice } from "@/components/booking/unavailable-notice"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { formatCurrency } from "@/lib/utils/format"
import { formatDuration } from "@/lib/utils/dates"
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

      {services.length === 0 ? (
        // Una lista vacia tiene dos causas distintas y el visitante no puede
        // distinguirlas: que el salon no ofrezca nada, o que la lista no haya
        // llegado. El flag solo cambia como se explica el vacio, nunca oculta
        // servicios reales. Sin servicios no hay tarjeta que pulsar, asi que en
        // los dos casos el paso ya no deja avanzar.
        salon.servicesUnavailable ? (
          <UnavailableNotice
            title="No hemos podido cargar los servicios"
            description="Vuelve a intentarlo en unos minutos."
          />
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Este salon no tiene servicios disponibles para reserva online.
            </p>
          </div>
        )
      ) : (
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
      )}

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

const DAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
function dayName(dayOfWeek: number): string {
  return DAYS[dayOfWeek - 1] ?? ""
}
