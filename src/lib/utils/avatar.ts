import type { CSSProperties } from "react"
import type { Employee } from "@/types/employee"

/**
 * Paleta de reserva para el avatar cuando el empleado no tiene `colorHex`.
 * Los cinco tokens viven en `globals.css` (`--chart-1..5`, bajo el comentario
 * "Colores de empleado en la agenda") justamente para esto.
 *
 * Las clases van escritas enteras a proposito -- Tailwind escanea el fuente y
 * no veria `bg-chart-${n}/12` construido en ejecucion.
 *
 * Modulo compartido por TRES consumidores (D12): la cabecera de columna de
 * escritorio, la pildora de filtro en movil, y -- via `employeeSolidColor` --
 * el punto de color de la hoja de detalle de cita en movil. Copiarla en cada
 * sitio la condena a divergir: el mismo empleado saldria de un color en una
 * pantalla y de otro en la siguiente.
 */
const FALLBACK_AVATAR_CLASSNAMES = [
  "bg-chart-1/12 text-chart-1",
  "bg-chart-2/12 text-chart-2",
  "bg-chart-3/12 text-chart-3",
  "bg-chart-4/12 text-chart-4",
  "bg-chart-5/12 text-chart-5",
]

/**
 * Color PLENO de cada entrada de la paleta de reserva, en el MISMO orden que
 * `FALLBACK_AVATAR_CLASSNAMES`. Referenciado por variable CSS (no por hex
 * duplicado) para que no pueda desincronizarse de `globals.css` si alguien
 * cambia ahi los tokens `--chart-1..5`.
 */
const FALLBACK_AVATAR_COLOR_VARS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

/** Indice normalizado dentro de `[0, total)`, aceptando negativos. */
function paletteIndex(index: number, total: number): number {
  return ((index % total) + total) % total
}

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
  return FALLBACK_AVATAR_CLASSNAMES[paletteIndex(index, FALLBACK_AVATAR_CLASSNAMES.length)]
}

/**
 * El mismo reparto que `employeeFallbackAvatarClassName`, pero como color
 * PLENO en vez de clases Tailwind -- para consumidores que necesitan un
 * `style` en linea (el punto solido de la hoja de movil, D12) en lugar de un
 * fondo con alfa. Misma posicion, mismo color.
 */
export function employeeFallbackAvatarColor(index: number): string {
  return FALLBACK_AVATAR_COLOR_VARS[paletteIndex(index, FALLBACK_AVATAR_COLOR_VARS.length)]
}

/**
 * Fondo con alfa (12,5%, sufijo hex `"20"`) + texto al color pleno -- el
 * patron que ya pintaban por separado `employee-column-header.tsx` y
 * `employee-filter.tsx` cuando el empleado tiene `colorHex` propio
 * (`design/CalendarioDesktop.dc.html:107`: `#F6E7E0` sobre `#B4522F`).
 */
export function employeeAvatarAlphaStyle(colorHex: string): CSSProperties {
  return { backgroundColor: `${colorHex}20`, color: colorHex }
}

/**
 * Par por defecto de `employeeAvatarStyle` cuando no hay `colorHex` -- calca
 * las clases `bg-muted text-muted-foreground` que `AvatarFallback` ya aplica
 * de serie (`ui/avatar.tsx:49`). Se deja como estilo en linea concreto (no
 * `undefined`) para que las dos copias literales que sustituye
 * (`staff/[id]/page.tsx:155`, `employee-card.tsx:24`) puedan llamar al
 * helper sin condicional propio.
 */
const DEFAULT_EMPLOYEE_AVATAR_STYLE: CSSProperties = {
  backgroundColor: "var(--muted)",
  color: "var(--muted-foreground)",
}

/**
 * Estilo del avatar de iniciales de un empleado (D14): fondo con alfa +
 * color pleno cuando tiene `colorHex` propio (delega en
 * `employeeAvatarAlphaStyle`), o el par por defecto ya usado por el repo
 * para un avatar sin color en caso contrario. Unifica la concatenacion
 * `employee.colorHex + "20"` duplicada literalmente en
 * `staff/[id]/page.tsx:155` y `employee-card.tsx:24`.
 */
export function employeeAvatarStyle(colorHex: string | null): CSSProperties {
  if (!colorHex) return DEFAULT_EMPLOYEE_AVATAR_STYLE
  return employeeAvatarAlphaStyle(colorHex)
}

/**
 * Color PLENO para el punto solido de la fila de empleado en la hoja de
 * detalle de movil (`design/DetalleCita.dc.html:84`) -- D12. El resolutor de
 * alfa de arriba da un fondo al 12,5%; reutilizarlo para el punto lo dejaria
 * casi invisible sobre el fondo claro de la hoja (`#FBF7F2`), asi que hace
 * falta este SEGUNDO resolutor.
 *
 * Con `colorHex` devuelve el color del empleado tal cual. Sin el, cae en la
 * MISMA posicion de la paleta de reserva que usa el avatar de iniciales
 * (`employeeFallbackAvatarColor`), para que los dos resolutores caigan en el
 * mismo color para el mismo empleado.
 */
export function employeeSolidColor(colorHex: string | null, fallbackIndex: number): string {
  return colorHex ?? employeeFallbackAvatarColor(fallbackIndex)
}

/**
 * Posicion del empleado en la paleta de reserva, o -1 si no esta.
 *
 * Filtra por `isActive` a proposito: la invariante que da estabilidad a la
 * paleta es "posicion entre los empleados ACTIVOS, en el orden que da la
 * API" -- la misma que ya aplican `groupByEmployee` (`calendar.ts`) y
 * `EmployeeFilter`. Hoy `useEmployees()` solo trae activos porque el backend
 * filtra en `findAllActive`, pero el propio frontend filtra por `isActive`
 * en tres sitios distintos: no se puede asumir ese detalle de servidor sin
 * contradecir el propio codigo. Si este resolutor dejase de filtrar y algun
 * consumidor le pasase la lista cruda, el mismo empleado sin `colorHex`
 * saldria de un color en la cabecera de columna y de otro en el panel de
 * detalle -- justo el bug que corrige esta funcion.
 */
export function employeePaletteIndex(employees: Employee[], employeeId: string): number {
  const activeEmployees = employees.filter((employee) => employee.isActive)
  return activeEmployees.findIndex((employee) => employee.id === employeeId)
}
