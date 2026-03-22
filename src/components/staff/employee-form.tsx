"use client"

import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { staffApi } from "@/lib/api/staff"
import { useAuth } from "@/hooks/use-auth"
import type { Employee, CreateEmployeeRequest, UpdateEmployeeRequest } from "@/types/employee"

interface EmployeeFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: Employee | null // null = create mode
}

export function EmployeeFormSheet({ open, onOpenChange, employee }: EmployeeFormSheetProps) {
  const isEditing = !!employee
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    jobTitle: "",
    colorHex: "",
  })

  useEffect(() => {
    if (employee) {
      setForm({
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone ?? "",
        jobTitle: employee.jobTitle ?? "",
        colorHex: employee.colorHex ?? "",
      })
    } else {
      setForm({ firstName: "", lastName: "", email: "", phone: "", jobTitle: "", colorHex: "" })
    }
  }, [employee, open])

  const createMutation = useMutation({
    mutationFn: (data: CreateEmployeeRequest) =>
      staffApi.createEmployee(data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast.success("Empleado creado")
      onOpenChange(false)
    },
    onError: () => toast.error("Error al crear empleado"),
  })

  const updateMutation = useMutation({
    mutationFn: (data: UpdateEmployeeRequest) =>
      staffApi.updateEmployee(employee!.id, data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      queryClient.invalidateQueries({ queryKey: ["employee", employee!.id] })
      toast.success("Empleado actualizado")
      onOpenChange(false)
    },
    onError: () => toast.error("Error al actualizar empleado"),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = () => {
    if (!form.firstName || !form.lastName || !form.email) return

    const data = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone || undefined,
      jobTitle: form.jobTitle || undefined,
      colorHex: form.colorHex || undefined,
    }

    if (isEditing) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Editar empleado" : "Nuevo empleado"}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Nombre *</Label>
              <Input value={form.firstName} onChange={(e) => update("firstName", e.target.value)} placeholder="Nombre" />
            </div>
            <div>
              <Label className="text-xs">Apellidos *</Label>
              <Input value={form.lastName} onChange={(e) => update("lastName", e.target.value)} placeholder="Apellidos" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="email@ejemplo.com" />
          </div>
          <div>
            <Label className="text-xs">Telefono</Label>
            <Input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="612 345 678" />
          </div>
          <div>
            <Label className="text-xs">Puesto</Label>
            <Input value={form.jobTitle} onChange={(e) => update("jobTitle", e.target.value)} placeholder="Barbero, Estilista..." />
          </div>
          <div>
            <Label className="text-xs">Color identificativo</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.colorHex || "#3B82F6"}
                onChange={(e) => update("colorHex", e.target.value)}
                className="h-8 w-8 cursor-pointer rounded border"
              />
              <span className="text-xs text-muted-foreground">{form.colorHex || "Por defecto"}</span>
            </div>
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={isPending || !form.firstName || !form.lastName || !form.email}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Guardar cambios" : "Crear empleado"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
