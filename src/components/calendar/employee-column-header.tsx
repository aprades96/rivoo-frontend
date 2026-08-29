import { cn } from "@/lib/utils"
import { initials } from "@/lib/utils/format"
import { employeeDaySummary, type EmployeeColumn } from "@/lib/utils/calendar"

/**
 * El alto de la tarjeta de cabecera (`design/CalendarioDesktop.dc.html:106`).
 * Se exporta porque `day-view.tsx` necesita reservar exactamente ese alto en
 * el canal de horas para que la fila de cabeceras y la rejilla arranquen a la
 * misma altura: si cada fichero se quedase su propia copia del 60, bastaria
 * tocar uno para descuadrar la pantalla.
 */
export const EMPLOYEE_HEADER_HEIGHT_PX = 60

/**
 * Paleta de reserva para el avatar cuando el empleado no tiene `colorHex`.
 * Los cinco tokens viven en `globals.css` (`--chart-1..5`, bajo el comentario
 * "Colores de empleado en la agenda") justamente para esto.
 *
 * Las clases van escritas enteras a proposito -- Tailwind escanea el fuente y
 * no veria `bg-chart-${n}/12` construido en ejecucion.
 */
const FALLBACK_AVATAR_CLASSNAMES = [
  "bg-chart-1/12 text-chart-1",
  "bg-chart-2/12 text-chart-2",
  "bg-chart-3/12 text-chart-3",
  "bg-chart-4/12 text-chart-4",
  "bg-chart-5/12 text-chart-5",
]

/**
 * El color de reserva de un empleado sin `colorHex`, por POSICION en la lista
 * y no por id: asi dos empleados contiguos nunca comparten color y el reparto
 * es estable mientras no cambie el orden.
 *
 * Vive aqui y se exporta porque el artboard dibuja el MISMO avatar de color en
 * los dos anchos -- cabecera de columna en escritorio
 * (`design/CalendarioDesktop.dc.html:107,114,121`) y pildora de filtro en movil
 * (`design/Calendario.dc.html:53,57,61`), con valores identicos --, asi que las
 * dos pantallas tienen que leer la misma paleta. Con una copia por componente,
 * el mismo empleado salia de color arriba y gris abajo.
 */
export function employeeFallbackAvatarClassName(index: number): string {
  const total = FALLBACK_AVATAR_CLASSNAMES.length
  return FALLBACK_AVATAR_CLASSNAMES[((index % total) + total) % total]
}

export interface EmployeeColumnHeaderProps {
  column: EmployeeColumn
  /** Posicion de la columna en la rejilla: decide el color de reserva. */
  index: number
  className?: string
}

/**
 * La tarjeta que encabeza una columna de la rejilla de escritorio
 * (`design/CalendarioDesktop.dc.html:106-112`): avatar con iniciales, nombre y
 * el resumen del dia. SOLO ESCRITORIO -- el artboard movil no dibuja
 * cabeceras, alli el empleado se elige con el filtro de pildoras.
 *
 * La columna "Otros" (`employee === null`, ver `groupByEmployee`) tambien se
 * pinta: lleva su `label` y un avatar neutro, porque no hay ningun empleado
 * del que sacar color ni iniciales. Sin ella, las citas huerfanas quedarian en
 * una columna sin encabezado.
 */
export function EmployeeColumnHeader({ column, index, className }: EmployeeColumnHeaderProps) {
  const { employee, label, appointments } = column
  const colorHex = employee?.colorHex ?? null

  const avatarText = employee
    ? initials(employee.firstName, employee.lastName)
    : initials(label)

  return (
    <div
      data-testid="employee-column-header"
      data-employee-id={column.employeeId ?? undefined}
      className={cn("flex items-center gap-2.5 px-3", className)}
      style={{ height: EMPLOYEE_HEADER_HEIGHT_PX }}
    >
      <div
        data-testid="employee-column-avatar"
        aria-hidden="true"
        className={cn(
          "flex size-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
          // Sin empleado no hay color propio ni de reserva que valga: la
          // columna "Otros" no es una persona, asi que va en gris.
          !employee && "bg-muted text-muted-foreground-2",
          employee && !colorHex && employeeFallbackAvatarClassName(index)
        )}
        // Mismo patron que el filtro de pildoras (`employee-filter.tsx`):
        // fondo al color del empleado con alfa "20" (12,5%) y texto al color
        // pleno. Es lo que dibuja el artboard (#F6E7E0 sobre #B4522F).
        style={colorHex ? { backgroundColor: colorHex + "20", color: colorHex } : undefined}
      >
        {avatarText}
      </div>

      <div className="flex min-w-0 flex-col">
        {/* `leading-tight` = el `normal` del artboard
            (`design/CalendarioDesktop.dc.html:108-110`, que no declara
            `line-height`). Con el 1.5 de la preflight de Tailwind la pareja
            nombre + resumen mide 37,5px en vez de los 31,25px dibujados. */}
        <span className="truncate text-[14px] leading-tight font-semibold">{label}</span>
        <span className="truncate text-[11px] leading-tight text-muted-foreground-2">
          {employeeDaySummary(appointments)}
        </span>
      </div>
    </div>
  )
}
