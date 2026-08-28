"use client"

import { Users } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { UnavailableNotice } from "@/components/booking/unavailable-notice"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { formatCurrency, initials } from "@/lib/utils/format"
import { formatDuration } from "@/lib/utils/dates"
import type { SalonPublic, EmployeePublic } from "@/types/salon"

interface PublicEmployeeStepProps {
  salon: SalonPublic
}

export function PublicEmployeeStep({ salon }: PublicEmployeeStepProps) {
  const { selectedService, selectedEmployeeId, anyEmployee, selectEmployee, nextStep } =
    usePublicBookingStore()

  const handleSelect = (employeeId: string | null, any: boolean) => {
    selectEmployee(employeeId, any)
    nextStep()
  }

  const offersSelectedService = (employee: EmployeePublic) =>
    !selectedService || employee.serviceIds.includes(selectedService.id)

  // Solo cuando la lista llega vacia: el flag explica un vacio, no tapa
  // profesionales reales. Con la lista caida hay que bloquear tambien el avance:
  // "Sin preferencia" no lleva employeeId y el paso de fecha lo resuelve
  // eligiendo el primer profesional que ofrezca el servicio (public-datetime-step),
  // asi que sin lista se queda sin huecos para siempre y sin explicacion.
  const employeesUnreachable = salon.employeesUnavailable && salon.employees.length === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-[28px] font-semibold tracking-display">
          Con quien la quieres
        </h2>
        {selectedService && (
          <p className="text-sm text-muted-foreground">
            {selectedService.name} &middot; {formatDuration(selectedService.durationMinutes)}{" "}
            &middot; {formatCurrency(selectedService.price, selectedService.currency)}
          </p>
        )}
      </div>

      {employeesUnreachable ? (
        <UnavailableNotice
          title="No hemos podido cargar los profesionales"
          description="Vuelve a intentarlo en unos minutos."
        />
      ) : (
        <>
          <div className="space-y-2.5">
            <Card
              className={`flex cursor-pointer items-center gap-3 rounded-xl border-dashed p-3.5 transition-colors hover:bg-muted/50 ${
                anyEmployee ? "border-primary bg-primary/5" : "border-border"
              }`}
              onClick={() => handleSelect(null, true)}
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Users className="h-5 w-5" />
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <p className="text-sm font-semibold">Sin preferencia</p>
                <p className="text-xs text-muted-foreground">El primero disponible</p>
              </div>
            </Card>

            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              O elige profesional
            </p>

            {salon.employees.map((employee) => {
              const isSelected = !anyEmployee && selectedEmployeeId === employee.id
              const offersService = offersSelectedService(employee)
              const fullName = `${employee.firstName} ${employee.lastName}`.trim()

              return (
                <Card
                  key={employee.id}
                  className={`flex items-center gap-3 rounded-xl border-border bg-card p-3.5 transition-colors ${
                    offersService ? "cursor-pointer hover:bg-muted/50" : "pointer-events-none opacity-50"
                  } ${isSelected ? "border-primary bg-primary/5" : ""}`}
                  onClick={() => offersService && handleSelect(employee.id, false)}
                >
                  <Avatar className="size-11">
                    <AvatarFallback className="text-sm font-semibold">
                      {initials(employee.firstName, employee.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <p className="text-sm font-semibold">{fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {offersService
                        ? employee.jobTitle
                        : `No ofrece ${selectedService?.name ?? "este servicio"}`}
                    </p>
                  </div>
                </Card>
              )
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Si eliges profesional veras solo sus huecos libres.
          </p>
        </>
      )}
    </div>
  )
}
