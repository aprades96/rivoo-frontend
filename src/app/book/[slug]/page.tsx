"use client"

import { use, useEffect, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { UnavailableNotice } from "@/components/booking/unavailable-notice"
import { BookingStepShell } from "@/components/booking/booking-step-shell"
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

/**
 * Titulo/subtitulo estatico de cada paso, tal cual aparecen en los artboards
 * (`design/ReservaPaso1..5.dc.html`). Es contenido DUPLICADO a proposito, no
 * un descuido: cada `Public*Step` sigue pintando su propio `<h2>` con este
 * mismo texto (y, en los pasos 2-3, con datos dinamicos que este chasis no
 * tiene motivo para recalcular). Ese duplicado desaparece cuando la tarea de
 * cada paso individual retire su cabecera interna y empiece a fiarse de la
 * que ya pinta `BookingStepShell` -- fuera del alcance de la tarea de chasis.
 */
const STEP_META: Record<1 | 2 | 3 | 4 | 5, { title: string; subtitle?: string }> = {
  1: {
    title: "Elige un servicio",
    subtitle: "Reserva en menos de un minuto. No necesitas crear cuenta.",
  },
  2: {
    title: "Con quien la quieres",
    subtitle: "Si eliges profesional veras solo sus huecos libres.",
  },
  3: { title: "Elige fecha y hora" },
  4: { title: "Tus datos", subtitle: "Solo para gestionar esta reserva." },
  5: { title: "Confirma tu reserva" },
}

/**
 * Ancho responsive compartido por las dos pantallas de este fichero que no
 * tienen artboard propio ("Salon no encontrado", catalogo vacio): sin esto,
 * al vaciar `layout.tsx` de su cabecera/pie fijos se quedarian sin ningun
 * chasis y volverian a verse como la maqueta movil estirada en escritorio.
 * No es un tercer contrato -- ninguna tarea futura consume estas dos
 * pantallas por prop, asi que no hace falta fijar su forma.
 */
function ResponsivePageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[390px] px-5 py-6 md:max-w-2xl md:px-10 md:py-10">
      {children}
    </div>
  )
}

export default function PublicBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const { step, prevStep, setSalonSlug, reset, conflict } = usePublicBookingStore()

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
      <ResponsivePageContainer>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <h2 className="text-lg font-semibold">Salon no encontrado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No existe ningun salon con esta direccion.
          </p>
        </div>
      </ResponsivePageContainer>
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
      <ResponsivePageContainer>
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
      </ResponsivePageContainer>
    )
  }

  // Un 409 de "hueco ocupado" (public-confirm-step, ver public-booking-store
  // Paso 7) no consume un septimo `step`: `conflict` es un campo aparte y se
  // comprueba antes que `step` para no dejar la pantalla de confirmar con
  // datos que el backend acaba de rechazar.
  if (conflict) {
    // TODO(T10): sustituir por la pantalla de error real, montada sobre
    // BookingResultShell tone="error" (design/ReservaError.dc.html,
    // design/ReservaErrorDesktop.dc.html). Todavia no existe: se deja el
    // hueco preparado para que el 409 no caiga en la pantalla de confirmar.
    return (
      <ResponsivePageContainer>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <h2 className="text-lg font-semibold">Ese hueco se acaba de ocupar</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Vuelve a elegir hora para tu cita.
          </p>
        </div>
      </ResponsivePageContainer>
    )
  }

  if (step === 6) {
    // TODO: montar sobre BookingResultShell tone="success" cuando la tarea de
    // este paso retire el icono/titulo que PublicSuccessStep ya pinta por su
    // cuenta (mismo duplicado transitorio que STEP_META, ver comentario ahi).
    return <PublicSuccessStep salon={salon} />
  }

  return (
    <BookingStepShell
      salon={salon}
      step={step as 1 | 2 | 3 | 4 | 5}
      title={STEP_META[step as 1 | 2 | 3 | 4 | 5].title}
      subtitle={STEP_META[step as 1 | 2 | 3 | 4 | 5].subtitle}
      onBack={step > 1 ? prevStep : undefined}
    >
      {step === 1 && <PublicServiceStep salon={salon} />}
      {step === 2 && <PublicEmployeeStep salon={salon} />}
      {step === 3 && <PublicDateTimeStep salon={salon} />}
      {step === 4 && <PublicClientStep />}
      {step === 5 && <PublicConfirmStep salon={salon} />}
    </BookingStepShell>
  )
}
