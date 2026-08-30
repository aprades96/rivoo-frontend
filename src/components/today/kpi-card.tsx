// Promocion de `StatCard`, hoy privado de `(app)/today/page.tsx:273-293` y con
// hexes crudos (`border-yellow-300`/`bg-yellow-50`). Este componente cubre las
// DOS variantes medidas en los artboards -- con icono (movil, `Main.dc.html:44-64`)
// y sin icono (escritorio, `HoyDesktop.dc.html:92-108`) -- mas el tono de alerta
// comun a ambas ("Pendientes" / "Pendientes de confirmar"). La pagina (T8) decide
// la variante segun el breakpoint; este componente no lee `useMediaQuery`.
import * as React from "react"

import { cn } from "@/lib/utils"

export type KpiCardVariant = "mobile" | "desktop"
export type KpiCardTone = "default" | "warning"

export interface KpiCardProps {
  label: string
  value: string | number
  /**
   * Solo se pinta en la variante "mobile" (`Main.dc.html:46`): el artboard de
   * escritorio no lleva icono (`HoyDesktop.dc.html:94`). El tamano del icono
   * (14px) lo impone este componente sobre cualquier hijo `<svg>`, para que
   * el llamante no tenga que repetir `className="size-3.5"` en cada KPI.
   */
  icon?: React.ReactNode
  tone?: KpiCardTone
  variant: KpiCardVariant
  className?: string
}

export function KpiCard({ label, value, icon, tone = "default", variant, className }: KpiCardProps) {
  const isWarning = tone === "warning"
  const isMobile = variant === "mobile"

  return (
    <div
      data-testid="kpi-card"
      className={cn(
        "flex flex-col gap-0.5 border bg-card",
        isMobile ? "rounded-lg p-3" : "rounded-[10px] px-4 py-3.5",
        isWarning ? "border-warning-border bg-status-pending-bg" : "border-border",
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        {isMobile && icon ? (
          <span
            data-testid="kpi-card-icon"
            className={cn(
              "flex shrink-0 items-center [&>svg]:size-3.5",
              isWarning ? "text-status-pending-text" : "text-muted-foreground"
            )}
          >
            {icon}
          </span>
        ) : null}
        <span
          className={cn(
            isMobile ? "text-[11px]" : "text-[12px]",
            "leading-tight",
            isWarning ? "text-status-pending-text" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
      </div>
      <span
        data-testid="kpi-card-value"
        className={cn(
          "font-heading text-[30px] leading-[1.05] font-semibold tracking-display tabular-nums",
          isWarning ? "text-status-pending-text" : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  )
}
