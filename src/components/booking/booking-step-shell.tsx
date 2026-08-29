"use client"

import type { ReactNode } from "react"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BookingStepper } from "@/components/booking/booking-stepper"
import { BookingDesktopHeader, SalonMark } from "@/components/booking/booking-salon-header"
import { useMediaQuery } from "@/hooks/use-media-query"
import { getTodayBusinessHours } from "@/lib/utils/business-hours"
import { formatAddress } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import type { SalonPublic } from "@/types/salon"

// Tailwind's `lg:` breakpoint (1024px) -- keep in sync if that ever changes.
const DESKTOP_QUERY = "(min-width: 1024px)"

// La barra de progreso movil tiene 6 tramos (cuenta tambien la pantalla de
// exito), el stepper de escritorio tiene 5 nodos (solo los pasos con
// formulario). Son artboards distintos y no se unifican -- brief T2 Paso 2.
const MOBILE_PROGRESS_SEGMENTS = 6

export interface BookingStepShellProps {
  salon: SalonPublic
  step: 1 | 2 | 3 | 4 | 5
  title: string
  /**
   * `ReactNode`, no `string`, y es deliberado: los artboards no coinciden entre
   * breakpoints. El paso 1 lleva subtitulo en movil y en escritorio; el 2 lo
   * lleva solo en escritorio (en movil ese texto vive en el pie); el 5 igual.
   * Con `string` el chasis lo pintaba siempre, asi que cada paso invento su
   * propio apano —uno lo dejo duplicado en movil, otro se lo pinto aparte
   * perdiendo el espaciado del artboard— y salieron cinco pasos con soluciones
   * distintas para el mismo problema. Aceptando un nodo, el paso decide su
   * visibilidad (`<span className="hidden lg:inline">`) sin salirse de su
   * fichero ni tocar este.
   */
  subtitle?: ReactNode
  onBack?: () => void
  aside?: ReactNode
  footer?: ReactNode
  asideWidth?: 320 | 340
  children: ReactNode
}

export function BookingStepShell({
  salon,
  step,
  title,
  subtitle,
  onBack,
  aside,
  footer,
  asideWidth = 320,
  children,
}: BookingStepShellProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  // Montaje condicional, no CSS: con los dos en el DOM a la vez,
  // getByRole("button", { name: "Continuar" }) encuentra dos coincidencias
  // (aside y footer llevan cada uno su propio boton "Continuar") -- brief T2
  // Paso 5, y es el estilo de consulta que ya usan los tests del repo
  // (public-datetime-step.test.tsx:82).
  const showAside = isDesktop && aside != null
  const showFooter = !isDesktop && footer != null

  return (
    <div className="flex flex-1 flex-col">
      <MobileStepHeader salon={salon} step={step} onBack={onBack} />
      <BookingDesktopHeader salon={salon} />

      {/*
        `pt-5` (20px) para los 5 pasos: coincide con step 1
        (`design/ReservaPaso1.dc.html:38`, padding-top 20px) y difiere en 2px
        de los pasos 2-5 (`design/ReservaPaso2.dc.html:35`, 18px). Los 2px no
        se distinguen a simple vista y unificarlos evita que este contenedor
        compartido necesite saber en que paso esta para variar su propio
        padding -- justo lo que el chasis existe para no repetir.
      */}
      <div
        className={cn(
          "mx-auto flex w-full max-w-[390px] flex-1 flex-col gap-[18px] px-5 pt-5 md:max-w-2xl md:gap-[26px] md:px-10 md:py-8 lg:flex-row lg:items-start lg:gap-10 xl:max-w-[1120px]",
          showFooter && "pb-28"
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-[18px] md:gap-[26px]">
          <MobileProgress step={step} />
          <BookingStepper step={step} />

          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-[28px] leading-[1.1] font-semibold tracking-display md:text-[34px] md:leading-[1.05]">
              {title}
            </h1>
            {subtitle && <p className="text-[13px] text-muted-foreground md:text-sm">{subtitle}</p>}
          </div>

          {children}
        </div>

        {showAside && (
          <div
            className={cn(
              "shrink-0 self-start",
              asideWidth === 340 ? "w-[340px]" : "w-[320px]"
            )}
          >
            {aside}
          </div>
        )}
      </div>

      {showFooter && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-background px-5 pb-5 pt-3.5">
          {footer}
        </div>
      )}
    </div>
  )
}

interface MobileStepHeaderProps {
  salon: SalonPublic
  step: 1 | 2 | 3 | 4 | 5
  onBack?: () => void
}

function MobileStepHeader({ salon, step, onBack }: MobileStepHeaderProps) {
  if (step === 1) {
    return <MobileStepOneHeader salon={salon} />
  }

  return (
    <div className="flex h-[60px] shrink-0 items-center justify-between gap-2.5 bg-muted py-0 pr-4 pl-2 border-b md:hidden">
      <div className="flex items-center gap-1">
        {onBack && (
          <Button variant="ghost" size="icon" className="size-11" onClick={onBack} aria-label="Volver">
            <ChevronLeft className="size-5" />
          </Button>
        )}
        <span className="font-heading text-[19px] font-semibold tracking-display">{salon.name}</span>
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground">
        {step} / {MOBILE_PROGRESS_SEGMENTS}
      </span>
    </div>
  )
}

/**
 * Tall mobile header, step 1 only (`design/ReservaPaso1.dc.html:24-36`): icon
 * + name + address, plus the "open now" line. That line lives here on
 * mobile, not in the aside (aside only mounts from `lg:` and step 1's aside
 * is business-hours content built by a later task) -- brief T2 Paso 3.
 */
function MobileStepOneHeader({ salon }: { salon: SalonPublic }) {
  const today = getTodayBusinessHours(salon.businessHours)
  const isOpenNow = today?.isOpen ?? false

  return (
    <div className="flex shrink-0 flex-col gap-3 bg-muted px-5 pt-7 pb-[22px] border-b md:hidden">
      <div className="flex items-center gap-2.5">
        <SalonMark className="size-[30px] text-primary" />
        <div className="flex flex-col">
          <span className="font-heading text-[30px] leading-[1.05] font-semibold tracking-display">
            {salon.name}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {formatAddress(salon.addressStreet, salon.addressCity, salon.addressPostalCode)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-[7px]">
        <div className={cn("size-[7px] rounded-full", isOpenNow ? "bg-[#5C7A5E]" : "bg-text-subtle")} />
        <span className={cn("text-xs font-medium", isOpenNow ? "text-success" : "text-text-subtle")}>
          {isOpenNow ? `Abierto hoy hasta las ${today?.closeTime}` : "Cerrado hoy"}
        </span>
      </div>
    </div>
  )
}

function MobileProgress({ step }: { step: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <div className="flex items-center gap-2 md:hidden">
      <div className="flex flex-1 gap-[5px]">
        {Array.from({ length: MOBILE_PROGRESS_SEGMENTS }, (_, i) => (
          <div
            key={i}
            className={cn("h-[3px] flex-1 rounded-full", i < step ? "bg-primary" : "bg-border")}
          />
        ))}
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground">
        {step} / {MOBILE_PROGRESS_SEGMENTS}
      </span>
    </div>
  )
}
