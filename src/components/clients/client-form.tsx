"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { ResponsiveFormModal } from "@/components/shared/responsive-form-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ApiError } from "@/lib/api/client"
import { clientsApi } from "@/lib/api/clients"
import { useAuth } from "@/hooks/use-auth"
import type { Client, CreateClientRequest, UpdateClientRequest } from "@/types/client"

// NOTA D19: no se renombra a pesar de que en escritorio ya no es una hoja
// (`ResponsiveFormModal` monta un `Dialog`). Renombrar obligaria a tocar los
// ficheros que la montan (`/clients` y `/clients/[id]`), que son de otras
// tareas de esta misma ola.
interface ClientFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: Client | null // null = create mode
}

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  notes: "",
}

const FALLBACK_CREATE_ERROR = "Error al crear cliente"
const FALLBACK_UPDATE_ERROR = "Error al actualizar cliente"

// §1.8: `.lbl` 12px/500 color `--label` -- deliberadamente distinto del
// formulario de empleado (12px/600 `--muted-foreground`, D17).
const LABEL_CLASS = "text-xs font-medium text-label"
// §1.8: `.fld` h 42, padding 0 12px, borde `--border`, radius 8, fondo `--card`.
const FIELD_CLASS = "h-[42px] rounded-lg border-border bg-card px-3 text-sm placeholder:text-text-subtle"
// §1.8: caja de Notas de 64px con line-height 1.45.
const NOTES_CLASS =
  "h-16 resize-none rounded-lg border-border bg-card px-3 py-3 text-[14px] leading-[1.45] placeholder:text-text-subtle"

function formStateFrom(client: Client | null) {
  if (!client) return EMPTY_FORM
  return {
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email ?? "",
    phone: client.phone ?? "",
    notes: client.notes ?? "",
  }
}

// D30: el toast muestra el `detail` real del `ProblemDetail` que `apiFetch`
// propaga (`src/lib/api/client.ts:96`), con el mensaje generico como respaldo.
function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError && error.problem.detail ? error.problem.detail : fallback
}

export function ClientFormSheet({ open, onOpenChange, client }: ClientFormSheetProps) {
  const isEditing = !!client
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()

  const [form, setForm] = useState(() => formStateFrom(client))

  // Re-populate only when the sheet is (re)opened or points at a different
  // client. Keying on the id instead of the object identity means a background
  // refetch (new object, same client) no longer wipes out what the user typed.
  const syncKey = `${open}:${client?.id ?? "new"}`
  const [syncedKey, setSyncedKey] = useState(syncKey)
  if (syncKey !== syncedKey) {
    setSyncedKey(syncKey)
    setForm(formStateFrom(client))
  }

  const createMutation = useMutation({
    mutationFn: (data: CreateClientRequest) => clientsApi.create(data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
      toast.success("Cliente creado")
      onOpenChange(false)
    },
    onError: (error) => toast.error(errorMessage(error, FALLBACK_CREATE_ERROR)),
  })

  const updateMutation = useMutation({
    mutationFn: (data: UpdateClientRequest) => clientsApi.update(client!.id, data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
      queryClient.invalidateQueries({ queryKey: ["client", client!.id] })
      toast.success("Cliente actualizado")
      onOpenChange(false)
    },
    onError: (error) => toast.error(errorMessage(error, FALLBACK_UPDATE_ERROR)),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  // D31: `trim()` en la validacion, para que un nombre de solo espacios no
  // pase el guard.
  const trimmedFirstName = form.firstName.trim()
  const trimmedLastName = form.lastName.trim()
  const isValid = trimmedFirstName !== "" && trimmedLastName !== ""

  // D32: `gender` existe en el backend pero ningun artboard de este bloque lo
  // dibuja -- no se monta aqui. Deuda anotada, no un olvido.
  //
  // Deuda anotada (§1.9, D31): un string vacio se manda como `undefined`, que
  // en un PUT significa "no tocar" y no "borrar" -- un email o telefono ya
  // guardado no se puede vaciar desde este formulario. Se documenta con un
  // test dedicado (`client-form.test.tsx`) en vez de cambiarse aqui, que
  // seria una decision de contrato de API fuera del alcance de esta tarea.
  const handleSubmit = () => {
    if (!isValid) return
    const data = {
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      notes: form.notes.trim() || undefined,
    }
    if (isEditing) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const update = (field: keyof typeof EMPTY_FORM, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar cliente" : "Nuevo cliente"}
      closeButtonVariant="bordered"
      footer={
        <Button
          size="2xl"
          className="h-12"
          onClick={handleSubmit}
          disabled={isPending || !isValid}
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? "Guardar cambios" : "Crear cliente"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1.5">
            <Label className={LABEL_CLASS}>Nombre *</Label>
            <Input
              className={FIELD_CLASS}
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
              placeholder="Nombre"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className={LABEL_CLASS}>Apellidos *</Label>
            <Input
              className={FIELD_CLASS}
              value={form.lastName}
              onChange={(e) => update("lastName", e.target.value)}
              placeholder="Apellidos"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className={LABEL_CLASS}>Email</Label>
          <Input
            className={FIELD_CLASS}
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="email@ejemplo.com"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className={LABEL_CLASS}>Telefono</Label>
          <Input
            className={FIELD_CLASS}
            type="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="612 345 678"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className={LABEL_CLASS}>Notas</Label>
          <Textarea
            className={NOTES_CLASS}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Notas internas sobre el cliente"
          />
        </div>
      </div>
    </ResponsiveFormModal>
  )
}
