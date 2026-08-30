import { cn } from "@/lib/utils"

export type EmployeeColorShape = "dot-sm" | "dot" | "square-sm" | "square"

interface EmployeeColorProps {
  colorHex: string | null
  shape: EmployeeColorShape
  showHex?: boolean
  emptyLabel?: string
  className?: string
}

// Diametro/lado de cada forma (D14): punto 10px (detalle movil), punto 12px
// (tabla de escritorio), cuadrado 28px (detalle de escritorio), cuadrado
// 32px (formulario). Los cuadrados llevan el borde `rgba(42,35,32,.12)` que
// dibujan `DetalleEmpleadoDesktop.dc.html:139` y `FormularioEmpleado.dc.html:133`
// -- ninguno de los tokens de `globals.css` es ese valor exacto.
const SHAPE_CLASSNAMES: Record<EmployeeColorShape, string> = {
  "dot-sm": "size-[10px] rounded-full",
  dot: "size-3 rounded-full",
  "square-sm": "size-7 rounded-lg border border-[rgba(42,35,32,0.12)]",
  square: "size-8 rounded-lg border border-[rgba(42,35,32,0.12)]",
}

// El tamano del hex sigue a la forma que acompana (D14): 13px en las piezas
// compactas (punto de detalle movil, cuadrado de detalle de escritorio),
// 12px en las densas (punto de la tabla, cuadrado del formulario). El
// `leading-*` va escrito DESPUES del `text-[Npx]` a proposito: `tailwind-merge`
// descarta en silencio uno escrito antes (AGENTS.md:53-61).
const HEX_TEXT_CLASSNAMES: Record<EmployeeColorShape, string> = {
  "dot-sm": "text-[13px] leading-tight",
  dot: "text-[12px] leading-tight",
  "square-sm": "text-[13px] leading-tight",
  square: "text-[12px] leading-tight",
}

/**
 * "Color identificativo" del empleado, en sus cuatro representaciones (D14).
 * Compartido a proposito por T5 (tabla de Equipo), T7 (formulario) y T9
 * (ficha de empleado) para que ninguno tenga que tocar el fichero de los
 * otros dos.
 *
 * `colorHex === null`: con `emptyLabel` (la tabla de escritorio) se pinta
 * SOLO ese texto, sin forma ni hex -- `EquipoDesktop.dc.html:201` pinta
 * "Por defecto" sin punto. Sin `emptyLabel`, se pinta la forma con el fondo
 * `--muted` de reserva y sin hex, porque no hay hex que mostrar.
 */
export function EmployeeColor({
  colorHex,
  shape,
  showHex = false,
  emptyLabel,
  className,
}: EmployeeColorProps) {
  if (!colorHex && emptyLabel) {
    return (
      <span
        data-testid="employee-color-empty"
        className={cn("text-text-subtle", HEX_TEXT_CLASSNAMES[shape], className)}
      >
        {emptyLabel}
      </span>
    )
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        data-testid="employee-color-swatch"
        aria-hidden
        className={cn(SHAPE_CLASSNAMES[shape], "shrink-0")}
        style={{ backgroundColor: colorHex ?? "var(--muted)" }}
      />
      {showHex && colorHex && (
        <span
          data-testid="employee-color-hex"
          className={cn("tabular-nums text-muted-foreground", HEX_TEXT_CLASSNAMES[shape])}
        >
          {colorHex}
        </span>
      )}
    </span>
  )
}
