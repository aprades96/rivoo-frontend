"use client"

import type { ReactNode } from "react"
import { ChevronLeft, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SalonMark } from "@/components/brand/salon-mark"
import { WizardProgress } from "@/components/appointments/wizard/wizard-progress"
import { WizardStepper } from "@/components/wizard/wizard-stepper"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"

// Tailwind's `lg:` breakpoint (1024px) -- keep in sync with `booking-step-shell.tsx`.
const DESKTOP_QUERY = "(min-width: 1024px)"

const STEP_LABELS = ["Profesional", "Servicio", "Fecha y hora", "Cliente", "Confirmar"]

export interface NewAppointmentShellProps {
  step: 1 | 2 | 3 | 4 | 5
  title: string
  /**
   * Solo se pinta en escritorio (`design/NuevaCitaDesktopPaso{1..5}.dc.html:61`):
   * ningun artboard movil lleva esta linea bajo el titulo, a diferencia de
   * `BookingStepShell`, donde cada paso decide su propia visibilidad por
   * breakpoint. Aqui la decide el chasis porque la diferencia es constante
   * en los cinco pasos, no paso a paso.
   */
  subtitle?: ReactNode
  onBack?: () => void
  onClose: () => void
  aside?: ReactNode
  footer?: ReactNode
  children: ReactNode
}

/**
 * Chasis del asistente de nueva cita (`(fullscreen)/appointments/new`).
 * Inspirado en `src/components/booking/booking-step-shell.tsx:99` -- mismo
 * problema (columna principal + aside opcional + pie fijo opcional) -- pero
 * sin copiarlo: aqui el cromo entero (cabeceras, progreso/stepper, aside,
 * pie) se decide en JS con un unico `useMediaQuery`, nunca con clases
 * `md:`/`lg:`. Dos motivos, los dos medidos:
 *  - Mezclando clases (cabecera movil `md:hidden` + cabecera de escritorio
 *    `hidden lg:flex`) la franja 768-1023 se queda sin NINGUNA cabecera y
 *    sin X para cerrar.
 *  - Mezclando clases con `useMediaQuery`: el hook devuelve `false` en SSR y
 *    en el primer pintado (`use-media-query.ts:16-24`), asi que un 1440 real
 *    pintaria la cabecera movil un instante antes de hidratar el contenedor
 *    de escritorio. Con `isDesktop` como fuente unica, antes de hidratar la
 *    pantalla es enteramente MOVIL -- que si es un artboard (390) -- y luego
 *    cambia entera de golpe.
 * No existe ningun artboard de este asistente a 768: solo 390 y 1440.
 *
 * INVARIANTE: `{children}` va SIEMPRE en la misma posicion del arbol
 * (ultimo hijo de la columna principal, que a su vez es siempre el primer
 * hijo del contenedor), en las DOS ramas de `isDesktop`. Si cambiara de
 * posicion o de tipo de hermano, React desmontaria y remontaria los pasos en
 * la unica transicion SSR-false -> cliente-real que fuerza
 * `useMediaQuery` -- el mismo bug que ya explica
 * `src/app/(app)/layout.tsx:50-58` por su nombre. El store de Zustand
 * sobrevive a un remontaje; el `useState` local de un paso (texto del
 * buscador, un formulario a medio escribir) no. Por eso un SOLO `return`,
 * con cabeceras/aside/pie como hermanos opcionales alrededor de un
 * contenedor y una columna principal ESTABLES -- se montan siempre, solo
 * cambian sus clases y lo que pintan por delante de `children`.
 */
export function NewAppointmentShell({
  step,
  title,
  subtitle,
  onBack,
  onClose,
  aside,
  footer,
  children,
}: NewAppointmentShellProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  // Montaje condicional, no CSS -- con los dos en el DOM a la vez un
  // `getByRole("button", { name: "Continuar" })` encontraria dos
  // coincidencias (aside y footer llevan cada uno su propio CTA), igual que
  // documenta `booking-step-shell.tsx:67-73`.
  const showAside = isDesktop && aside != null
  const showFooter = !isDesktop && footer != null

  return (
    <div className="flex flex-1 flex-col">
      {isDesktop ? <DesktopHeader onClose={onClose} /> : <MobileHeader onBack={onBack} onClose={onClose} />}

      <div
        className={cn(
          "flex w-full flex-1",
          isDesktop ? "mx-auto max-w-[1120px] gap-10 px-10 py-8" : "flex-col gap-4 px-4 pt-3.5",
          showFooter && "pb-28"
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-4",
            isDesktop && "min-w-0 flex-1 gap-[26px]"
          )}
        >
          {isDesktop ? (
            <WizardStepper step={step} labels={STEP_LABELS} visibleFrom="lg" />
          ) : (
            <WizardProgress step={step} />
          )}

          {isDesktop ? (
            <div className="flex flex-col gap-1.5">
              <h1 className="font-heading text-[34px] leading-[1.05] font-semibold tracking-display">
                {title}
              </h1>
              {subtitle && <p className="text-sm leading-tight text-muted-foreground">{subtitle}</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-[3px]">
              <span className="text-[11px] leading-tight font-semibold tracking-[0.06em] text-muted-foreground-2 uppercase">
                Paso {step} de 5
              </span>
              <h1 className="font-heading text-[27px] leading-[1.1] font-semibold tracking-[-0.015em]">
                {title}
              </h1>
            </div>
          )}

          {children}
        </div>

        {showAside && <div className="w-[320px] shrink-0 self-start">{aside}</div>}
      </div>

      {showFooter && (
        <div className="fixed inset-x-0 bottom-0 z-10 flex flex-col gap-2.5 border-t border-border bg-background px-4 pt-3.5 pb-5">
          {footer}
        </div>
      )}
    </div>
  )
}

interface MobileHeaderProps {
  onBack?: () => void
  onClose: () => void
}

/**
 * `design/NuevaCitaPaso1.dc.html:25-31`. La caja de 44x44 de la izquierda se
 * reserva SIEMPRE, con o sin `onBack`: el artboard del paso 1 (`:26`) dibuja
 * un div vacio ahi, no lo colapsa.
 */
function MobileHeader({ onBack, onClose }: MobileHeaderProps) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-border pr-3 pl-2">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver"
          className="flex size-11 items-center justify-center"
        >
          <ChevronLeft className="size-5 text-foreground" strokeWidth={2} />
        </button>
      ) : (
        <div className="size-11" />
      )}
      <span className="text-sm font-semibold">Nueva cita</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="flex size-11 items-center justify-center"
      >
        <X className="size-5 text-muted-foreground" strokeWidth={1.75} />
      </button>
    </div>
  )
}

/**
 * `design/NuevaCitaDesktopPaso1.dc.html:29-40`. El boton de 38x38 reutiliza
 * la receta ya usada en `page-shell.tsx:235-243` (`variant="outline"
 * size="icon"`, NO `size="action"`: esa lleva `px-[18px]` y no es cuadrada).
 */
function DesktopHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-border bg-sidebar px-7">
      <div className="flex items-center gap-3">
        <SalonMark className="size-6 text-primary" />
        <span className="font-heading text-xl font-semibold tracking-display">Nueva cita</span>
      </div>
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={onClose} className="text-[13px] leading-tight text-muted-foreground">
          Cancelar
        </button>
        <Button variant="outline" size="icon" className="size-[38px] shrink-0" onClick={onClose} aria-label="Cerrar">
          <X className="size-[18px]" />
        </Button>
      </div>
    </div>
  )
}
