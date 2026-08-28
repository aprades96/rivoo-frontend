"use client"

import { use, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { UnavailableNotice } from "@/components/booking/unavailable-notice"
import { salonsApi } from "@/lib/api/salons"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { PublicServiceStep } from "@/components/booking/public-service-step"
import { PublicEmployeeStep } from "@/components/booking/public-employee-step"
import { PublicDateTimeStep } from "@/components/booking/public-datetime-step"
import { PublicClientStep } from "@/components/booking/public-client-step"
import { PublicConfirmStep } from "@/components/booking/public-confirm-step"
import { PublicSuccessStep } from "@/components/booking/public-success-step"
import { formatAddress } from "@/lib/utils/format"
import type { SalonPublic } from "@/types/salon"

export default function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const { step, prevStep, setSalonSlug, reset } = usePublicBookingStore()

  useEffect(() => {
    reset()
    setSalonSlug(slug)
  }, [slug, reset, setSalonSlug])

  const { data: salon, isLoading, error, refetch, isRefetching } = useQuery<SalonPublic>({
    queryKey: ["salon-public", slug],
    queryFn: () => salonsApi.getPublic(slug),
  })

  if (isLoading) return <div className="p-4"><LoadingSkeleton count={5} /></div>

  if (error || !salon) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-lg font-semibold">Salon no encontrado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          No existe ningun salon con esta direccion.
        </p>
      </div>
    )
  }

  // Lista vacia con el flag en false: es el catalogo real del salon, no un
  // fallo de carga. En ese caso no hay nada que reservar y no tiene sentido
  // ofrecer el asistente de pasos (progreso, siguiente, etc.) - se sustituye
  // la pagina entera por un aviso, igual que "Salon no encontrado" arriba.
  // Lista vacia con el flag en true es justo lo contrario: el catalogo no ha
  // podido cargarse (red o 5xx de staff-service) y decir "no acepta reservas"
  // seria mentirle al visitante y costarle una reserva real al salon.
  if (salon.services.length === 0) {
    return (
      <div className="p-4">
        <div className="mb-4">
          <h1 className="text-lg font-semibold">{salon.name}</h1>
          <p className="text-xs text-muted-foreground">
            {formatAddress(salon.addressStreet, salon.addressCity, salon.addressPostalCode)}
          </p>
        </div>

        {salon.servicesUnavailable ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <UnavailableNotice
              title="No hemos podido cargar el catalogo"
              description="Vuelve a intentarlo en unos minutos."
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={`mr-1.5 h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
              Reintentar
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <h2 className="text-base font-semibold">Este salon aun no acepta reservas online</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ponte en contacto directamente con el salon para reservar tu cita.
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* Salon header */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          {step > 1 && step < 6 && (
            <Button variant="ghost" size="icon-sm" onClick={prevStep}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-lg font-semibold">{salon.name}</h1>
            <p className="text-xs text-muted-foreground">
              {formatAddress(salon.addressStreet, salon.addressCity, salon.addressPostalCode)}
            </p>
          </div>
        </div>

        {/* Progress */}
        {step < 6 && (
          <div className="mt-3 flex gap-1">
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Steps */}
      {step === 1 && <PublicServiceStep salon={salon} />}
      {step === 2 && <PublicEmployeeStep salon={salon} />}
      {step === 3 && <PublicDateTimeStep salon={salon} />}
      {step === 4 && <PublicClientStep />}
      {step === 5 && <PublicConfirmStep salon={salon} />}
      {step === 6 && <PublicSuccessStep salon={salon} />}
    </div>
  )
}
