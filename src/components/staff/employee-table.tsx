import { ChevronRight } from "lucide-react"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { EmployeeColor } from "@/components/staff/employee-color"
import { EmployeeStatusBadge } from "@/components/staff/employee-card"
import { employeeAvatarStyle } from "@/lib/utils/avatar"
import { formatPhone, initials } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import type { Employee } from "@/types/employee"

// Rejilla de `EquipoDesktop.dc.html:28`: seis columnas, la ultima solo para
// el chevron. Constante a nivel de modulo -- no depende de props, y una
// referencia estable evita recrear el array (y por tanto las funciones
// `cell`) en cada render de `EmployeeTable`.
const COLUMNS: DataTableColumn<Employee>[] = [
  {
    key: "employee",
    header: "Empleado",
    width: "minmax(0,1.5fr)",
    cell: (employee) => (
      <span className="flex min-w-0 items-center gap-3">
        <Avatar className="h-[38px] w-[38px] shrink-0">
          <AvatarFallback
            className="text-sm font-semibold"
            style={employeeAvatarStyle(employee.colorHex)}
          >
            {initials(employee.firstName, employee.lastName)}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "truncate text-sm font-semibold",
            !employee.isActive && "text-muted-foreground"
          )}
        >
          {employee.firstName} {employee.lastName}
        </span>
      </span>
    ),
  },
  {
    key: "jobTitle",
    header: "Puesto",
    width: "170px",
    cell: (employee) => (
      <span
        className={cn(
          "truncate text-[13px] leading-tight",
          employee.isActive ? "text-muted-foreground" : "text-muted-foreground-2"
        )}
      >
        {employee.jobTitle}
      </span>
    ),
  },
  {
    key: "contact",
    header: "Contacto",
    width: "minmax(0,1.5fr)",
    cell: (employee) => (
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className={cn(
            "truncate text-[13px] leading-tight",
            !employee.isActive && "text-muted-foreground"
          )}
        >
          {employee.email}
        </span>
        {employee.phone ? (
          <span className="tabular-nums text-[12px] leading-tight text-muted-foreground-2">
            {formatPhone(employee.phone)}
          </span>
        ) : (
          // Estado vacio SOLO de escritorio (D9): el movil no tiene columna
          // de contacto separada donde mostrarlo.
          <span className="text-[12px] leading-tight text-text-subtle">Sin teléfono</span>
        )}
      </span>
    ),
  },
  {
    key: "color",
    header: "Color",
    width: "128px",
    cell: (employee) => (
      <EmployeeColor
        colorHex={employee.colorHex}
        shape="dot"
        showHex
        emptyLabel="Por defecto"
      />
    ),
  },
  {
    key: "status",
    header: "Estado",
    width: "96px",
    cell: (employee) => <EmployeeStatusBadge isActive={employee.isActive} />,
  },
  {
    key: "chevron",
    header: "",
    width: "20px",
    cell: () => <ChevronRight className="size-[17px] text-text-subtle" strokeWidth={2} />,
  },
]

interface EmployeeTableProps {
  employees: Employee[]
}

/**
 * Tabla de escritorio del panel "Empleados" (`EquipoDesktop.dc.html:100`).
 * Sobre `DataTable` (T2): filas de 68px, gap de columna 16px, cada fila es un
 * `<Link>` hacia la ficha del empleado (D5), y la fila inactiva lleva el
 * tinte `--muted-subtle` que solo existe en escritorio (D9) -- en movil
 * (`EmployeeCard`) el fondo no cambia.
 */
export function EmployeeTable({ employees }: EmployeeTableProps) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={employees}
      rowKey={(employee) => employee.id}
      rowHeight={68}
      gap={16}
      href={(employee) => `/staff/${employee.id}`}
      rowClassName={(employee) => (employee.isActive ? undefined : "bg-muted-subtle")}
      caption="Empleados"
    />
  )
}
