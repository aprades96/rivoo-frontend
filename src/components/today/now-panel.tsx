// Tarjeta "Ahora mismo" (`design/Main.dc.html:67-112`, `design/HoyDesktop.dc.html:188-228`),
// T5. Consume `NowRow[]` YA DERIVADO por `getNowRows` (`today-facts.ts`) -- este
// componente no recalcula nada, solo pinta. La pagina (T8) decide el ancho
// (D15) y se lo pasa por `variant`, igual que `kpi-card.tsx`; este componente
// no lee `useMediaQuery`.
import { Fragment } from "react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { employeePaletteIndex, employeeSolidColor } from "@/lib/utils/avatar"
import type { Employee } from "@/types/employee"
import type { NowRow } from "./today-facts"

export type NowPanelVariant = "mobile" | "desktop"

export interface NowPanelProps {
  rows: NowRow[]
  /**
   * Lista COMPLETA de empleados (no solo los de `rows`) -- `employeePaletteIndex`
   * necesita el orden original para que el punto de color coincida con el del
   * resto de la app (misma invariante que `appointment-detail-sheet.tsx:59-60`).
   * Se recibe por prop en vez de leer `useEmployees()` aqui dentro: la pagina ya
   * tiene la lista para llamar a `getNowRows`, y pedirla otra vez duplicaria la
   * peticion y complicaria el test sin ganar nada.
   */
  employees: Employee[]
  /** Instante "ahora" -- solo para el reloj del rotulo movil (D15), inyectado
   * para que el test sea determinista (mismo criterio que `getNowRows`). */
  now: Date
  variant: NowPanelVariant
}

function employeeDisplayName(employee: Employee): string {
  return `${employee.firstName} ${employee.lastName}`
}

// D12/`appointment-detail-sheet.tsx:59-60`: `employeePaletteIndex` devuelve -1
// cuando el empleado no esta activo o no aparece en la lista -- con un negativo
// tal cual el color cae en el ULTIMO de la paleta, no en el primero.
function dotColor(employee: Employee, employees: Employee[]): string {
  const index = employeePaletteIndex(employees, employee.id)
  return employeeSolidColor(employee.colorHex, index >= 0 ? index : 0)
}

// D16: el servicio solo aparece en la segunda linea del "busy" en movil -- en
// escritorio ya sale en la fila de la cita, en la columna de al lado. D20: sin
// "next", la fila "free" no dice nada en la segunda linea -- se omite el campo
// entero en vez de inventar una frase.
function secondLine(row: NowRow, isMobile: boolean): string | null {
  if (row.kind === "busy") {
    return isMobile
      ? `${row.clientName} · ${row.serviceName} · hasta las ${row.until}`
      : `${row.clientName} · hasta las ${row.until}`
  }
  if (row.kind === "free") {
    return row.next ? `Siguiente: ${row.next.time} · ${row.next.clientName}` : null
  }
  return "Hoy no trabaja"
}

interface NowRowViewProps {
  row: NowRow
  employees: Employee[]
  isMobile: boolean
}

function NowRowView({ row, employees, isMobile }: NowRowViewProps) {
  const isOff = row.kind === "off"
  const line = secondLine(row, isMobile)
  // D18: el atenuado va con `opacity` sobre la FILA ENTERA (mismo mecanismo que
  // `NuevaCitaPaso1.dc.html:88` -- 0.55 movil -- y `NuevaCitaDesktopPaso1.dc.html:112`
  // -- 0.5 escritorio), conservando el color real del empleado en el punto. NO
  // se recolorea el punto con `--color-avatar-muted`: ese token es fondo de
  // AVATAR (#F0EAE3) y un punto de 8px de ese color sobre el #FAEFE9 de la
  // tarjeta desaparece.
  const badgePadding = isMobile ? "px-2 py-0.5" : "px-[9px] py-[3px]"

  return (
    <div
      data-testid="now-row"
      data-kind={row.kind}
      className={cn("flex items-start gap-[10px]", isOff && (isMobile ? "opacity-[0.55]" : "opacity-[0.5]"))}
    >
      <div
        data-testid="now-row-dot"
        className="mt-[5px] size-2 shrink-0 rounded-full"
        style={{ backgroundColor: dotColor(row.employee, employees) }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px] leading-tight font-semibold">
            {employeeDisplayName(row.employee)}
          </span>
          {/* D "Los dos badges van a mano": ninguno de los dos es `statusConfig`.
              El de "En curso" reutiliza los tokens de color que YA existen para
              el estado IN_PROGRESS (mismos valores medidos), sin importar el
              mapa de estados de citas -- son dominios distintos. */}
          {row.kind === "busy" && (
            <span
              className={cn(
                "shrink-0 rounded-full text-[10px] leading-tight font-semibold whitespace-nowrap",
                "bg-(--color-status-in-progress-bg) text-(--color-status-in-progress-text)",
                badgePadding
              )}
            >
              En curso
            </span>
          )}
          {row.kind === "free" && (
            <span
              className={cn(
                "shrink-0 rounded-full border text-[10px] leading-tight font-semibold whitespace-nowrap",
                "border-(--color-border-dashed) text-muted-foreground",
                badgePadding
              )}
            >
              Libre {row.freeFor}
            </span>
          )}
        </div>
        {line !== null && (
          <span className="text-[12px] leading-tight tabular-nums text-muted-foreground">{line}</span>
        )}
      </div>
    </div>
  )
}

export function NowPanel({ rows, employees, now, variant }: NowPanelProps) {
  const isMobile = variant === "mobile"

  const list = (
    <div className={cn("flex flex-col", isMobile ? "gap-[10px]" : "gap-[14px]")}>
      {rows.map((row, index) => (
        <Fragment key={row.employee.id}>
          <NowRowView row={row} employees={employees} isMobile={isMobile} />
          {index < rows.length - 1 && (
            <div data-testid="now-panel-separator" className="h-px bg-(--color-surface-now-border)" />
          )}
        </Fragment>
      ))}
    </div>
  )

  // D15: el rotulo y la hora siguen cada artboard -- dentro de la tarjeta y con
  // la hora en movil (`Main.dc.html:68-71`), fuera y sin hora en escritorio
  // (`HoyDesktop.dc.html:188`, alli la hora ya sale en el subtitulo de la
  // topbar). Montaje condicional en JS, no CSS (jsdom no aplica CSS -- regla de
  // `page-shell.tsx:101-103`).
  if (isMobile) {
    return (
      <div
        data-testid="now-panel"
        className="flex flex-col gap-[10px] rounded-[10px] border border-(--color-surface-now-border) bg-(--color-surface-now) p-3"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] leading-tight font-semibold tracking-[0.06em] text-(--color-surface-now-text) uppercase">
            Ahora mismo
          </span>
          <span
            data-testid="now-panel-current-time"
            className="text-[11px] leading-tight font-semibold tabular-nums text-(--color-surface-now-text)"
          >
            {format(now, "HH:mm")}
          </span>
        </div>
        {list}
      </div>
    )
  }

  return (
    <div data-testid="now-panel" className="flex flex-col gap-[10px]">
      <span className="text-[13px] leading-tight font-semibold text-muted-foreground">Ahora mismo</span>
      <div
        data-testid="now-panel-card"
        className="flex flex-col gap-[14px] rounded-[10px] border border-(--color-surface-now-border) bg-(--color-surface-now) p-4"
      >
        {list}
      </div>
    </div>
  )
}
