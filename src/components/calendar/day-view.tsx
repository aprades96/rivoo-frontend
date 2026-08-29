"use client"

import { AppointmentBlock } from "./appointment-block"
import { BreakBlock } from "./break-block"
import { EmployeeColumnHeader, EMPLOYEE_HEADER_HEIGHT_PX } from "./employee-column-header"
import { FreeSlotHint } from "./free-slot-hint"
import { GridRows, TimeGrid, type CalendarGridVariant } from "./time-grid"
import {
  assignLanes,
  generateTimeLabels,
  SLOT_HEIGHT_PX,
  type BreakBlock as EmployeeBreak,
  type EmployeeColumn,
  type FreeSlot,
} from "@/lib/utils/calendar"
import { cn } from "@/lib/utils"
import type { Appointment } from "@/types/appointment"

const labels = generateTimeLabels()

/**
 * El padding lateral del marco: 24px en escritorio
 * (`design/CalendarioDesktop.dc.html:130`), 12px en movil
 * (`design/Calendario.dc.html:66`).
 */
const FRAME_PADDING_CLASSNAME: Record<CalendarGridVariant, string> = {
  desktop: "px-6",
  mobile: "px-3",
}

/** El descanso de un empleado, indexado por su id. */
export type EmployeeBreaks = Record<string, EmployeeBreak | null | undefined>

export interface DayViewProps {
  variant: CalendarGridVariant
  /**
   * Las columnas YA repartidas por `groupByEmployee`. La vista no las calcula:
   * quien llama es el unico que sabe si el filtro esta puesto y con que lista
   * de empleados. En movil se funden en una sola columna.
   */
  columns: EmployeeColumn[]
  /** Descansos ya resueltos con `breakPosition`, por id de empleado. */
  breaks?: EmployeeBreaks
  /**
   * El hueco libre que devuelve `nextFreeSlot`. SOLO se pinta en movil: el
   * artboard de escritorio no lo dibuja. La guarda de "solo si el dia visible
   * es hoy" ya vive dentro de `nextFreeSlot`, aqui no se repite.
   */
  freeSlot?: FreeSlot | null
  onAppointmentTap?: (appointment: Appointment) => void
  /** Pulsar una franja vacia de una columna: `employeeId` es null en "Otros". */
  onSlotTap?: (employeeId: string | null, time: string) => void
  onFreeSlotTap?: (slot: FreeSlot) => void
  className?: string
}

/**
 * La rejilla del dia. Escritorio: una columna por empleado con su fila de
 * cabeceras (`design/CalendarioDesktop.dc.html:103-235`). Movil: una columna
 * unica sin cabeceras (`design/Calendario.dc.html:66-125`), porque alli el
 * empleado se elige con el filtro de pildoras.
 *
 * ALTO Y SCROLL: `flex-1 min-h-0` + `overflow-y-auto`. La rejilla mide
 * 26 x 48 = 1248px y siempre desborda, asi que hace scroll DENTRO de si misma
 * -- como el `overflow: hidden` de los dos artboards -- y no la pagina. Nada
 * de `calc(100vh-...)`: la cadena de alturas ya llega desde
 * `(app)/layout.tsx` (`h-dvh overflow-hidden`) por `PageShell layout="fill"`,
 * y este componente solo tiene que no romperla.
 *
 * ALINEACION CABECERAS/REJILLA: la fila de cabeceras va DENTRO del contenedor
 * que hace scroll, como `sticky top-0`, y comparte con la rejilla UNA SOLA
 * cuadricula CSS -- las cabeceras son las N primeras celdas y las columnas las
 * N siguientes. No es una copia de `grid-template-columns` en dos sitios: es
 * la misma, asi que no hay desalineacion posible. La alternativa
 * (`scrollbar-gutter: stable` mas una reserva equivalente en una fila de
 * cabeceras que viviese FUERA del scroller) obliga a adivinar el ancho de la
 * barra, que depende del navegador y del sistema, y descuadraria las columnas
 * ~15px en cuanto uno de los dos cambiase. De regalo, las cabeceras se quedan
 * visibles al bajar a la tarde.
 */
export function DayView({
  variant,
  columns,
  breaks,
  freeSlot,
  onAppointmentTap,
  onSlotTap,
  onFreeSlotTap,
  className,
}: DayViewProps) {
  const isDesktop = variant === "desktop"

  return (
    <div
      data-testid="day-view"
      data-variant={variant}
      className={cn(
        "min-h-0 flex-1 overflow-y-auto",
        FRAME_PADDING_CLASSNAME[variant],
        className
      )}
    >
      <div className="flex">
        {/*
          El canal de horas. En escritorio se le antepone un hueco del alto de
          la cabecera para que su 08:00 arranque a la misma altura que el de
          las columnas; tambien `sticky`, o al bajar asomaria por debajo de las
          cabeceras. El ancho no se repite aqui: lo fija `TimeGrid` (64/46px) y
          esta columna flexible se ajusta a el.
        */}
        <div className="flex shrink-0 flex-col">
          {isDesktop && (
            <div
              aria-hidden="true"
              className="sticky top-0 z-10 bg-background"
              style={{ height: EMPLOYEE_HEADER_HEIGHT_PX }}
            />
          )}
          <TimeGrid variant={variant} />
        </div>

        {isDesktop ? (
          <DesktopColumns
            columns={columns}
            breaks={breaks}
            onAppointmentTap={onAppointmentTap}
            onSlotTap={onSlotTap}
          />
        ) : (
          <MobileColumn
            columns={columns}
            breaks={breaks}
            freeSlot={freeSlot}
            onAppointmentTap={onAppointmentTap}
            onSlotTap={onSlotTap}
            onFreeSlotTap={onFreeSlotTap}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Las N columnas de escritorio y sus N cabeceras en la MISMA cuadricula:
 * `repeat(N, minmax(0, 1fr))` con 12px de canalon horizontal -- las columnas y
 * el gap que declaran identicos la fila de cabeceras
 * (`design/CalendarioDesktop.dc.html:105`) y la rejilla (`:151`). El canalon
 * es solo horizontal (`gap-x-3`): entre la fila de cabeceras y la rejilla el
 * artboard no deja aire.
 */
function DesktopColumns({
  columns,
  breaks,
  onAppointmentTap,
  onSlotTap,
}: {
  columns: EmployeeColumn[]
  breaks: EmployeeBreaks | undefined
  onAppointmentTap: ((appointment: Appointment) => void) | undefined
  onSlotTap: ((employeeId: string | null, time: string) => void) | undefined
}) {
  return (
    <div
      data-testid="day-view-grid"
      className="grid min-w-0 grow gap-x-3"
      style={{
        // `Math.max(..., 1)`: `repeat(0, ...)` no es una plantilla valida y
        // tumbaria la rejilla entera si el salon aun no tuviese empleados.
        gridTemplateColumns: `repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))`,
      }}
    >
      {columns.map((column, index) => (
        <EmployeeColumnHeader
          key={columnKey(column, index)}
          column={column}
          index={index}
          className="sticky top-0 z-10 bg-background"
        />
      ))}
      {columns.map((column, index) => (
        <ColumnBody
          key={columnKey(column, index)}
          variant="desktop"
          employeeId={column.employeeId}
          appointments={column.appointments}
          employeeBreak={breakOf(breaks, column.employeeId)}
          onAppointmentTap={onAppointmentTap}
          onSlotTap={onSlotTap}
        />
      ))}
    </div>
  )
}

/**
 * La columna unica de movil: las citas de TODAS las columnas juntas. De ahi
 * que `assignLanes` sea imprescindible aqui -- con el filtro en "Todos"
 * (`design/Calendario.dc.html:51`) caen en la misma columna las citas de
 * varios empleados y, como bloques absolutos, se taparian entre si.
 */
function MobileColumn({
  columns,
  breaks,
  freeSlot,
  onAppointmentTap,
  onSlotTap,
  onFreeSlotTap,
}: {
  columns: EmployeeColumn[]
  breaks: EmployeeBreaks | undefined
  freeSlot: FreeSlot | null | undefined
  onAppointmentTap: ((appointment: Appointment) => void) | undefined
  onSlotTap: ((employeeId: string | null, time: string) => void) | undefined
  onFreeSlotTap: ((slot: FreeSlot) => void) | undefined
}) {
  const appointments = columns.flatMap((column) => column.appointments)

  /**
   * Solo hay un empleado al que atribuir la franja pulsada cuando la vista
   * muestra a uno solo; en "Todos" se manda `null` y decide quien llama.
   */
  const employeeId = columns.length === 1 ? columns[0].employeeId : null

  return (
    <div className="min-w-0 grow">
      <ColumnBody
        variant="mobile"
        employeeId={employeeId}
        appointments={appointments}
        employeeBreak={mergeBreaks(columns, breaks)}
        freeSlot={freeSlot}
        onAppointmentTap={onAppointmentTap}
        onSlotTap={onSlotTap}
        onFreeSlotTap={onFreeSlotTap}
      />
    </div>
  )
}

/** El contenido de una columna: el fondo de filas mas los bloques absolutos. */
function ColumnBody({
  variant,
  employeeId,
  appointments,
  employeeBreak,
  freeSlot,
  onAppointmentTap,
  onSlotTap,
  onFreeSlotTap,
}: {
  variant: CalendarGridVariant
  employeeId: string | null
  appointments: Appointment[]
  employeeBreak: EmployeeBreak | null
  freeSlot?: FreeSlot | null
  onAppointmentTap: ((appointment: Appointment) => void) | undefined
  onSlotTap: ((employeeId: string | null, time: string) => void) | undefined
  onFreeSlotTap?: ((slot: FreeSlot) => void) | undefined
}) {
  return (
    <div data-testid="day-view-column" data-employee-id={employeeId ?? undefined}>
      <GridRows variant={variant}>
        {/*
          El orden importa: todos estos son hermanos absolutos, asi que el
          ultimo queda encima. Primero las franjas pulsables, para que ninguna
          tape a un bloque; el hueco libre al final, que es el que invita a
          actuar.
        */}
        {onSlotTap && <SlotTargets employeeId={employeeId} onSlotTap={onSlotTap} />}

        {employeeBreak && (
          <BreakBlock
            variant={variant}
            label={employeeBreak.label}
            top={employeeBreak.top}
            height={employeeBreak.height}
          />
        )}

        {assignLanes(appointments).map(({ appointment, lane, lanes }) => (
          <AppointmentBlock
            key={appointment.id}
            appointment={appointment}
            variant={variant}
            lane={lane}
            lanes={lanes}
            onTap={onAppointmentTap}
          />
        ))}

        {freeSlot && (
          <FreeSlotHint
            top={freeSlot.top}
            height={freeSlot.height}
            onTap={() => onFreeSlotTap?.(freeSlot)}
          />
        )}
      </GridRows>
    </div>
  )
}

/**
 * Una franja pulsable por slot, en una capa POR DEBAJO de los bloques. Es la
 * forma de que "pulsar la rejilla" abra el alta a esa hora sin colgar un
 * `onClick` de cada linea de fondo -- que era lo que hacia esta vista antes y
 * lo que convertia cada cita en un click ambiguo, porque el evento del bloque
 * burbujeaba hasta la fila. Como botones de verdad, ademas, cada hora es
 * alcanzable con teclado.
 *
 * Solo se montan si hay `onSlotTap`: sin manejador serian 26 botones mudos por
 * columna.
 */
function SlotTargets({
  employeeId,
  onSlotTap,
}: {
  employeeId: string | null
  onSlotTap: (employeeId: string | null, time: string) => void
}) {
  return (
    <div className="absolute inset-0">
      {labels.map((label) => (
        <button
          key={label}
          type="button"
          data-testid="slot-target"
          data-time={label}
          aria-label={`Crear cita a las ${label}`}
          className="block w-full"
          style={{ height: SLOT_HEIGHT_PX }}
          onClick={() => onSlotTap(employeeId, label)}
        />
      ))}
    </div>
  )
}

/** La columna "Otros" no tiene id: se distingue por su posicion. */
function columnKey(column: EmployeeColumn, index: number): string {
  return column.employeeId ?? `orphan-${index}`
}

function breakOf(
  breaks: EmployeeBreaks | undefined,
  employeeId: string | null
): EmployeeBreak | null {
  if (!breaks || employeeId === null) return null
  return breaks[employeeId] ?? null
}

/**
 * El descanso de la columna unica de movil. El artboard lo dibuja con el
 * filtro en "Todos" (`design/Calendario.dc.html:51` y `:118`), asi que no
 * basta con pintarlo cuando hay un solo empleado; pero tampoco se pueden
 * apilar N cajas identicas, que es lo que pasaria en un salon donde toda la
 * plantilla almuerza a la vez. Se pinta el primer tramo que haya: si el
 * descanso es comun -- el caso normal y el del artboard -- sale exactamente
 * uno.
 */
function mergeBreaks(
  columns: EmployeeColumn[],
  breaks: EmployeeBreaks | undefined
): EmployeeBreak | null {
  for (const column of columns) {
    const rest = breakOf(breaks, column.employeeId)
    if (rest) return rest
  }
  return null
}
