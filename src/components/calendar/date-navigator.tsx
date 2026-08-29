"use client"

import { format, isToday } from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { capitalizeFirst } from "@/lib/utils/format"

// Etiquetas accesibles de los dos botones de icono. Son constantes porque las
// dos presentaciones del navegador tienen que anunciarse igual: en escritorio
// el cluster convive con el boton "Hoy", y sin `aria-label` un lector de
// pantalla leia tres controles indistinguibles.
const PREV_LABEL = "Dia anterior"
const NEXT_LABEL = "Dia siguiente"

// "Martes, 27 de agosto" (Calendario.dc.html:42). date-fns devuelve el dia de
// la semana en minuscula en castellano, de ahi `capitalizeFirst`.
function formatNavigatorDate(date: Date): string {
  return capitalizeFirst(format(date, "EEEE, d 'de' MMMM", { locale: es }))
}

interface StepButtonProps {
  direction: "prev" | "next"
  onClick: () => void
  className?: string
}

// Unica definicion del paso de dia: las dos formas solo cambian de talla
// (36px en movil, 34px en escritorio).
function StepButton({ direction, onClick, className }: StepButtonProps) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={direction === "prev" ? PREV_LABEL : NEXT_LABEL}
      onClick={onClick}
      className={cn("shrink-0", className)}
    >
      <Icon className="size-4" />
    </Button>
  )
}

interface DateNavigatorRowProps {
  date: Date
  onPrev: () => void
  onNext: () => void
}

/**
 * Fila de navegacion de movil (Calendario.dc.html:37-48): paso atras, la fecha
 * del dia visible y paso adelante.
 *
 * `Hoy` es un INDICADOR PASIVO, no un control: solo aparece cuando el dia
 * visible es hoy y no es pulsable. El unico "Hoy" pulsable de la pantalla es
 * el del cluster de escritorio.
 */
export function DateNavigatorRow({ date, onPrev, onNext }: DateNavigatorRowProps) {
  return (
    <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
      <StepButton direction="prev" onClick={onPrev} className="size-9" />

      <div className="flex flex-col items-center gap-px">
        <span className="font-heading text-[19px] leading-[1.1] font-semibold tracking-display">
          {formatNavigatorDate(date)}
        </span>
        {isToday(date) && (
          <span className="text-[11px] font-semibold tracking-[0.06em] text-primary uppercase">
            Hoy
          </span>
        )}
      </div>

      <StepButton direction="next" onClick={onNext} className="size-9" />
    </div>
  )
}

interface DateNavigatorClusterProps {
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

/**
 * Cluster de escritorio (CalendarioDesktop.dc.html:77-85): va pegado al titulo,
 * que ya es la fecha del dia visible, asi que el cluster no la repite. Aqui
 * "Hoy" si es un control.
 */
export function DateNavigatorCluster({
  onPrev,
  onNext,
  onToday,
}: DateNavigatorClusterProps) {
  return (
    <div className="flex items-center gap-1.5">
      <StepButton direction="prev" onClick={onPrev} className="size-[34px]" />
      <Button
        variant="outline"
        onClick={onToday}
        className="h-[34px] px-3.5 text-[13px] font-semibold"
      >
        Hoy
      </Button>
      <StepButton direction="next" onClick={onNext} className="size-[34px]" />
    </div>
  )
}

/**
 * @deprecated Puente temporal para `src/app/(app)/calendar/page.tsx`, que
 * todavia importa el navegador anterior a esta calibracion. La tarea que
 * reescribe esa pagina consume `DateNavigatorRow` y `DateNavigatorCluster`
 * directamente y borra este export.
 */
export function DateNavigator(props: {
  date: Date
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}) {
  return (
    <DateNavigatorCluster
      onPrev={props.onPrev}
      onNext={props.onNext}
      onToday={props.onToday}
    />
  )
}
