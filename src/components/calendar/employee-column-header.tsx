import { cn } from "@/lib/utils"
import { initials } from "@/lib/utils/format"
import { employeeDaySummary, type EmployeeColumn } from "@/lib/utils/calendar"
import { employeeAvatarAlphaStyle, employeeFallbackAvatarClassName } from "@/lib/utils/avatar"

/**
 * El alto de la tarjeta de cabecera (`design/CalendarioDesktop.dc.html:106`).
 * Se exporta porque `day-view.tsx` necesita reservar exactamente ese alto en
 * el canal de horas para que la fila de cabeceras y la rejilla arranquen a la
 * misma altura: si cada fichero se quedase su propia copia del 60, bastaria
 * tocar uno para descuadrar la pantalla.
 */
export const EMPLOYEE_HEADER_HEIGHT_PX = 60

export interface EmployeeColumnHeaderProps {
  column: EmployeeColumn
  /** Posicion de la columna en la rejilla: decide el color de reserva. */
  index: number
  className?: string
  /**
   * Contrato fijado en D17: "hay un panel abierto a la derecha; comprime".
   * Solo tiene efecto en escritorio -- este componente no se monta en movil.
   * Opcional, por defecto `false`, sin efecto en el comportamiento actual.
   */
  narrow?: boolean
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
export function EmployeeColumnHeader({
  column,
  index,
  className,
  narrow = false,
}: EmployeeColumnHeaderProps) {
  const { employee, label, appointments } = column
  const colorHex = employee?.colorHex ?? null

  const avatarText = employee
    ? initials(employee.firstName, employee.lastName)
    : initials(label)

  // Modo estrecho (D17, §1.3.4): la meta pierde el tramo de duracion --
  // "4 citas · 5h 30min" -> "4 citas". El caso vacio ("Sin citas") no lleva
  // separador, asi que el recorte lo deja intacto.
  const fullSummary = employeeDaySummary(appointments)
  const summary = narrow ? fullSummary.split(" · ")[0] : fullSummary

  return (
    <div
      data-testid="employee-column-header"
      data-employee-id={column.employeeId ?? undefined}
      className={cn("flex items-center gap-2.5 px-3", narrow && "gap-[9px] px-2.5", className)}
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
        style={colorHex ? employeeAvatarAlphaStyle(colorHex) : undefined}
      >
        {avatarText}
      </div>

      <div className="flex min-w-0 flex-col">
        {/* `leading-tight` = el `normal` del artboard
            (`design/CalendarioDesktop.dc.html:108-110`, que no declara
            `line-height`). Con el 1.5 de la preflight de Tailwind la pareja
            nombre + resumen mide 37,5px en vez de los 31,25px dibujados. */}
        <span
          className={cn(
            "truncate",
            // Orden a proposito: tailwind-merge trata el tamano de fuente
            // como conflictivo con `leading` (atajo `text-lg/6`). Un
            // `leading-*` escrito ANTES de un `text-[Npx]` se borra en
            // silencio; aqui el tamano va primero.
            narrow ? "text-[13px]" : "text-[14px]",
            "leading-tight font-semibold"
          )}
        >
          {label}
        </span>
        <span className="truncate text-[11px] leading-tight text-muted-foreground-2">
          {summary}
        </span>
      </div>
    </div>
  )
}
