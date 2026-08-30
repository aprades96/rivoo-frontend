import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { initials } from "@/lib/utils/format"
import { employeeAvatarStyle } from "@/lib/utils/avatar"
import { cn } from "@/lib/utils"
import type { Employee } from "@/types/employee"

interface EmployeeCardProps {
  employee: Employee
}

/**
 * Badge de estado del empleado (D9): compartido por la tarjeta móvil y la
 * tabla de escritorio (`employee-table.tsx`) para que las dos pantallas no
 * puedan divergir en el color. Activo replica el par
 * `--color-status-completed-bg`/`-text` (#F0EAE3/#7A6A5F, `Equipo.dc.html:26`);
 * Inactivo usa el borde/fondo/texto exactos de `EquipoDesktop.dc.html:203`
 * (`border --border`, `bg --card`, `--muted-foreground-2`), que también vale
 * para el móvil según la tabla de D9 ("igual").
 */
export function EmployeeStatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge
      variant="secondary"
      className="bg-(--color-status-completed-bg) text-(--color-status-completed-text) hover:bg-(--color-status-completed-bg) text-[11px] leading-none font-semibold"
    >
      Activo
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className="border-border bg-card text-muted-foreground-2 text-[11px] leading-none font-semibold"
    >
      Inactivo
    </Badge>
  )
}

/**
 * Fila de empleado en móvil (`Equipo.dc.html:58`). Pasa a `<Link>` (D5): la
 * fila es navegable de verdad, con foco visible y alcanzable por teclado, en
 * vez del `<Card onClick>` sin `role` de antes. Sin chevron ("salvo que" de
 * D5): el artboard móvil no lo dibuja, a diferencia de la fila de escritorio.
 *
 * D9: en móvil la fila inactiva NO cambia de fondo (`Equipo.dc.html:94` no la
 * tinta) -- solo el nombre y el puesto atenúan su color.
 */
export function EmployeeCard({ employee }: EmployeeCardProps) {
  return (
    <Link
      href={`/staff/${employee.id}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Avatar className="h-10 w-10">
        <AvatarFallback
          className="text-[13px] leading-none font-semibold"
          style={employeeAvatarStyle(employee.colorHex)}
        >
          {initials(employee.firstName, employee.lastName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-semibold",
            !employee.isActive && "text-muted-foreground"
          )}
        >
          {employee.firstName} {employee.lastName}
        </p>
        {employee.jobTitle && (
          <p
            className={cn(
              "truncate text-xs",
              employee.isActive ? "text-muted-foreground" : "text-muted-foreground-2"
            )}
          >
            {employee.jobTitle}
          </p>
        )}
      </div>
      <EmployeeStatusBadge isActive={employee.isActive} />
    </Link>
  )
}
