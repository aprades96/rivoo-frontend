"use client"

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
}

/**
 * Control segmentado (Dia / Semana). Lo que se mueve es la pastilla, no el
 * fondo de cada opcion: un unico elemento absoluto que se traslada con
 * --motion-base. Repintar el fondo de cada opcion se lee como un parpadeo.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  )

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
        "relative inline-grid rounded-full border bg-muted p-[3px]",
        className
      )}
    >
      {/* Pastilla: un solo elemento que se desplaza */}
      <div
        aria-hidden
        className="absolute top-[3px] bottom-[3px] left-[3px] rounded-full bg-card shadow-sm ease-in-out"
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
              "relative z-10 cursor-pointer rounded-full px-4 py-1.5 text-center text-sm font-medium whitespace-nowrap transition-colors duration-[var(--motion-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              selected ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
