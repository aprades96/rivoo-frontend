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
import { cn } from "@/lib/utils"
import type { Employee } from "@/types/employee"
import type { ServiceOffering } from "@/types/service"

const DESKTOP_QUERY = "(min-width: 1024px)"

// F2: mismo `size=100` que pide `staffApi.listEmployees` por defecto
// (`src/lib/api/staff.ts`) cuando `useEmployees()` no informa `size`.
const EMPLOYEES_PAGE_SIZE = 100

/**
 * Rótulo del contador de empleados (D8). Una sola fuente para las dos
 * cifras: `totalElements` para el total, la página (`content`) para el
 * desglose de activos -- así no pueden contradecirse.
 *
 * `null` cuando no hay ningún empleado: ahí manda el `EmptyState`, no un
 * contador a cero.
 *
 * En móvil nunca hay desglose (`Equipo.dc.html:49` solo dibuja el total). En
 * escritorio el desglose solo se pinta cuando es EXACTO: o la página ya
 * contiene un inactivo (por el orden `active DESC` del backend, eso implica
 * que todos los activos ya están por encima, dentro de la página) o la
 * página contiene a todo el mundo (`totalElements === content.length`). En
 * cualquier otro caso -- página llena de activos con más gente por debajo --
 * no hay forma de saber cuántos inactivos hay, y la pantalla se calla el
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

// `useSearchParams` exige un límite de Suspense propio (de lo contrario
// Next lo trata como error en build): el resto de la página no depende de
// la URL, así que el fallback solo cubre la lectura de `?tab=`.
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
  // D10 "salvo que": `includeInactive` es un parámetro de datos (B1), no un
  // control de UI -- se manda siempre en `true` y el desglose de activos se
  // calcula en cliente. Ningún artboard dibuja un filtro Activos/Todos.
  const {
    data: employeesData,
    isLoading: empLoading,
    isError: empError,
    refetch: refetchEmployees,
  } = useEmployees({ includeInactive: true })
  const {
    data: servicesData,
    isLoading: svcLoading,
    isError: svcError,
    refetch: refetchServices,
  } = useServices()

  // Controlado por la URL en vez de `defaultValue`: el destino "Servicios" de
  // la barra lateral enlaza a `/staff?tab=services`, y estando ya en `/staff`
  // esa pulsación es una navegación de cliente dentro de la misma ruta -- el
  // componente no se remonta, así que un `defaultValue` solo leído al montar
  // dejaría la URL y la barra lateral en Servicios con el contenido siguiendo
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

  // Cluster de escritorio (`mobileActions={null}` lo oculta en móvil, donde
  // el CTA vive en el cuerpo de cada panel, montado condicionalmente según
  // `isDesktop` -- D28): un solo botón que se adapta a la pestaña activa, no
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
  const servicesCounter = `${services.length} servicio${services.length !== 1 ? "s" : ""}`
  const activeTabCounter = tab === "services" ? servicesCounter : employeesCounter

  return (
    <PageShell title="Equipo" actions={addAction} mobileActions={null}>
      {/* M4: en escritorio el contador vive en la MISMA fila que el
          segmentado, a su derecha (EquipoDesktop.dc.html:92-97, space-between).
          En móvil va en su propia fila junto al CTA "Añadir" (Equipo.dc.html:39-53),
          debajo del segmentado -- ver el `!isDesktop` de cada panel. */}
      <div className={cn("flex items-center", isDesktop && "justify-between")}>
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
        {isDesktop && activeTabCounter && (
          <p className="text-[13px] leading-none tabular-nums text-muted-foreground">
            {activeTabCounter}
          </p>
        )}
      </div>

      {/* El panel es un condicional en JS, no un `TabsContent`: `SegmentedControl`
          (D7) es solo el control, no monta paneles. Se conserva el `role="tabpanel"`
          que los tests existentes afirman. */}
      {tab === "employees" ? (
        <div role="tabpanel" className="mt-4 flex flex-col gap-3.5 lg:gap-[18px]">
          {/* En escritorio el contador ya vive junto al segmentado (arriba):
              esta fila entera es solo móvil, Montaje condicional en JS con
              `useMediaQuery` (D28), no `lg:hidden`. */}
          {!isDesktop && (
            <div className="flex items-center justify-between">
              {employeesCounter && (
                <p className="text-[13px] leading-none tabular-nums text-muted-foreground">
                  {employeesCounter}
                </p>
              )}
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
            </div>
          )}

          {empLoading ? (
            <LoadingSkeleton count={4} />
          ) : empError ? (
            // F1: con la petición fallada, `data` queda `undefined` igual que
            // "sin empleados" -- sin esta rama, un fallo de staff-service se
            // veía idéntico a un salón vacío. `refetch` reintenta sin recargar
            // la página entera.
            <EmptyState
              title="No se ha podido cargar el equipo"
              description="Comprueba tu conexión e inténtalo de nuevo."
              action={<Button onClick={() => refetchEmployees()}>Reintentar</Button>}
            />
          ) : totalEmployees === 0 ? (
            <EmptyState
              title="Sin empleados"
              description="Añade a tu primer miembro del equipo."
            />
          ) : isDesktop ? (
            <EmployeeTable
              employees={employees}
              totalElements={totalEmployees}
              pageSize={EMPLOYEES_PAGE_SIZE}
            />
          ) : (
            <div className="space-y-2">
              {employees.map((emp) => (
                <EmployeeCard key={emp.id} employee={emp} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div role="tabpanel" className="mt-4 flex flex-col gap-3.5 lg:gap-[18px]">
          {/* En escritorio el contador ya vive junto al segmentado (arriba):
              esta fila entera es solo móvil. Montaje condicional en JS con
              `useMediaQuery` (D28), no `lg:hidden`. El panel de Servicios se
              conserva intacto (D6): solo cambia el mecanismo de este botón, no
              su contenido. */}
          {!isDesktop && (
            <div className="flex items-center justify-between">
              <p className="text-[13px] leading-none tabular-nums text-muted-foreground">
                {servicesCounter}
              </p>
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
            </div>
          )}

          {svcLoading ? (
            <LoadingSkeleton count={4} />
          ) : svcError ? (
            // F1: mismo caso que en el panel de Empleados -- sin esta rama,
            // un fallo de staff-service afirmaba "Sin servicios".
            <EmptyState
              title="No se han podido cargar los servicios"
              description="Comprueba tu conexión e inténtalo de nuevo."
              action={<Button onClick={() => refetchServices()}>Reintentar</Button>}
            />
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
