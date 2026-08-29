"use client"

import { useMemo } from "react"
import { AppointmentBlock } from "./appointment-block"
import { BreakBlock } from "./break-block"
import { EmployeeColumnHeader, EMPLOYEE_HEADER_HEIGHT_PX } from "./employee-column-header"
import { FreeSlotHint } from "./free-slot-hint"
import { GridRows, TimeGrid, type CalendarGridVariant } from "./time-grid"
import {
  assignLanes,
  breakOfColumn,
  generateTimeLabels,
  visibleBreak,
  SLOT_HEIGHT_PX,
  type BreakBlock as EmployeeBreak,
  type EmployeeBreaks,
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

/**
 * El descanso de un empleado, indexado por su id. Vive en `lib/utils/calendar`
 * -- donde tambien viven `breakPosition`, que lo produce, y `visibleBreak`,
 * que decide cual se ve en movil -- y se reexporta aqui porque es una prop de
 * esta vista.
 */
export type { EmployeeBreaks }

export interface DayViewProps {
  variant: CalendarGridVariant
  /**
   * Las columnas YA repartidas por `groupByEmployee`. La vista no las calcula:
   * quien llama es el unico que sabe si el filtro esta puesto y con que lista
   * de empleados. En movil se funden en una sola columna.
   */
  columns: EmployeeColumn[]
  /**
   * De donde sale el resumen de la cabecera de columna ("4 citas · 5h 30min"),
   * SOLO escritorio. Por defecto, las propias `columns`.
   *
   * Existe porque ese resumen es una afirmacion de hecho sobre la agenda del
   * empleado, no una descripcion de lo que la vista deja ver: cuando quien
   * llama recorta `columns` (el buscador de `/calendar`), la cabecera de una
   * peluquera con el dia lleno anunciaba "Sin citas". Se emparejan por
   * `employeeId`; una columna sin pareja se resume con la suya.
   */
  summaryColumns?: EmployeeColumn[]
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
  summaryColumns,
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
              data-testid="time-channel-spacer"
              className="sticky top-0 z-10 bg-background"
              style={{ height: EMPLOYEE_HEADER_HEIGHT_PX }}
            />
          )}
          <TimeGrid variant={variant} />
        </div>

        {isDesktop ? (
          <DesktopColumns
            columns={columns}
            summaryColumns={summaryColumns}
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
  summaryColumns,
  breaks,
  onAppointmentTap,
  onSlotTap,
}: {
  columns: EmployeeColumn[]
  summaryColumns: EmployeeColumn[] | undefined
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
          column={summaryColumnFor(summaryColumns, column)}
          index={index}
          className="sticky top-0 z-10 bg-background"
        />
      ))}
      {columns.map((column, index) => (
        <ColumnBody
          key={columnKey(column, index)}
          variant="desktop"
          employeeId={column.employeeId}
          columnLabel={column.label}
          appointments={column.appointments}
          employeeBreak={breakOfColumn(breaks, column.employeeId)}
          onAppointmentTap={onAppointmentTap}
          onSlotTap={onSlotTap}
        />
      ))}
    </div>
  )
}

/**
 * La columna unica de movil: las citas de TODAS las columnas juntas. De ahi
 * que `assignLanes` sea imprescindible aqui -- con el filtro en "Todos" caen
 * en la misma columna las citas de varios empleados y, como bloques absolutos,
 * se taparian entre si.
 *
 * "Todos" no es lo que dibuja el artboard: alli la pildora seleccionada es la
 * de Laura (`design/Calendario.dc.html:52-55`, #B4522F), la de "Todos" esta en
 * reposo (`:51`, blanca) y la rejilla pinta solo los bloques de su columna. Es
 * una eleccion del usuario, no el estado dibujado -- pero llega con un toque,
 * asi que el reparto tiene que estar.
 *
 * La union va MEMORIZADA: `flatMap` devuelve un array nuevo en cada render y
 * eso solo bastaba para tirar por tierra el `useMemo` de `ColumnBody`, que
 * depende de la identidad de `appointments`.
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
  const appointments = useMemo(
    () => columns.flatMap((column) => column.appointments),
    [columns]
  )

  /**
   * Solo hay un empleado al que atribuir la franja pulsada -- y un nombre que
   * ponerle en el `aria-label` -- cuando la vista muestra a uno solo; en
   * "Todos" se manda `null` y decide quien llama.
   */
  const single = columns.length === 1 ? columns[0] : null

  return (
    <div className="min-w-0 grow">
      <ColumnBody
        variant="mobile"
        employeeId={single ? single.employeeId : null}
        columnLabel={single ? single.label : undefined}
        appointments={appointments}
        employeeBreak={visibleBreak(columns, breaks)}
        freeSlot={freeSlot}
        onAppointmentTap={onAppointmentTap}
        onSlotTap={onSlotTap}
        onFreeSlotTap={onFreeSlotTap}
      />
    </div>
  )
}

/**
 * El contenido de una columna: el fondo de filas mas los bloques absolutos.
 *
 * `assignLanes` va MEMORIZADA. Cuesta O(k³) por grupo de solape
 * (`lib/utils/calendar.ts`, `resolveLaneCounts`) y se llamaba en el cuerpo del
 * render, una vez POR COLUMNA: escribir en el buscador de `/calendar` rehacia
 * el reparto entero de las N columnas en cada tecla. Memorizar el `combine` de
 * `useEmployeesWorkingHours` no evitaba nada de esto -- teclear cambia las
 * propias `appointments` --, el corte tiene que estar aqui.
 */
function ColumnBody({
  variant,
  employeeId,
  columnLabel,
  appointments,
  employeeBreak,
  freeSlot,
  onAppointmentTap,
  onSlotTap,
  onFreeSlotTap,
}: {
  variant: CalendarGridVariant
  employeeId: string | null
  columnLabel?: string
  appointments: Appointment[]
  employeeBreak: EmployeeBreak | null
  freeSlot?: FreeSlot | null
  onAppointmentTap: ((appointment: Appointment) => void) | undefined
  onSlotTap: ((employeeId: string | null, time: string) => void) | undefined
  onFreeSlotTap?: ((slot: FreeSlot) => void) | undefined
}) {
  const lanes = useMemo(() => assignLanes(appointments), [appointments])

  return (
    <div data-testid="day-view-column" data-employee-id={employeeId ?? undefined}>
      <GridRows variant={variant}>
        {/*
          El orden importa: todos estos son hermanos absolutos, asi que el
          ultimo queda encima. Primero las franjas pulsables, para que ninguna
          tape a un bloque; el hueco libre al final, que es el que invita a
          actuar.
        */}
        {onSlotTap && (
          <SlotTargets employeeId={employeeId} columnLabel={columnLabel} onSlotTap={onSlotTap} />
        )}

        {employeeBreak && (
          <BreakBlock
            variant={variant}
            label={employeeBreak.label}
            top={employeeBreak.top}
            height={employeeBreak.height}
          />
        )}

        {lanes.map(({ appointment, lane, lanes: laneCount }) => (
          <AppointmentBlock
            key={appointment.id}
            appointment={appointment}
            variant={variant}
            lane={lane}
            lanes={laneCount}
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
 *
 * FUERA DEL ORDEN DE TABULACION (`tabIndex={-1}`). En escritorio hay una
 * columna por empleado, asi que tabular la rejilla eran hasta 26 paradas por
 * columna ANTES de llegar a la primera cita -- 78 en el artboard de tres
 * empleados -- solo para atravesar un fondo. Siguen siendo botones de verdad y
 * siguen en el arbol de accesibilidad, asi que un lector de pantalla los
 * recorre y los activa en modo exploracion; lo que se les quita es el tabulador
 * secuencial, donde nunca fueron el destino que nadie buscaba. El alta a mano
 * tiene ademas su propio boton en la cabecera.
 *
 * Y el `aria-label` lleva el nombre de la columna: sin el, las N columnas
 * anunciaban literalmente lo mismo ("Crear cita a las 09:00", tres veces) y no
 * habia forma de saber a que profesional pertenecia cada una. En movil solo lo
 * lleva cuando el filtro ha dejado una sola columna, que es cuando hay un
 * nombre que decir.
 */
function SlotTargets({
  employeeId,
  columnLabel,
  onSlotTap,
}: {
  employeeId: string | null
  columnLabel: string | undefined
  onSlotTap: (employeeId: string | null, time: string) => void
}) {
  return (
    <div className="absolute inset-0">
      {labels.map((label) => (
        <button
          key={label}
          type="button"
          tabIndex={-1}
          data-testid="slot-target"
          data-time={label}
          aria-label={
            columnLabel
              ? `Crear cita a las ${label} con ${columnLabel}`
              : `Crear cita a las ${label}`
          }
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

/**
 * La columna de la que sale el resumen de una cabecera: su pareja en
 * `summaryColumns` si la hay, y ella misma si no. Sin `summaryColumns` -- el
 * caso por defecto -- no hay nada que emparejar.
 */
function summaryColumnFor(
  summaryColumns: EmployeeColumn[] | undefined,
  column: EmployeeColumn
): EmployeeColumn {
  if (!summaryColumns) return column
  return summaryColumns.find((candidate) => candidate.employeeId === column.employeeId) ?? column
}
