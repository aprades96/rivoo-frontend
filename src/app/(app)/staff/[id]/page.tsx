"use client"

import { useState, use } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PageShell } from "@/components/layout/page-shell"
import { WorkingHoursEditor } from "@/components/staff/working-hours-editor"
import { ServiceAssignment } from "@/components/staff/service-assignment"
import { EmployeeFormSheet } from "@/components/staff/employee-form"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { staffApi } from "@/lib/api/staff"
import { useAuth } from "@/hooks/use-auth"
import { useEmployeeServices } from "@/hooks/use-staff"
import { initials } from "@/lib/utils/format"
import type { Employee } from "@/types/employee"

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { accessToken, isOwner } = useAuth()

  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // router.back() no sirve aqui: esta pantalla se puede alcanzar sin pasar
  // por /staff (p.ej. enlace directo), y el destino fijo es esa lista, no
  // "lo que hubiera en el historial". Mismo motivo en desktopBack abajo.
  const backToStaff = () => router.push("/staff")

  const { data: employee, isLoading } = useQuery<Employee>({
    queryKey: ["employee", id],
    queryFn: () => staffApi.getEmployee(id, accessToken!),
    enabled: !!accessToken,
  })

  const {
    data: workingHours,
    isError: workingHoursFetchFailed,
    refetch: refetchWorkingHours,
  } = useQuery({
    queryKey: ["employee-working-hours", id],
    queryFn: () => staffApi.getWorkingHours(id, accessToken!),
    enabled: !!accessToken,
  })

  // The outer `isLoading || !employee` guard below only covers the employee
  // query. The working-hours query can still be undefined after that guard
  // clears (it resolves separately, possibly later), which would mount
  // WorkingHoursEditor on its DEFAULT_HOURS with an enabled "Guardar
  // horarios" button (isSaving only reflects the mutation, not this GET) --
  // clicking it before the real GET lands would overwrite the employee's
  // stored schedule. Same class of bug as business-hours/page.tsx
  // (onboarding); derived from data absence, not from a disabled query's
  // `isLoading`, which React Query v5 reports as false.
  const workingHoursNotReady = !accessToken || workingHours === undefined

  // Same terminal case as business-hours/page.tsx (onboarding): `retry:
  // failureCount < 1` caps retries at one, so after that `workingHours`
  // stays undefined forever and `workingHoursNotReady` alone would leave the
  // skeleton inside this tab forever. The back arrow in the header above and
  // the "Servicios" tab stay usable regardless, so the owner is never
  // trapped on this page -- they just need a way to retry the failed GET.
  const workingHoursFailed = !!accessToken && workingHoursFetchFailed

  const { data: employeeServices } = useEmployeeServices(id)

  const saveHoursMutation = useMutation({
    mutationFn: (hours: Parameters<typeof staffApi.updateWorkingHours>[1]) =>
      staffApi.updateWorkingHours(id, hours, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-working-hours", id] })
      toast.success("Horarios guardados")
    },
    onError: () => toast.error("Error al guardar horarios"),
  })

  const saveServicesMutation = useMutation({
    mutationFn: (serviceIds: string[]) =>
      staffApi.assignServices(id, { serviceIds }, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-services", id] })
      toast.success("Servicios actualizados")
    },
    onError: () => toast.error("Error al actualizar servicios"),
  })

  const deleteMutation = useMutation({
    mutationFn: () => staffApi.deleteEmployee(id, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast.success("Empleado desactivado")
      router.push("/staff")
    },
    onError: () => toast.error("Error al desactivar empleado"),
  })

  if (isLoading || !employee) {
    return (
      <PageShell
        title="Detalle empleado"
        back={backToStaff}
        desktopBack={{ variant: "bordered", onBack: backToStaff }}
      >
        <LoadingSkeleton count={5} />
      </PageShell>
    )
  }

  // Desviacion deliberada de los dos artboards (que dicen "Detalle
  // empleado"): el usuario decidio unificar los titulos y aqui se elige el
  // nombre del empleado por coherencia con la ficha de cliente. No reabrir.
  const headerActions = isOwner ? (
    <>
      <Button variant="outline" size="action" onClick={() => setEditSheetOpen(true)}>
        <Pencil className="mr-1 h-4 w-4" />
        Editar
      </Button>
      <Button variant="outline" size="action" onClick={() => setDeleteDialogOpen(true)}>
        <Trash2 className="mr-1 h-4 w-4 text-destructive" />
        Desactivar
      </Button>
    </>
  ) : undefined

  return (
    <PageShell
      title={`${employee.firstName} ${employee.lastName}`}
      back={backToStaff}
      desktopBack={{ variant: "bordered", onBack: backToStaff }}
      actions={headerActions}
      mobileActions={null}
    >
      {/* Profile */}
      <div className="flex items-center gap-3">
        <Avatar className="h-14 w-14">
          <AvatarFallback
            className="text-lg"
            style={employee.colorHex ? { backgroundColor: employee.colorHex + "20", color: employee.colorHex } : undefined}
          >
            {initials(employee.firstName, employee.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          {/* `DetalleEmpleado.dc.html:52` SI lleva el nombre aqui (17px/600),
              pero esa pantalla movil tambien lleva "Detalle empleado" en su
              propia cabecera -- dos textos distintos. Al unificar el titulo
              de PageShell con el nombre del empleado (decision del usuario,
              ver arriba), dejar esta linea lo duplicaria literalmente en
              movil (mismo texto en <h1> y aqui) y volveria ambiguas las
              consultas por texto; se quita como consecuencia de esa
              decision, no como atajo para callar un test. */}
          {employee.jobTitle && (
            <p className="text-sm text-muted-foreground">{employee.jobTitle}</p>
          )}
          <Badge variant={employee.isActive ? "secondary" : "outline"} className="mt-1">
            {employee.isActive ? "Activo" : "Inactivo"}
          </Badge>
        </div>
        {/* `mobileActions={null}` vacia la cabecera movil (igual que en
            /staff): en movil, Editar/Desactivar viven aqui como
            botones-icono 36x36 (`DetalleEmpleado.dc.html:57,60`), con
            `lg:hidden` porque en escritorio esos mismos destinos ya estan en
            la barra superior con etiqueta (`headerActions` arriba). */}
        {isOwner && (
          <div className="flex gap-1.5 lg:hidden">
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              aria-label="Editar"
              onClick={() => setEditSheetOpen(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-9 border-destructive-border"
              aria-label="Desactivar"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        )}
      </div>

      {/* Contact info */}
      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
        <p>{employee.email}</p>
        {employee.phone && <p>{employee.phone}</p>}
      </div>

      <Separator className="my-4" />

      {/* Tabs */}
      <Tabs defaultValue="hours">
        <TabsList>
          <TabsTrigger value="hours">Horarios</TabsTrigger>
          <TabsTrigger value="services">Servicios</TabsTrigger>
        </TabsList>

        <TabsContent value="hours" className="mt-4">
          {workingHoursFailed ? (
            <EmptyState
              title="No se ha podido cargar el horario"
              description="Comprueba tu conexion e intentalo de nuevo."
              action={<Button onClick={() => refetchWorkingHours()}>Reintentar</Button>}
            />
          ) : workingHoursNotReady ? (
            <LoadingSkeleton count={7} />
          ) : (
            <WorkingHoursEditor
              key={id}
              hours={workingHours}
              onSave={(hours) => saveHoursMutation.mutateAsync(hours)}
              isSaving={saveHoursMutation.isPending}
            />
          )}
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          <ServiceAssignment
            key={id}
            assignedServices={employeeServices}
            onSave={(ids) => saveServicesMutation.mutateAsync(ids)}
            isSaving={saveServicesMutation.isPending}
          />
        </TabsContent>
      </Tabs>

      {/* Edit sheet */}
      <EmployeeFormSheet
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        employee={employee}
      />

      {/* Delete dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desactivar empleado</DialogTitle>
            <DialogDescription>
              Se desactivara a {employee.firstName} {employee.lastName}. No podra recibir nuevas citas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              Desactivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
