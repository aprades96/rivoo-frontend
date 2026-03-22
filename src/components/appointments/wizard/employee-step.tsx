"use client"

import { Users } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { useEmployees } from "@/hooks/use-staff"
import { useWizardStore } from "@/lib/stores/wizard-store"
import { initials } from "@/lib/utils/format"
import type { Employee } from "@/types/employee"

export function EmployeeStep() {
  const { data, isLoading } = useEmployees()
  const { selectedEmployee, anyEmployee, selectEmployee, nextStep } = useWizardStore()

  const employees = data?.content?.filter((e) => e.isActive) ?? []

  const handleSelect = (employee: Employee | null, any: boolean) => {
    selectEmployee(employee, any)
    nextStep()
  }

  if (isLoading) return <LoadingSkeleton count={4} />

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Elige un profesional</h2>
        <p className="text-sm text-muted-foreground">
          Quien atendera al cliente
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Any employee option */}
        <Card
          className={`cursor-pointer p-3 text-center transition-colors hover:bg-muted/50 ${
            anyEmployee ? "border-primary bg-primary/5" : ""
          }`}
          onClick={() => handleSelect(null, true)}
        >
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Users className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Sin preferencia</p>
          <p className="text-xs text-muted-foreground">Cualquier disponible</p>
        </Card>

        {/* Employee cards */}
        {employees.map((employee) => {
          const isSelected = selectedEmployee?.id === employee.id
          return (
            <Card
              key={employee.id}
              className={`cursor-pointer p-3 text-center transition-colors hover:bg-muted/50 ${
                isSelected ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => handleSelect(employee, false)}
            >
              <Avatar className="mx-auto mb-2 h-12 w-12">
                <AvatarFallback
                  className="text-sm"
                  style={employee.colorHex ? { backgroundColor: employee.colorHex + "20", color: employee.colorHex } : undefined}
                >
                  {initials(employee.firstName, employee.lastName)}
                </AvatarFallback>
              </Avatar>
              <p className="truncate text-sm font-medium">
                {employee.firstName}
              </p>
              {employee.jobTitle && (
                <p className="truncate text-xs text-muted-foreground">
                  {employee.jobTitle}
                </p>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
