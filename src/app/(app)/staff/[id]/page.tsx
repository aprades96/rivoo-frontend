"use client"

import { useState, use } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowLeft, Pencil, Trash2 } from "lucide-react"
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
import { WorkingHoursEditor } from "@/components/staff/working-hours-editor"
import { ServiceAssignment } from "@/components/staff/service-assignment"
import { EmployeeFormSheet } from "@/components/staff/employee-form"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
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

  const { data: employee, isLoading } = useQuery<Employee>({
    queryKey: ["employee", id],
    queryFn: () => staffApi.getEmployee(id, accessToken!),
    enabled: !!accessToken,
  })

  const { data: workingHours } = useQuery({
    queryKey: ["employee-working-hours", id],
    queryFn: () => staffApi.getWorkingHours(id, accessToken!),
    enabled: !!accessToken,
  })

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
      <div className="p-4">
        <LoadingSkeleton count={5} />
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-sm font-semibold">Detalle empleado</h1>
      </div>

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
          <p className="text-base font-semibold">
            {employee.firstName} {employee.lastName}
          </p>
          {employee.jobTitle && (
            <p className="text-sm text-muted-foreground">{employee.jobTitle}</p>
          )}
          <Badge variant={employee.isActive ? "secondary" : "outline"} className="mt-1">
            {employee.isActive ? "Activo" : "Inactivo"}
          </Badge>
        </div>
        {isOwner && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setEditSheetOpen(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setDeleteDialogOpen(true)}>
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
          <WorkingHoursEditor
            key={id}
            hours={workingHours}
            onSave={(hours) => saveHoursMutation.mutateAsync(hours)}
            isSaving={saveHoursMutation.isPending}
          />
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
    </div>
  )
}
