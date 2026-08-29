"use client"

import type { CSSProperties } from "react"
import { differenceInMinutes, parseISO } from "date-fns"
import { calculateBlockPosition, SLOT_MINUTES } from "@/lib/utils/calendar"
import { cn } from "@/lib/utils"
import { formatTime } from "@/lib/utils/dates"
import { formatCurrency } from "@/lib/utils/format"
import type { Appointment, AppointmentStatus } from "@/types/appointment"

export type AppointmentBlockVariant = "mobile" | "desktop"

interface AppointmentBlockProps {
  appointment: Appointment
  /**
   * `desktop` = columna por empleado de 1440px, `mobile` = columna unica de
   * 390px. No son el mismo bloque con otro ancho: cambian el sangrado, el gap
   * y sobre todo el TEXTO (ver `timeLine`).
   */
  variant?: AppointmentBlockVariant
  /** Carril 0-based que devuelve `assignLanes`. */
  lane?: number
  /** Cuantos carriles tiene el grupo de solape; el bloque ocupa `1 / lanes`. */
  lanes?: number
  onTap?: (appointment: Appointment) => void
  className?: string
  /** Se aplica DESPUES de la geometria calculada: quien llama manda. */
  style?: CSSProperties
}

/**
 * El sangrado lateral del artboard: `left/right: 6px` en escritorio
 * (`design/CalendarioDesktop.dc.html:22`, clase `.blk`) y `4px` en movil
 * (`design/Calendario.dc.html:97`).
 */
const INSET_PX: Record<AppointmentBlockVariant, number> = {
  desktop: 6,
  mobile: 4,
}

/**
 * Paleta por estado. Los cuatro estados dibujados salen del artboard de
 * escritorio: confirmada `:162`, pendiente `:168-175`, completada `:193-196`,
 * cancelada `:225-228`.
 *
 * SUPUESTO (no esta en ningun artboard): `IN_PROGRESS` se pinta como
 * Confirmada -- es una cita viva -- y `NO_SHOW` como Cancelada, que es su
 * analogo semantico (la cita no se ha prestado), con su propia etiqueta "No
 * asistio" en la linea de la hora. Si el diseno los dibuja algun dia, esto es
 * lo primero que hay que revisar.
 */
const STATUS_STYLES: Record<AppointmentStatus, string> = {
  CONFIRMED: "border-border border-l-success bg-card",
  IN_PROGRESS: "border-border border-l-success bg-card",
  PENDING: "border-warning-border border-l-warning bg-warning-soft",
  COMPLETED: "border-border border-l-muted-foreground-2 bg-card opacity-70",
  CANCELLED: "border-destructive-border border-l-destructive bg-destructive-tint",
  NO_SHOW: "border-destructive-border border-l-destructive bg-destructive-tint",
}

/**
 * Estados terminales: el bloque se queda SIEMPRE en dos lineas (nombre + hora),
 * sin servicio ni precio, por alto que sea. No es una consecuencia del alto: el
 * artboard dibuja una Completada de 45 minutos y 68px -- donde caben tres
 * lineas de sobra -- con solo el nombre y "08:00 - 08:45 · Completada"
 * (`design/CalendarioDesktop.dc.html:193-196`). Lo mismo la Cancelada `:225`.
 */
const TERMINAL_SUFFIX: Partial<Record<AppointmentStatus, string>> = {
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No asistio",
}

/** Los estados que pintan el nombre y la hora en rojo (`:226-227`). */
const DESTRUCTIVE_TEXT: Partial<Record<AppointmentStatus, true>> = {
  CANCELLED: true,
  NO_SHOW: true,
}

/**
 * La geometria horizontal. Con un solo carril se copia el artboard tal cual
 * (`left`/`right` al sangrado); con varios, cada bloque toma `1 / lanes` del
 * ancho util para que dos citas solapadas se repartan la columna en vez de
 * taparse. Va en `style` y no en clases porque `lanes` es un dato de ejecucion:
 * Tailwind no puede generar un `calc()` con un valor que no existe al compilar.
 */
function laneGeometry(
  inset: number,
  lane: number,
  lanes: number
): Pick<CSSProperties, "left" | "right" | "width"> {
  const total = Math.max(1, Math.trunc(lanes))
  if (total === 1) return { left: inset, right: inset }

  const index = Math.min(Math.max(Math.trunc(lane), 0), total - 1)
  const usable = `(100% - ${inset * 2}px)`
  return {
    left: `calc(${inset}px + ${index} * ${usable} / ${total})`,
    width: `calc(${usable} / ${total})`,
  }
}

export function AppointmentBlock({
  appointment,
  variant = "mobile",
  lane = 0,
  lanes = 1,
  onTap,
  className,
  style,
}: AppointmentBlockProps) {
  const position = calculateBlockPosition(appointment.startTime, appointment.endTime)
  if (!position) return null

  const isDesktop = variant === "desktop"
  const inset = INSET_PX[variant]

  /**
   * La duracion PINTADA (fin - inicio), no `serviceDurationMinutes`: es la que
   * determina el alto del bloque, asi que es la unica que puede decidir si el
   * texto cabe. Si el backend devolviera una duracion de servicio que no cuadra
   * con el tramo, manda el tramo.
   */
  const durationMinutes = differenceInMinutes(
    parseISO(appointment.endTime),
    parseISO(appointment.startTime)
  )

  /**
   * El umbral de la variante compacta es la DURACION, no el alto en pixeles:
   * media hora o menos se pinta a dos lineas y con menos padding
   * (`design/CalendarioDesktop.dc.html:204`, `:220`, `:225`). Contra pixeles no
   * funciona -- `calculateBlockPosition` da 44px para 30 minutos, por debajo de
   * los 48px del slot, y cualquier comparacion "alto > un slot" sale al reves.
   */
  const isCompact = durationMinutes <= SLOT_MINUTES
  const terminalSuffix = TERMINAL_SUFFIX[appointment.status]
  const isTwoLine = isCompact || terminalSuffix !== undefined

  const startLabel = formatTime(appointment.startTime)
  const price = formatCurrency(appointment.servicePrice)
  const range = `${startLabel} - ${formatTime(appointment.endTime)}`

  /**
   * Los dos formatos del canvas. Escritorio escribe el rango completo y cuelga
   * el precio de esa misma linea (`:165`). Movil parte la informacion: la hora
   * de inicio va pegada al servicio (`:99`) y la tercera linea lleva duracion y
   * precio (`:100`). No es la misma linea reordenada, son dos disenos.
   *
   * A dos lineas -- compacta o estado terminal -- ambas variantes escriben el
   * rango, porque sin la linea del servicio una hora de inicio suelta no dice
   * cuando acaba la cita. El artboard solo dibuja ese caso en escritorio; el
   * movil compacto es analogia.
   */
  const timeLine = isTwoLine
    ? terminalSuffix
      ? `${range} · ${terminalSuffix}`
      : range
    : isDesktop
      ? `${range} · ${price}`
      : `${durationMinutes}min · ${price}`

  const isDestructiveText = DESTRUCTIVE_TEXT[appointment.status] === true

  return (
    <button
      type="button"
      data-testid="appointment-block"
      data-status={appointment.status}
      onClick={() => onTap?.(appointment)}
      className={cn(
        "absolute flex flex-col overflow-hidden rounded-lg border border-l-[3px] px-2.5 text-left shadow-[0_1px_2px_rgba(42,35,32,0.05)]",
        isCompact ? "py-1.5" : "py-2",
        isDesktop ? "gap-0.5" : "gap-[3px]",
        STATUS_STYLES[appointment.status],
        className
      )}
      style={{
        top: position.top,
        height: position.height,
        ...laneGeometry(inset, lane, lanes),
        ...style,
      }}
    >
      {appointment.status === "PENDING" ? (
        <div className="flex items-start justify-between gap-2">
          <ClientName name={appointment.clientName} isDesktop={isDesktop} isDestructive={false} />
          <span
            data-testid="appointment-block-badge"
            className="shrink-0 rounded-full bg-status-pending-bg px-[7px] py-0.5 text-[9px] font-bold whitespace-nowrap text-status-pending-text"
          >
            Pendiente
          </span>
        </div>
      ) : (
        <ClientName
          name={appointment.clientName}
          isDesktop={isDesktop}
          isDestructive={isDestructiveText}
        />
      )}

      {!isTwoLine && (
        <span
          className={cn(
            "truncate text-muted-foreground",
            isDesktop ? "text-[12px]" : "text-[11px]"
          )}
        >
          {isDesktop ? appointment.serviceName : `${appointment.serviceName} · ${startLabel}`}
        </span>
      )}

      <span
        className={cn(
          "truncate text-[11px] tabular-nums",
          isDestructiveText
            ? "text-destructive"
            : isDesktop
              ? "text-muted-foreground-2"
              : "text-muted-foreground"
        )}
      >
        {timeLine}
      </span>
    </button>
  )
}

function ClientName({
  name,
  isDesktop,
  isDestructive,
}: {
  name: string
  isDesktop: boolean
  isDestructive: boolean
}) {
  return (
    <span
      className={cn(
        "truncate text-[13px] font-semibold",
        isDesktop ? "leading-tight" : "leading-[1.2]",
        isDestructive && "text-destructive"
      )}
    >
      {name}
    </span>
  )
}
