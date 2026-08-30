"use client"

import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"

interface SegmentedControlOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  "aria-label"?: string
  /**
   * `"square"` (por defecto) es el control ORIGINAL, sin cambios: radio 999,
   * `px-4`, `text-sm font-medium` uniforme y carril `--muted`. Es lo que pide
   * `CalendarioDesktop.dc.html:89-91` para el mismo control -- un cambio
   * global lo alejaria de su propio artboard.
   *
   * `"pill"` es el que dibujan `Equipo.dc.html:27-29` y
   * `EquipoDesktop.dc.html:29-31` (D7): opcion activa 13px/600, inactiva
   * 13px/500 en `--muted-foreground`, `px-[18px]`, carril `--segmented-track`
   * y alto de opcion 32px en movil / 30px en escritorio.
   */
  variant?: "square" | "pill"
}

const DESKTOP_QUERY = "(min-width: 1024px)"

/**
 * Control segmentado (Dia / Semana en el calendario, Empleados / Servicios en
 * Equipo). Lo que se mueve es la pastilla, no el fondo de cada opcion: un
 * unico elemento absoluto que se traslada con --motion-base. Repintar el
 * fondo de cada opcion se lee como un parpadeo.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
  variant = "square",
}: SegmentedControlProps<T>) {
  // Se llama siempre, aunque `variant="square"` no lo use: los hooks no
  // pueden ser condicionales, y el coste de suscribirse a `matchMedia` sin
  // leerlo es nulo.
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const isPill = variant === "pill"
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  )
  const pillOptionHeight = isDesktop ? "h-[30px]" : "h-8"

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      // Grid con columnas 1fr en vez de flex-1: en un flex, min-width:auto
      // impide que la opcion mas larga se encoja, las mitades salen desiguales
      // y la pastilla (que sí vale 1/n exacto) no cuadra con ninguna. Con 1fr
      // todas las columnas miden lo que la mas ancha, y la pastilla encaja.
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
      className={cn(
        "relative inline-grid rounded-full border p-[3px]",
        isPill ? "bg-segmented-track" : "bg-muted",
        className
      )}
    >
      {/* Pastilla: un solo elemento que se desplaza */}
      <div
        aria-hidden
        className={cn(
          "absolute top-[3px] bottom-[3px] left-[3px] rounded-full bg-card shadow-sm ease-in-out",
          isPill && pillOptionHeight
        )}
        style={{
          width: `calc((100% - 6px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
          transitionProperty: "transform",
          transitionDuration: "var(--motion-base)",
        }}
      />
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 cursor-pointer rounded-full text-center whitespace-nowrap transition-colors duration-[var(--motion-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              isPill
                ? cn(
                    "inline-flex items-center justify-center px-[18px] text-[13px] leading-tight",
                    pillOptionHeight,
                    selected ? "font-semibold text-foreground" : "font-medium text-muted-foreground"
                  )
                : cn(
                    "px-4 py-1.5 text-sm font-medium",
                    selected ? "text-foreground" : "text-muted-foreground"
                  )
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
