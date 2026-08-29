"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { PageShell } from "@/components/layout/page-shell"
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
    <Suspense
      fallback={
        <PageShell title="Equipo" mobileActions={null}>
          <LoadingSkeleton count={4} />
        </PageShell>
      }
    >
      <StaffPageContent />
    </Suspense>
  )
}

function StaffPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: employeesData, isLoading: empLoading } = useEmployees()
  const { data: servicesData, isLoading: svcLoading } = useServices()

  // Controlado por la URL en vez de `defaultValue`: el destino "Servicios" de
  // la barra lateral enlaza a `/staff?tab=services`, y estando ya en `/staff`
  // esa pulsacion es una navegacion de cliente dentro de la misma ruta -- el
  // componente no se remonta, asi que un `defaultValue` solo leido al montar
  // dejaria la URL y la barra lateral en Servicios con el contenido seguindo
  // en Empleados. Con `value` ligado a la query, cambia con ella.
  const tab = searchParams.get("tab") === "services" ? "services" : "employees"

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

  // Cluster de escritorio (`mobileActions={null}` lo oculta en movil, donde
  // el CTA vive en el cuerpo de cada pestana, ver `lg:hidden` mas abajo):
  // un solo boton que se adapta a la pestana activa, no dos apilados.
  const addAction = (
    <Button
      size="action"
      onClick={() => {
        if (tab === "services") {
          setEditingService(null)
          setServiceSheetOpen(true)
        } else {
          setEditingEmployee(null)
          setEmployeeSheetOpen(true)
        }
      }}
    >
      <Plus className="mr-1 h-4 w-4" />
      {tab === "services" ? "Anadir servicio" : "Anadir empleado"}
    </Button>
  )

  return (
    <PageShell title="Equipo" actions={addAction} mobileActions={null}>
      <Tabs
        value={tab}
        onValueChange={(value) =>
          router.replace(`/staff?tab=${value}`, { scroll: false })
        }
      >
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
            {/* Duplicaria el `addAction` de la cabecera de escritorio: solo movil. */}
            <Button
              size="action"
              className="lg:hidden"
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
            {/* Duplicaria el `addAction` de la cabecera de escritorio: solo movil. */}
            <Button
              size="action"
              className="lg:hidden"
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
    </PageShell>
  )
}
