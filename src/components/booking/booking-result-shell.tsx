import type { ReactNode } from "react"
import { BookingDesktopHeader } from "@/components/booking/booking-salon-header"
import { cn } from "@/lib/utils"
import type { SalonPublic } from "@/types/salon"

export interface BookingResultShellProps {
  salon: SalonPublic
  tone: "success" | "error"
  icon: ReactNode
  title: string
  subtitle?: ReactNode
  children: ReactNode
}

const TONE_CIRCLE_CLASSES: Record<BookingResultShellProps["tone"], string> = {
  success: "bg-success-soft text-success",
  error: "bg-destructive-soft text-destructive",
}

/**
 * Second chassis: the confirmation screen (step 6) and the slot-conflict
 * error screen are not "a step without the aside column", they are a
 * different kind of screen -- centered header, no stepper, no progress bar,
 * icon-then-title, 860px content container instead of 1120px. Brief T2
 * Paso 6.
 */
export function BookingResultShell({ salon, tone, icon, title, subtitle, children }: BookingResultShellProps) {
  return (
    <div className="flex flex-1 flex-col">
      {/* Cabecera movil centrada, sin atras ni contador -- design/ReservaPaso6.dc.html:24 */}
      <div className="flex h-[60px] shrink-0 items-center justify-center bg-muted px-4 border-b md:hidden">
        <span className="font-heading text-[19px] font-semibold tracking-display">{salon.name}</span>
      </div>
      <BookingDesktopHeader salon={salon} />

      {/*
        Espaciado tomado de `design/ReservaDesktopPaso6.dc.html:45` (padding
        64px 40px 0, gap 22px) y su equivalente movil `ReservaPaso6.dc.html:28`
        (padding 40px 20px 0, gap 18px) -- el 860px del contrato viene del
        mismo artboard, linea 53. `ReservaError(Desktop).dc.html` usa un
        espaciado mas ajustado (52px/28px, gap 22px/16px) para la misma
        cabecera: es una pantalla con menos contenido debajo del titulo, no
        una regla distinta del chasis. Se prioriza el valor de Paso6 (el que
        fija el contrato) para no bifurcar el espaciado del chasis por tone.
      */}
      <div className="mx-auto flex w-full flex-1 flex-col items-center gap-[18px] px-5 pt-10 pb-10 md:gap-[22px] md:px-10 md:pt-16">
        <div
          className={cn(
            "flex size-[68px] items-center justify-center rounded-full md:size-20",
            TONE_CIRCLE_CLASSES[tone]
          )}
        >
          {icon}
        </div>

        <div className="flex flex-col items-center gap-1.5 text-center md:gap-2">
          <h1 className="font-heading text-[30px] leading-[1.1] font-semibold tracking-display md:text-[40px] md:leading-[1.05]">
            {title}
          </h1>
          {subtitle && (
            <div className="text-[13px] leading-relaxed text-muted-foreground md:text-[15px]">
              {subtitle}
            </div>
          )}
        </div>

        <div className="mt-1.5 w-full max-w-[860px] md:mt-2">{children}</div>
      </div>
    </div>
  )
}
