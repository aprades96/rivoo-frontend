import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { initials } from "@/lib/utils/format"
import type { Employee } from "@/types/employee"

interface EmployeeCardProps {
  employee: Employee
  onTap?: (employee: Employee) => void
}

export function EmployeeCard({ employee, onTap }: EmployeeCardProps) {
  return (
    <Card
      className="cursor-pointer p-3 transition-colors hover:bg-muted/50"
      onClick={() => onTap?.(employee)}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback
            className="text-sm"
            style={
              employee.colorHex
                ? { backgroundColor: employee.colorHex + "20", color: employee.colorHex }
                : undefined
            }
          >
            {initials(employee.firstName, employee.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {employee.firstName} {employee.lastName}
          </p>
          {employee.jobTitle && (
            <p className="truncate text-xs text-muted-foreground">
              {employee.jobTitle}
            </p>
          )}
        </div>
        <Badge variant={employee.isActive ? "secondary" : "outline"}>
          {employee.isActive ? "Activo" : "Inactivo"}
        </Badge>
      </div>
    </Card>
  )
}
