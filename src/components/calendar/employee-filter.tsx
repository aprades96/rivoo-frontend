"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { initials } from "@/lib/utils/format"
import type { Employee } from "@/types/employee"

interface EmployeeFilterProps {
  employees: Employee[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function EmployeeFilter({ employees, selectedId, onSelect }: EmployeeFilterProps) {
  return (
    <ScrollArea className="w-full">
      <div className="flex gap-1.5 pb-2">
        {/* All employees pill */}
        <button
          onClick={() => onSelect(null)}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            selectedId === null
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border hover:bg-muted"
          }`}
        >
          Todos
        </button>

        {employees.filter((e) => e.isActive).map((emp) => {
          const isSelected = selectedId === emp.id
          return (
            <button
              key={emp.id}
              onClick={() => onSelect(emp.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium transition-colors ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted"
              }`}
            >
              <Avatar className="h-5 w-5">
                <AvatarFallback
                  className="text-[8px]"
                  style={
                    emp.colorHex && !isSelected
                      ? { backgroundColor: emp.colorHex + "20", color: emp.colorHex }
                      : undefined
                  }
                >
                  {initials(emp.firstName, emp.lastName)}
                </AvatarFallback>
              </Avatar>
              {emp.firstName}
            </button>
          )
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
