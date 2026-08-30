"use client"

import { Scissors } from "lucide-react"
import { StatusBadge } from "./status-badge"
import { useEmployees } from "@/hooks/use-staff"
import { useMediaQuery } from "@/hooks/use-media-query"
import { employeePaletteIndex, employeeSolidColor } from "@/lib/utils/avatar"
import { formatTime, formatTimeRange, formatDurationTight } from "@/lib/utils/dates"
import { formatCurrency } from "@/lib/utils/format"
import type { Appointment } from "@/types/appointment"

// Tailwind's `lg:` breakpoint (1024px), same threshold as
// `wizard/service-step.tsx:24`. The mobile and desktop rows genuinely differ
// in markup (icon + price + third line vs "servicio · empleado" with its own
// price column and no third line), so per the width-difference rule this
// is decided ONCE in JS with `useMediaQuery`, never with `hidden lg:...`
// class pairs -- jsdom does not apply CSS, so both would stay in the DOM
// (see `appointment-card.test.tsx`).
const DESKTOP_QUERY = "(min-width: 1024px)"

interface AppointmentCardProps {
  appointment: Appointment
  onTap?: (appointment: Appointment) => void
}

/**
 * Fila de cita de la pantalla "Hoy" (D34): dos maquetaciones por ancho,
 * `design/Main.dc.html:117-136` (movil) y `design/HoyDesktop.dc.html:116-130`
 * (escritorio).
 *
 * Este componente tiene DOS consumidores -- `today/page.tsx` (T8) y
 * `src/app/dev/preview/page.tsx:227`, que lo invoca con SOLO `appointment` --
 * asi que no se le puede anadir ningun prop obligatorio nuevo sin romper la
 * compilacion de ese segundo sitio. Por eso el color de empleado y el ancho
 * se resuelven POR DENTRO en vez de recibirse como props:
 *   - color: `useEmployees()` + `employeePaletteIndex`/`employeeSolidColor`,
 *     el mismo patron que `appointment-detail-sheet.tsx:51-60`.
 *   - ancho: su propio `useMediaQuery(DESKTOP_QUERY)`.
 * React Query comparte la peticion de empleados por `queryKey`, asi que N
 * tarjetas montadas a la vez no disparan N peticiones.
 */
export function AppointmentCard({ appointment, onTap }: AppointmentCardProps) {
  const {
    clientName,
    employeeId,
    employeeName,
    serviceName,
    servicePrice,
    serviceDurationMinutes,
    startTime,
    endTime,
    status,
  } = appointment

  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const { data: employeesData } = useEmployees()
  const employees = employeesData?.content ?? []
  const employee = employees.find((candidate) => candidate.id === employeeId) ?? null
  // D11/Hallazgo 2 (identico a `appointment-detail-sheet.tsx:53-60`):
  // posicion entre empleados ACTIVOS. `employeePaletteIndex` devuelve -1
  // cuando el empleado no esta en esa lista (ausente o inactivo); pasar ese
  // -1 tal cual a `employeeSolidColor` caeria en la ULTIMA entrada de la
  // paleta en vez de la primera, asi que se normaliza a 0 aqui.
  const rawPaletteIndex = employeePaletteIndex(employees, employeeId)
  const paletteIndex = rawPaletteIndex >= 0 ? rawPaletteIndex : 0
  const barColor = employeeSolidColor(employee?.colorHex ?? null, paletteIndex)

  const duration = formatDurationTight(serviceDurationMinutes)
  const price = formatCurrency(servicePrice)

  const bar = (
    <div
      data-testid="appointment-card-bar"
      className="w-[2px] shrink-0 self-stretch rounded-full"
      style={{ backgroundColor: barColor }}
    />
  )

  if (isDesktop) {
    return (
      <div
        data-testid="appointment-card"
        className="flex cursor-pointer items-center gap-[14px] rounded-lg border border-border bg-card px-[14px] py-3 transition-colors hover:bg-muted/50 active:bg-muted"
        onClick={() => onTap?.(appointment)}
      >
        <div className="flex w-[60px] shrink-0 flex-col items-center">
          <span className="text-[21px] leading-[1.1] font-semibold tabular-nums">
            {formatTime(startTime)}
          </span>
          <span className="text-[10px] leading-tight text-muted-foreground">{duration}</span>
        </div>

        {bar}

        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="truncate text-sm leading-tight font-semibold">{clientName}</span>
          <span className="truncate text-xs leading-tight text-muted-foreground">
            {serviceName} · {employeeName}
          </span>
        </div>

        <span className="shrink-0 text-sm leading-tight font-semibold tabular-nums">{price}</span>

        <StatusBadge
          status={status}
          className="h-auto shrink-0 rounded-full px-[9px] py-[3px] text-[10px] leading-tight font-semibold"
        />
      </div>
    )
  }

  return (
    <div
      data-testid="appointment-card"
      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50 active:bg-muted"
      onClick={() => onTap?.(appointment)}
    >
      <div className="flex w-14 shrink-0 flex-col items-center">
        <span className="text-[22px] leading-[1.1] font-semibold tabular-nums">
          {formatTime(startTime)}
        </span>
        <span className="text-[10px] leading-tight text-muted-foreground">{duration}</span>
      </div>

      {bar}

      <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-sm leading-tight font-semibold">{clientName}</span>
          <StatusBadge
            status={status}
            className="h-auto shrink-0 rounded-full px-[8px] py-[3px] text-[10px] leading-tight font-semibold"
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs leading-tight text-muted-foreground">
          <Scissors className="size-3 shrink-0" strokeWidth={1.75} />
          {/* Servicio, separador y precio son TRES nodos hermanos en el
              artboard (design/Main.dc.html:130-132), espaciados por el `gap`
              del contenedor. El `truncate` recorta SOLO el nombre del
              servicio -- si comparte nodo con el precio, un nombre largo se
              come el precio entero, y el precio no es un adorno. */}
          <span className="min-w-0 truncate">{serviceName}</span>
          <span className="shrink-0">·</span>
          <span className="shrink-0 tabular-nums">{price}</span>
        </div>
        <span className="truncate text-xs leading-tight text-muted-foreground">
          {employeeName} · {formatTimeRange(startTime, endTime)}
        </span>
      </div>
    </div>
  )
}
