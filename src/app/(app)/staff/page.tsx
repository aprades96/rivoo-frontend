"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { EmployeeCard } from "@/components/staff/employee-card"
import { ServiceCard } from "@/components/services/service-card"
import { EmployeeFormSheet } from "@/components/staff/employee-form"
import { ServiceFormSheet } from "@/components/services/service-form"
import { EmptyState } from "@/components/shared/empty-state"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { useEmployees, useServices } from "@/hooks/use-staff"
import type { Employee } from "@/types/employee"
import type { ServiceOffering } from "@/types/service"

// `useSearchParams` exige un limite de Suspense propio (de lo contrario
// Next lo trata como error en build): el resto de la pagina no depende de
// la URL, asi que el fallback solo cubre la lectura de `?tab=`.
export default function StaffPage() {
  return (
    <Suspense fallback={<div className="p-4 md:py-6"><LoadingSkeleton count={4} /></div>}>
      <StaffPageContent />
    </Suspense>
  )
}

function StaffPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: employeesData, isLoading: empLoading } = useEmployees()
  const { data: servicesData, isLoading: svcLoading } = useServices()

  // `?tab=services` deja aterrizar directamente en la pestana de Servicios
  // (p.ej. desde el "Crear servicio" de /today): sin esto siempre se abria
  // en Empleados, que es donde no hay nada que crear para ese caso de uso.
  // Cualquier otro valor (o su ausencia) mantiene el comportamiento previo.
  const initialTab = searchParams.get("tab") === "services" ? "services" : "employees"

  const [employeeSheetOpen, setEmployeeSheetOpen] = useState(false)
  const [serviceSheetOpen, setServiceSheetOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [editingService, setEditingService] = useState<ServiceOffering | null>(null)

  const employees = employeesData?.content ?? []
  const services = servicesData?.content ?? []

  const handleEmployeeTap = (emp: Employee) => {
    router.push(`/staff/${emp.id}`)
  }

  const handleServiceTap = (svc: ServiceOffering) => {
    setEditingService(svc)
    setServiceSheetOpen(true)
  }

  return (
    <div className="p-4 md:py-6">
      <Tabs defaultValue={initialTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="employees">Empleados</TabsTrigger>
            <TabsTrigger value="services">Servicios</TabsTrigger>
          </TabsList>
        </div>

        {/* Employees tab */}
        <TabsContent value="employees" className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {employees.length} empleado{employees.length !== 1 ? "s" : ""}
            </p>
            <Button
              size="sm"
              onClick={() => {
                setEditingEmployee(null)
                setEmployeeSheetOpen(true)
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              Anadir
            </Button>
          </div>

          {empLoading ? (
            <LoadingSkeleton count={4} />
          ) : employees.length === 0 ? (
            <EmptyState
              title="Sin empleados"
              description="Anade a tu primer miembro del equipo."
            />
          ) : (
            employees.map((emp) => (
              <EmployeeCard
                key={emp.id}
                employee={emp}
                onTap={handleEmployeeTap}
              />
            ))
          )}
        </TabsContent>

        {/* Services tab */}
        <TabsContent value="services" className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {services.length} servicio{services.length !== 1 ? "s" : ""}
            </p>
            <Button
              size="sm"
              onClick={() => {
                setEditingService(null)
                setServiceSheetOpen(true)
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              Anadir
            </Button>
          </div>

          {svcLoading ? (
            <LoadingSkeleton count={4} />
          ) : services.length === 0 ? (
            <EmptyState
              title="Sin servicios"
              description="Anade tu primer servicio al catalogo."
            />
          ) : (
            services.map((svc) => (
              <ServiceCard
                key={svc.id}
                service={svc}
                onTap={handleServiceTap}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      <EmployeeFormSheet
        open={employeeSheetOpen}
        onOpenChange={setEmployeeSheetOpen}
        employee={editingEmployee}
      />
      <ServiceFormSheet
        open={serviceSheetOpen}
        onOpenChange={setServiceSheetOpen}
        service={editingService}
      />
    </div>
  )
}
