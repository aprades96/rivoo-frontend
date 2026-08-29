"use client"

import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"

/** El alto del recuadro en el artboard: 44px, el de medio slot ya con canalon. */
const DEFAULT_HEIGHT_PX = 44

/** Mismo sangrado que la cita en movil (`design/Calendario.dc.html:112`). */
const INSET_PX = 4

interface FreeSlotHintProps {
  top: number
  /** Lo devuelve `nextFreeSlot`; por defecto, los 44px del artboard. */
  height?: number
  /** Se dispara al pulsar: abre el alta de cita a esa hora. */
  onTap?: () => void
  label?: string
  className?: string
  style?: CSSProperties
}

/**
 * El recuadro discontinuo "Libre · toca para crear"
 * (`design/Calendario.dc.html:112-114`). SOLO MOVIL: el artboard de escritorio
 * no lo dibuja -- alli el hueco se crea pulsando la propia rejilla -- asi que
 * no tiene variante y su texto habla de tocar, no de hacer clic.
 */
export function FreeSlotHint({
  top,
  height = DEFAULT_HEIGHT_PX,
  onTap,
  label = "Libre · toca para crear",
  className,
  style,
}: FreeSlotHintProps) {
  return (
    <button
      type="button"
      data-testid="free-slot-hint"
      onClick={onTap}
      className={cn(
        "absolute flex items-center overflow-hidden rounded-lg border border-dashed border-border-dashed bg-muted px-2.5 py-1.5 text-left",
        className
      )}
      style={{ top, height, left: INSET_PX, right: INSET_PX, ...style }}
    >
      {/* `leading-tight` = el `normal` del artboard (`design/Calendario.dc.html:113`):
          la preflight de Tailwind impone 1.5 y engorda la linea de 13,75 a 16,5px. */}
      <span className="truncate text-[11px] leading-tight text-muted-foreground-2">{label}</span>
    </button>
  )
}
