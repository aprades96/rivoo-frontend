"use client"

import { use, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { salonsApi } from "@/lib/api/salons"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { PublicServiceStep } from "@/components/booking/public-service-step"
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

  const { data: salon, isLoading, error } = useQuery<SalonPublic>({
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

  return (
    <div className="p-4">
      {/* Salon header */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          {step > 1 && step < 5 && (
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
        {step < 5 && (
          <div className="mt-3 flex gap-1">
            {[1, 2, 3, 4].map((s) => (
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
      {step === 2 && <PublicDateTimeStep />}
      {step === 3 && <PublicClientStep />}
      {step === 4 && <PublicConfirmStep salon={salon} />}
      {step === 5 && <PublicSuccessStep salon={salon} />}
    </div>
  )
}
