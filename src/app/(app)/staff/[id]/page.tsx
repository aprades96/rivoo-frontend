"use client"

import { useState, use } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Pencil, Trash2, Mail, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
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
import { SegmentedControl } from "@/components/shared/segmented-control"
import { WorkingHoursEditor } from "@/components/staff/working-hours-editor"
import { ServiceAssignment } from "@/components/staff/service-assignment"
import { EmployeeColor } from "@/components/staff/employee-color"
import { EmployeeFormSheet } from "@/components/staff/employee-form"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { staffApi } from "@/lib/api/staff"
import { useAuth } from "@/hooks/use-auth"
import { useEmployeeServices } from "@/hooks/use-staff"
import { useMediaQuery } from "@/hooks/use-media-query"
import { initials, formatPhone } from "@/lib/utils/format"
import { employeeAvatarStyle } from "@/lib/utils/avatar"
import type { Employee } from "@/types/employee"

const DESKTOP_QUERY = "(min-width: 1024px)"

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { accessToken, isOwner } = useAuth()
  // D12/D28: the layout itself branches by width (three fixed cards on
  // desktop, stacked sections + a segmented control on mobile) -- montaje
  // condicional en JS, never `lg:hidden` (the trap AGENTS.md/§1.13 warns
  // about: jsdom never applies CSS, so a hidden duplicate tree keeps
  // breaking `getByRole` queries and hiding real coverage gaps).
  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [mobileSection, setMobileSection] = useState<"hours" | "services">("hours")

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

  const {
    data: employeeServices,
    isError: employeeServicesFetchFailed,
    refetch: refetchEmployeeServices,
  } = useEmployeeServices(id)

  // D16/§1.11.2: exact same class of bug as `workingHoursNotReady` above --
  // and the one the 400 of §1.11.1 used to mask entirely. While this GET is
  // in flight, `assignedServices` is `undefined`, ServiceAssignment starts
  // every box unchecked, and its "Guardar servicios" button is enabled
  // (`isSaving` only reflects the mutation, not this GET). Ticking a single
  // box and saving at that point would REPLACE the employee's real
  // assignment with just that one service: `assignServices` deletes before
  // recreating (EmployeeService.java). Guarding on data absence -- not a
  // disabled query's `isLoading`, which React Query v5 reports as false --
  // keeps ServiceAssignment unmounted until the real list has actually
  // landed, exactly like the working-hours guard above.
  const employeeServicesNotReady = !accessToken || employeeServices === undefined
  const employeeServicesFailed = !!accessToken && employeeServicesFetchFailed

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
      staffApi.assignServices(
        id,
        { services: serviceIds.map((serviceId) => ({ serviceId })) },
        accessToken!
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-services", id] })
      toast.success("Servicios actualizados")
    },
    onError: () => toast.error("Error al actualizar servicios"),
  })

  const deleteMutation = useMutation({
    mutationFn: () => staffApi.deleteEmployee(id, accessToken!),
    onSuccess: () => {
      // Las cuatro claves que este empleado puede haber poblado (§1.9): antes
      // solo se invalidaba "employees", asi que un empleado desactivado
      // seguia apareciendo con sus horarios/servicios viejos en cualquier
      // cache que sobreviviera a la navegacion (p.ej. al volver atras).
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      queryClient.invalidateQueries({ queryKey: ["employee", id] })
      queryClient.invalidateQueries({ queryKey: ["employee-working-hours", id] })
      queryClient.invalidateQueries({ queryKey: ["employee-services", id] })
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

  const hoursContent = workingHoursFailed ? (
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
  )

  const servicesContent = (title?: string) =>
    employeeServicesFailed ? (
      <EmptyState
        title="No se han podido cargar los servicios"
        description="Comprueba tu conexion e intentalo de nuevo."
        action={<Button onClick={() => refetchEmployeeServices()}>Reintentar</Button>}
      />
    ) : employeeServicesNotReady ? (
      <LoadingSkeleton count={6} />
    ) : (
      <ServiceAssignment
        key={id}
        title={title}
        assignedServices={employeeServices}
        onSave={(ids) => saveServicesMutation.mutateAsync(ids)}
        isSaving={saveServicesMutation.isPending}
      />
    )

  return (
    <PageShell
      title={`${employee.firstName} ${employee.lastName}`}
      back={backToStaff}
      desktopBack={{ variant: "bordered", onBack: backToStaff }}
      actions={headerActions}
      mobileActions={null}
      // D12: las tres tarjetas de escritorio (300 + 24 + 386 + 24 + 372 =
      // 1106px) no caben bajo el `max-w-[1084px]` que trae `PageShell` por
      // defecto para las otras once pantallas. `contentClassName` SUSTITUYE
      // ese ancho (no se suma), y en la rama movil se filtra solo por ser un
      // token `max-w-`, dejando `gap-[18px]` intacto en los dos anchos.
      contentClassName="max-w-[1106px] gap-[18px]"
    >
      {isDesktop ? (
        <div className="flex gap-6">
          {/* Tarjeta 1: perfil (DetalleEmpleadoDesktop.dc.html:111-144) */}
          <div className="flex w-[300px] shrink-0 flex-col gap-4 rounded-xl border border-border bg-white p-5">
            <div className="flex items-center gap-3.5">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-[21px]" style={employeeAvatarStyle(employee.colorHex)}>
                  {initials(employee.firstName, employee.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col gap-1">
                {employee.jobTitle && (
                  <p className="text-[13px] text-muted-foreground">{employee.jobTitle}</p>
                )}
                <Badge variant={employee.isActive ? "secondary" : "outline"} className="self-start">
                  {employee.isActive ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </div>

            <Separator className="bg-hairline" />

            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Mail className="size-[15px] shrink-0" strokeWidth={1.75} />
                <span className="text-[13px]">{employee.email}</span>
              </div>
              {employee.phone && (
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <Phone className="size-[15px] shrink-0" strokeWidth={1.75} />
                  <span className="text-[13px] tabular-nums">{formatPhone(employee.phone)}</span>
                </div>
              )}
            </div>

            <Separator className="bg-hairline" />

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Color identificativo</span>
              <EmployeeColor colorHex={employee.colorHex} shape="square-sm" showHex />
              <span className="text-[11px] leading-[1.45] text-muted-foreground-2">
                Colorea su avatar en las listas y en el filtro de la agenda.
              </span>
            </div>
          </div>

          {/* Tarjeta 2: horario semanal (DetalleEmpleadoDesktop.dc.html:146-231) */}
          <div className="flex w-[386px] shrink-0 flex-col gap-3 rounded-xl border border-border bg-white p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold leading-tight">Horario semanal</span>
              <span className="text-xs text-muted-foreground">
                Horas propias de {employee.firstName}
              </span>
            </div>
            {hoursContent}
          </div>

          {/* Tarjeta 3: servicios (DetalleEmpleadoDesktop.dc.html:233-301) */}
          <div className="w-[372px] shrink-0 rounded-xl border border-border bg-white p-5">
            {servicesContent("Servicios que realiza")}
          </div>
        </div>
      ) : (
        <>
          {/* Identidad (DetalleEmpleado.dc.html:49-54) */}
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="text-lg" style={employeeAvatarStyle(employee.colorHex)}>
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
                montaje condicional en JS (D28) porque en escritorio esos
                mismos destinos ya estan en la barra superior con etiqueta
                (`headerActions` arriba). */}
            {isOwner && (
              <div className="flex gap-1.5">
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

          {/* Contacto (DetalleEmpleado.dc.html:66-74) */}
          <div className="mt-3 flex flex-col gap-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Mail className="size-3.5 shrink-0" strokeWidth={1.75} />
              <span>{employee.email}</span>
            </div>
            {employee.phone && (
              <div className="flex items-center gap-2">
                <Phone className="size-3.5 shrink-0" strokeWidth={1.75} />
                <span className="tabular-nums">{formatPhone(employee.phone)}</span>
              </div>
            )}
          </div>

          {/* Color (DetalleEmpleado.dc.html:75-81) */}
          <div className="mt-3 flex flex-col gap-1.5">
            <EmployeeColor colorHex={employee.colorHex} shape="dot-sm" showHex />
            <span className="text-xs text-text-subtle">Color identificativo</span>
          </div>

          <Separator className="my-4 bg-hairline" />

          <SegmentedControl
            variant="pill"
            aria-label="Secciones de detalle de empleado"
            options={[
              { value: "hours", label: "Horarios" },
              { value: "services", label: "Servicios" },
            ]}
            value={mobileSection}
            onChange={setMobileSection}
          />

          {/* Montaje condicional en JS (D28): un solo panel presente en el DOM
              a la vez, nunca los dos con uno escondido por CSS. */}
          <div className="mt-4">{mobileSection === "hours" ? hoursContent : servicesContent()}</div>
        </>
      )}

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
