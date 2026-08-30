import type { CSSProperties, ReactNode } from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

export interface DataTableColumn<T> {
  key: string
  header: string // "" para la columna del chevron
  width: string // "minmax(0,1.5fr)" | "170px" | "20px"
  align?: "start" | "end" // por defecto start; "end" para Visitas e Importe
  cell: (row: T) => ReactNode
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  variant?: "screen" | "nested" // D4, por defecto "screen"
  rowHeight?: number // 68 en las listas, 58 en el historial
  gap?: number // 16 en las listas, 12 en el historial
  href?: (row: T) => string // si viene, la fila entera es un <Link>
  rowClassName?: (row: T) => string | undefined // fila inactiva (D9)
  footer?: ReactNode // el footer de 48px del historial
  caption: string // aria-label de la tabla
}

/**
 * Primitivo de tabla generico sobre CSS grid (D2). No usa `<table>` porque los
 * artboards mezclan columnas `fr`/`px` en `grid-template-columns`, y aplicar
 * `display: grid` sobre `<tr>` borra los roles ARIA implicitos de la tabla en
 * varios navegadores (D3). Los roles se escriben a mano: `table`, `row`,
 * `columnheader`, `cell`.
 *
 * Excepcion deliberada: cuando `href` viene informado, la fila se renderiza
 * como `<Link>` de Next SIN `role="row"` explicito. Un `role` explicito
 * sustituye el rol implicito del elemento: si se forzara `role="row"` sobre el
 * `<a>`, `getByRole("link")` dejaria de encontrarlo (D5 exige que la fila sea
 * "alcanzable por teclado" como enlace). Las filas sin `href` si llevan
 * `role="row"`.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  variant = "screen",
  rowHeight = 68,
  gap = 16,
  href,
  rowClassName,
  footer,
  caption,
}: DataTableProps<T>) {
  const isNested = variant === "nested"
  const gridTemplateColumns = columns.map((column) => column.width).join(" ")

  const headerStyle: CSSProperties = { gridTemplateColumns, columnGap: gap }
  const headerClassName = cn(
    "grid items-center px-[18px]",
    isNested
      ? "h-10 rounded-t-xl border-b border-hairline bg-muted-subtle"
      : "h-11 bg-sidebar"
  )
  const headerCellClassName = cn(
    "font-bold tracking-[0.08em] text-muted-foreground-2 uppercase",
    isNested ? "text-[10px] leading-none" : "text-[11px] leading-none"
  )

  const rowStyle: CSSProperties = { gridTemplateColumns, columnGap: gap, height: rowHeight }

  function renderCells(row: T) {
    return columns.map((column) => (
      <span
        key={column.key}
        role="cell"
        className={column.align === "end" ? "text-right" : undefined}
      >
        {column.cell(row)}
      </span>
    ))
  }

  const body: ReactNode[] = []
  rows.forEach((row, index) => {
    const key = rowKey(row)
    const isLastRow = index === rows.length - 1
    const className = cn(
      "grid items-center px-[18px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
      rowClassName?.(row)
    )

    if (href) {
      body.push(
        <Link key={key} href={href(row)} style={rowStyle} className={className}>
          {renderCells(row)}
        </Link>
      )
    } else {
      body.push(
        <div key={key} role="row" style={rowStyle} className={className}>
          {renderCells(row)}
        </div>
      )
    }

    // El separador no aparece detras de la ultima fila (EquipoDesktop:189):
    // la tabla termina en la fila con la esquina redondeada del contenedor.
    // Salvo que la tabla lleve `footer` (el historial de citas,
    // DetalleClienteDesktop:218-224): ahi el artboard SI dibuja un separador
    // entre la ultima fila y el footer, porque el footer es un bloque
    // distinto de la rejilla de filas, no la ultima fila.
    if (!isLastRow || footer) {
      body.push(
        <div key={`${key}-sep`} data-testid="data-table-separator" className="h-px bg-hairline" />
      )
    }
  })

  return (
    <div
      role="table"
      aria-label={caption}
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div role="row" style={headerStyle} className={headerClassName}>
        {columns.map((column) => (
          <span
            key={column.key}
            role="columnheader"
            className={cn(headerCellClassName, column.align === "end" && "text-right")}
          >
            {column.header}
          </span>
        ))}
      </div>
      {body}
      {footer}
    </div>
  )
}
