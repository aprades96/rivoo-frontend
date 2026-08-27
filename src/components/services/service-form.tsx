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
import { Textarea } from "@/components/ui/textarea"
import { staffApi } from "@/lib/api/staff"
import { useAuth } from "@/hooks/use-auth"
import type { ServiceOffering, CreateServiceRequest, UpdateServiceRequest } from "@/types/service"

interface ServiceFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  service: ServiceOffering | null
}

export function ServiceFormSheet({ open, onOpenChange, service }: ServiceFormSheetProps) {
  const isEditing = !!service
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()

  const [form, setForm] = useState({
    name: "",
    description: "",
    durationMinutes: "30",
    price: "",
    category: "",
  })

  useEffect(() => {
    if (service) {
      setForm({
        name: service.name,
        description: service.description ?? "",
        durationMinutes: String(service.durationMinutes),
        price: String(service.price),
        category: service.category ?? "",
      })
    } else {
      setForm({ name: "", description: "", durationMinutes: "30", price: "", category: "" })
    }
  }, [service, open])

  const createMutation = useMutation({
    mutationFn: (data: CreateServiceRequest) =>
      staffApi.createService(data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] })
      toast.success("Servicio creado")
      onOpenChange(false)
    },
    onError: () => toast.error("Error al crear servicio"),
  })

  const updateMutation = useMutation({
    mutationFn: (data: UpdateServiceRequest) =>
      staffApi.updateService(service!.id, data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] })
      toast.success("Servicio actualizado")
      onOpenChange(false)
    },
    onError: () => toast.error("Error al actualizar servicio"),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = () => {
    if (!form.name || !form.price || !form.durationMinutes) return

    const data = {
      name: form.name,
      // Sent as "" rather than omitted: the backend PUT merges by presence, so an
      // omitted key means "leave unchanged" and clearing the input would be ignored.
      description: form.description,
      durationMinutes: parseInt(form.durationMinutes),
      price: parseFloat(form.price),
      category: form.category,
    }

    if (isEditing) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const isValid = form.name && form.price && form.durationMinutes

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Editar servicio" : "Nuevo servicio"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-3 px-4 pb-4">
          <div>
            <Label className="text-xs">Nombre *</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Corte hombre, Tinte..." />
          </div>
          <div>
            <Label className="text-xs">Descripcion</Label>
            <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Descripcion del servicio" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Duracion (min) *</Label>
              <Input type="number" min="5" step="5" value={form.durationMinutes} onChange={(e) => update("durationMinutes", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Precio (EUR) *</Label>
              <Input type="number" min="0" step="0.5" value={form.price} onChange={(e) => update("price", e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Categoria</Label>
            <Input value={form.category} onChange={(e) => update("category", e.target.value)} placeholder="Corte, Color, Barba..." />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={isPending || !isValid}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Guardar cambios" : "Crear servicio"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
