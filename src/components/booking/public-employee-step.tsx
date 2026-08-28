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
  // profesionales reales.
  const employeesUnreachable = salon.employeesUnavailable && salon.employees.length === 0

  // Unica condicion que habilita el avance al paso 3. "Sin preferencia" no lleva
  // employeeId y public-datetime-step lo resuelve con el primero que ofrezca el
  // servicio; si no hay ninguno esa busqueda falla, la consulta de huecos se
  // queda desactivada (y una query desactivada reporta isLoading false, asi que
  // ni siquiera sale el spinner) y el visitante ve 30 dias vacios sin
  // explicacion. Cubre los tres vacios: lista caida, salon sin profesionales y
  // profesionales que no hacen el servicio elegido — en los tres el some() es
  // false. El aviso, en cambio, NO se puede unificar: solo el primero es un
  // fallo de carga, los otros dos son informacion cierta sobre el salon.
  const someoneOffersService = salon.employees.some(offersSelectedService)

  const employeeCards = salon.employees.map((employee) => {
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
  })

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
      ) : salon.employees.length === 0 ? (
        // El salon no tiene a nadie. Mandarle a cambiar de servicio seria
        // pasearle por la lista entera para encontrar el mismo vacio, asi que
        // aqui no se ofrece salida: no la hay.
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Este salon no tiene profesionales disponibles para reserva online.
          </p>
        </div>
      ) : !someoneOffersService ? (
        // Hay profesionales, pero ninguno tiene asignado este servicio. Aqui si
        // hay salida y es concreta: la flecha de atras del paso. Se siguen
        // enseñando las tarjetas, apagadas y con su "No ofrece X": son el
        // referente de "estos profesionales" y ademas prueban que el salon si
        // tiene equipo.
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Ninguno de estos profesionales ofrece {selectedService?.name ?? "este servicio"}.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Toca la flecha de arriba para elegir otro servicio.
            </p>
          </div>
          <div className="space-y-2.5">{employeeCards}</div>
        </div>
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

            {employeeCards}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Si eliges profesional veras solo sus huecos libres.
          </p>
        </>
      )}
    </div>
  )
}
