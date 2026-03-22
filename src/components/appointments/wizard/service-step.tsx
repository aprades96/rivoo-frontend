"use client"

import { useMemo } from "react"
import { Card } from "@/components/ui/card"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { useServices, useEmployeeServices } from "@/hooks/use-staff"
import { useWizardStore } from "@/lib/stores/wizard-store"
import { formatCurrency } from "@/lib/utils/format"
import { formatDuration } from "@/lib/utils/dates"
import type { ServiceOffering } from "@/types/service"

export function ServiceStep() {
  const { data: servicesData, isLoading: servicesLoading } = useServices()
  const { selectedEmployee, anyEmployee, selectedService, selectService, nextStep } = useWizardStore()

  const { data: employeeServicesData } = useEmployeeServices(
    !anyEmployee ? selectedEmployee?.id : undefined
  )

  const services = servicesData?.content?.filter((s) => s.isActive) ?? []

  // Filter by employee's assigned services if an employee is selected
  const filteredServices = useMemo(() => {
    if (anyEmployee || !employeeServicesData) return services
    const assignedIds = new Set(employeeServicesData.map((es) => es.serviceId))
    return services.filter((s) => assignedIds.has(s.id))
  }, [services, employeeServicesData, anyEmployee])

  const handleSelect = (service: ServiceOffering) => {
    selectService(service)
    nextStep()
  }

  if (servicesLoading) return <LoadingSkeleton count={5} />

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Elige un servicio</h2>
        <p className="text-sm text-muted-foreground">
          {filteredServices.length} servicio{filteredServices.length !== 1 ? "s" : ""} disponible{filteredServices.length !== 1 ? "s" : ""}
        </p>
      </div>

      {filteredServices.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Este empleado no tiene servicios asignados.
        </p>
      ) : (
        <div className="space-y-2">
          {filteredServices.map((service) => {
            const isSelected = selectedService?.id === service.id
            return (
              <Card
                key={service.id}
                className={`cursor-pointer p-3 transition-colors hover:bg-muted/50 ${
                  isSelected ? "border-primary bg-primary/5" : ""
                }`}
                onClick={() => handleSelect(service)}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{service.name}</p>
                    {service.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {service.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDuration(service.durationMinutes)}
                      {service.category && ` · ${service.category}`}
                    </p>
                  </div>
                  <span className="ml-3 shrink-0 text-sm font-semibold">
                    {formatCurrency(service.price)}
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
