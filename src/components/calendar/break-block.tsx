import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"

export type BreakBlockVariant = "mobile" | "desktop"

interface BreakBlockProps {
  /** "13:00 - 14:00", tal y como lo devuelve `breakPosition`. */
  label: string
  top: number
  height: number
  /** El artboard escribe "Almuerzo"; el titulo se deja abierto por si el descanso no lo es. */
  title?: string
  variant?: BreakBlockVariant
  className?: string
  style?: CSSProperties
}

/** Mismo sangrado que la cita: 6px en escritorio, 4px en movil. */
const INSET_PX: Record<BreakBlockVariant, number> = {
  desktop: 6,
  mobile: 4,
}

/**
 * El rayado de 135 grados del artboard
 * (`design/CalendarioDesktop.dc.html:177`, `design/Calendario.dc.html:118`).
 * Sus dos colores son tokens existentes: #F5EEE6 = `--muted` y #EFE6DA =
 * `--hairline`. Va en `style` porque Tailwind no tiene utilidad para un
 * `repeating-linear-gradient` con paradas.
 */
const STRIPES =
  "repeating-linear-gradient(135deg, var(--muted), var(--muted) 6px, var(--hairline) 6px, var(--hairline) 12px)"

/**
 * El tramo de descanso del empleado: la caja rayada "Almuerzo" de la columna.
 * A diferencia de la cita NO lleva borde izquierdo de color -- el borde es
 * uniforme `--hairline-strong` (#E2D6C6) -- y no es pulsable.
 */
export function BreakBlock({
  label,
  top,
  height,
  title = "Almuerzo",
  variant = "mobile",
  className,
  style,
}: BreakBlockProps) {
  const inset = INSET_PX[variant]

  return (
    <div
      data-testid="break-block"
      className={cn(
        "absolute flex flex-col gap-0.5 overflow-hidden rounded-lg border border-hairline-strong px-2.5 py-2",
        className
      )}
      style={{
        top,
        height,
        left: inset,
        right: inset,
        backgroundImage: STRIPES,
        ...style,
      }}
    >
      <span className="truncate text-[12px] font-semibold text-muted-foreground">{title}</span>
      <span className="truncate text-[11px] tabular-nums text-muted-foreground-2">{label}</span>
    </div>
  )
}
