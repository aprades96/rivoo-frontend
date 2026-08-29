import type { ReactNode } from "react"
import { generateTimeLabels, SLOT_HEIGHT_PX } from "@/lib/utils/calendar"
import { cn } from "@/lib/utils"

const labels = generateTimeLabels()

export type CalendarGridVariant = "mobile" | "desktop"

/**
 * Ancho del canal de horas y tipografia de su etiqueta: 64px/11px en
 * escritorio (`design/CalendarioDesktop.dc.html:132-148`), 46px/10px en movil
 * (`design/Calendario.dc.html:66-81`). El `top` de la etiqueta tambien varia
 * (-8px / -7px): el artboard la centra sobre la linea de la hora en punto, no
 * sobre el hueco de la fila, y el desplazamiento depende del tamano de fuente.
 */
const CHANNEL_CONFIG: Record<
  CalendarGridVariant,
  { width: number; fontSize: number; labelTop: number }
> = {
  desktop: { width: 64, fontSize: 11, labelTop: -8 },
  mobile: { width: 46, fontSize: 10, labelTop: -7 },
}

/**
 * Modo estrecho: hay un panel de detalle acoplado a la derecha
 * (`design/DetalleCitaDesktop.dc.html:113,141`) y el canal se estrecha de
 * 64px a 58px para hacerle sitio. Solo tiene efecto en `variant="desktop"`
 * -- en movil `narrow` se ignora (D17, §1.3.3).
 */
const NARROW_DESKTOP_WIDTH = 58

/**
 * Borde superior de una fila de media hora. Definicion UNICA que comparten
 * `TimeGrid` (canal de horas) y `GridRows` (fondo de las columnas de citas):
 * las dos tienen que alinear sus horizontales pixel a pixel, asi que no puede
 * haber una copia en cada fichero.
 *
 * `.slot-hour` (la hora en punto) pinta un borde mas oscuro que `.slot` (la
 * media hora) -- clases identicas en `CalendarioDesktop.dc.html:20-21` y
 * `Calendario.dc.html:18-19`. Las dos son solidas: nada de `border-dashed`,
 * que es lo que pintaba el codigo antes de este cambio.
 */
function rowBorderClassName(isHour: boolean): string {
  return cn("border-t", isHour ? "border-hairline-strong" : "border-hairline")
}

export interface TimeGridProps {
  variant: CalendarGridVariant
  /** Ver `NARROW_DESKTOP_WIDTH`. Contrato D17: opcional, por defecto `false`. */
  narrow?: boolean
}

/**
 * El canal de horas a la izquierda de la rejilla. Una sola columna, comun a
 * las citas de todos los empleados en escritorio (`CalendarioDesktop.dc.html`)
 * y a la columna unica de movil (`Calendario.dc.html`).
 */
export function TimeGrid({ variant, narrow = false }: TimeGridProps) {
  const { fontSize, labelTop } = CHANNEL_CONFIG[variant]
  const width = variant === "desktop" && narrow ? NARROW_DESKTOP_WIDTH : CHANNEL_CONFIG[variant].width

  return (
    <div className="shrink-0 select-none" style={{ width }}>
      {labels.map((label, i) => {
        const isHour = i % 2 === 0
        return (
          <div
            key={label}
            className={cn("relative", rowBorderClassName(isHour))}
            style={{ height: SLOT_HEIGHT_PX }}
          >
            {isHour && (
              <span
                className="absolute text-muted-foreground-2"
                style={{ fontSize, top: labelTop }}
              >
                {label}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export interface GridRowsProps {
  variant: CalendarGridVariant
  children?: ReactNode
}

/**
 * El fondo de una columna de citas: la MISMA rejilla de lineas que
 * `TimeGrid` dibuja en el canal, para que canal y columnas alineen sus
 * horizontales pixel a pixel en vez de que cada fichero derive su propia
 * copia de las alturas y los colores.
 *
 * `day-view.tsx` monta los bloques de cita como hijos, en
 * `position: absolute`, encima de este fondo -- por eso el contenedor es
 * `position: relative` y mide el alto exacto de la rejilla
 * (`labels.length * SLOT_HEIGHT_PX`), no `height: 100%`.
 *
 * Solo la version de escritorio lleva `border-left`
 * (`CalendarioDesktop.dc.html:152`); la movil no
 * (`Calendario.dc.html:83`) -- la unica diferencia estructural entre las dos.
 */
export function GridRows({ variant, children }: GridRowsProps) {
  return (
    <div
      className={cn("relative", variant === "desktop" && "border-l border-hairline")}
      style={{ height: SLOT_HEIGHT_PX * labels.length }}
    >
      {labels.map((label, i) => (
        <div
          key={label}
          className={rowBorderClassName(i % 2 === 0)}
          style={{ height: SLOT_HEIGHT_PX }}
        />
      ))}
      {children}
    </div>
  )
}
