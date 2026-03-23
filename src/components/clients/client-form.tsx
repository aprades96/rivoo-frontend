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
import { clientsApi } from "@/lib/api/clients"
import { useAuth } from "@/hooks/use-auth"
import type { Client, CreateClientRequest, UpdateClientRequest } from "@/types/client"

interface ClientFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: Client | null
}

export function ClientFormSheet({ open, onOpenChange, client }: ClientFormSheetProps) {
  const isEditing = !!client
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    notes: "",
  })

  useEffect(() => {
    if (client) {
      setForm({
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email ?? "",
        phone: client.phone ?? "",
        notes: client.notes ?? "",
      })
    } else {
      setForm({ firstName: "", lastName: "", email: "", phone: "", notes: "" })
    }
  }, [client, open])

  const createMutation = useMutation({
    mutationFn: (data: CreateClientRequest) =>
      clientsApi.create(data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
      toast.success("Cliente creado")
      onOpenChange(false)
    },
    onError: () => toast.error("Error al crear cliente"),
  })

  const updateMutation = useMutation({
    mutationFn: (data: UpdateClientRequest) =>
      clientsApi.update(client!.id, data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
      queryClient.invalidateQueries({ queryKey: ["client", client!.id] })
      toast.success("Cliente actualizado")
      onOpenChange(false)
    },
    onError: () => toast.error("Error al actualizar cliente"),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = () => {
    if (!form.firstName || !form.lastName) return
    const data = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email || undefined,
      phone: form.phone || undefined,
      notes: form.notes || undefined,
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
          <SheetTitle>{isEditing ? "Editar cliente" : "Nuevo cliente"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-4">
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
            <Label className="text-xs">Email</Label>
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="email@ejemplo.com" />
          </div>
          <div>
            <Label className="text-xs">Telefono</Label>
            <Input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="612 345 678" />
          </div>
          <div>
            <Label className="text-xs">Notas</Label>
            <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Notas internas sobre el cliente" rows={2} />
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={isPending || !form.firstName || !form.lastName}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Guardar cambios" : "Crear cliente"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
