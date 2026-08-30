"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageShell } from "@/components/layout/page-shell"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { EmployeeCard } from "@/components/staff/employee-card"
import { EmployeeTable } from "@/components/staff/employee-table"
import { ServiceCard } from "@/components/services/service-card"
import { EmployeeFormSheet } from "@/components/staff/employee-form"
import { ServiceFormSheet } from "@/components/services/service-form"
import { EmptyState } from "@/components/shared/empty-state"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { useEmployees, useServices } from "@/hooks/use-staff"
import { useMediaQuery } from "@/hooks/use-media-query"
import type { Employee } from "@/types/employee"
import type { ServiceOffering } from "@/types/service"

const DESKTOP_QUERY = "(min-width: 1024px)"

/**
 * Rotulo del contador de empleados (D8). Una sola fuente para las dos
 * cifras: `totalElements` para el total, la pagina (`content`) para el
 * desglose de activos -- asi no pueden contradecirse.
 *
 * `null` cuando no hay ningun empleado: ahi manda el `EmptyState`, no un
 * contador a cero.
 *
 * En movil nunca hay desglose (`Equipo.dc.html:49` solo dibuja el total). En
 * escritorio el desglose solo se pinta cuando es EXACTO: o la pagina ya
 * contiene un inactivo (por el orden `active DESC` del backend, eso implica
 * que todos los activos ya estan por encima, dentro de la pagina) o la
 * pagina contiene a todo el mundo (`totalElements === content.length`). En
 * cualquier otro caso -- página llena de activos con mas gente por debajo --
 * no hay forma de saber cuantos inactivos hay, y la pantalla se calla el
 * desglose en vez de inventarlo.
 */
function employeesCounterText(
  totalElements: number,
  content: Employee[],
  isDesktop: boolean
): string | null {
  if (totalElements === 0) return null

  const totalLabel = `${totalElements} empleado${totalElements !== 1 ? "s" : ""}`
  if (!isDesktop) return totalLabel

  const hasInactiveInPage = content.some((employee) => !employee.isActive)
  const showsBreakdown = hasInactiveInPage || totalElements === content.length
  if (!showsBreakdown) return totalLabel

  const activeCount = content.filter((employee) => employee.isActive).length
  return `${totalLabel} · ${activeCount} activo${activeCount !== 1 ? "s" : ""}`
}

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
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  // D10 "salvo que": `includeInactive` es un parametro de datos (B1), no un
  // control de UI -- se manda siempre en `true` y el desglose de activos se
  // calcula en cliente. Ningun artboard dibuja un filtro Activos/Todos.
  const { data: employeesData, isLoading: empLoading } = useEmployees({ includeInactive: true })
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
  const totalEmployees = employeesData?.totalElements ?? 0
  const services = servicesData?.content ?? []

  const handleServiceTap = (svc: ServiceOffering) => {
    setEditingService(svc)
    setServiceSheetOpen(true)
  }

  // Cluster de escritorio (`mobileActions={null}` lo oculta en movil, donde
  // el CTA vive en el cuerpo de cada panel, montado condicionalmente segun
  // `isDesktop` -- D28): un solo boton que se adapta a la pestana activa, no
  // dos apilados.
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
      {tab === "services" ? "Añadir servicio" : "Añadir empleado"}
    </Button>
  )

  const employeesCounter = employeesCounterText(totalEmployees, employees, isDesktop)

  return (
    <PageShell title="Equipo" actions={addAction} mobileActions={null}>
      <SegmentedControl
        variant="pill"
        aria-label="Secciones de Equipo"
        options={[
          { value: "employees", label: "Empleados" },
          { value: "services", label: "Servicios" },
        ]}
        value={tab}
        onChange={(value) => router.replace(`/staff?tab=${value}`, { scroll: false })}
      />

      {/* El panel es un condicional en JS, no un `TabsContent`: `SegmentedControl`
          (D7) es solo el control, no monta paneles. Se conserva el `role="tabpanel"`
          que los tests existentes afirman. */}
      {tab === "employees" ? (
        <div role="tabpanel" className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            {employeesCounter && (
              <p className="text-sm text-muted-foreground">{employeesCounter}</p>
            )}
            {/* Duplicaria el `addAction` de la cabecera de escritorio: solo movil.
                Montaje condicional en JS con `useMediaQuery` (D28), no `lg:hidden`. */}
            {!isDesktop && (
              <Button
                size="action"
                onClick={() => {
                  setEditingEmployee(null)
                  setEmployeeSheetOpen(true)
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                Añadir
              </Button>
            )}
          </div>

          {empLoading ? (
            <LoadingSkeleton count={4} />
          ) : totalEmployees === 0 ? (
            <EmptyState
              title="Sin empleados"
              description="Añade a tu primer miembro del equipo."
            />
          ) : isDesktop ? (
            <EmployeeTable employees={employees} />
          ) : (
            <div className="space-y-2">
              {employees.map((emp) => (
                <EmployeeCard key={emp.id} employee={emp} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div role="tabpanel" className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {services.length} servicio{services.length !== 1 ? "s" : ""}
            </p>
            {/* Duplicaria el `addAction` de la cabecera de escritorio: solo movil.
                Montaje condicional en JS con `useMediaQuery` (D28), no `lg:hidden`.
                El panel de Servicios se conserva intacto (D6): solo cambia el
                mecanismo de este boton, no su contenido. */}
            {!isDesktop && (
              <Button
                size="action"
                onClick={() => {
                  setEditingService(null)
                  setServiceSheetOpen(true)
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                Añadir
              </Button>
            )}
          </div>

          {svcLoading ? (
            <LoadingSkeleton count={4} />
          ) : services.length === 0 ? (
            <EmptyState
              title="Sin servicios"
              description="Añade tu primer servicio al catálogo."
            />
          ) : (
            services.map((svc) => (
              <ServiceCard key={svc.id} service={svc} onTap={handleServiceTap} />
            ))
          )}
        </div>
      )}

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
