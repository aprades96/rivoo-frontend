"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { PageShell } from "@/components/layout/page-shell"
import { salonsApi } from "@/lib/api/salons"
import { useSalon } from "@/hooks/use-salon"
import { useAuth } from "@/hooks/use-auth"
import type { Salon } from "@/types/salon"

const EMPTY_FORM = {
  name: "",
  phone: "",
  description: "",
}

function formStateFrom(salon: Salon | undefined) {
  if (!salon) return EMPTY_FORM
  return {
    name: salon.name,
    phone: salon.phone,
    description: salon.description ?? "",
  }
}

export default function SalonSettingsPage() {
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()
  const { data: salon, isLoading } = useSalon()

  const [form, setForm] = useState(() => formStateFrom(salon))

  // Re-populate only when the loaded salon changes identity. Keying on the id
  // instead of the object identity means a background refetch (new object, same
  // salon) no longer wipes out what the user typed.
  const syncKey = salon?.id ?? null
  const [syncedKey, setSyncedKey] = useState(syncKey)
  if (syncKey !== syncedKey) {
    setSyncedKey(syncKey)
    setForm(formStateFrom(salon))
  }

  const mutation = useMutation({
    mutationFn: () =>
      salonsApi.update(
        {
          name: form.name || undefined,
          phone: form.phone || undefined,
          description: form.description || undefined,
        },
        accessToken!
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salon"] })
      toast.success("Salon actualizado")
    },
    onError: () => toast.error("Error al actualizar"),
  })

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  // `contentClassName` fija el ancho a `AjustesSalonDesktop.dc.html:115`
  // (tarjeta de 554px, formulario de una columna Nombre/Telefono/Descripcion
  // -- no `AjustesDesktop.dc.html`, que dibuja un formulario a dos/tres
  // columnas que esta pantalla no implementa): sin ella, `PageShell` la
  // estira a los 1084px que reserva para listas/tablas, y el boton "Guardar
  // cambios" (`w-full` mas abajo) queda absurdamente ancho. Se repite en el
  // estado de carga para que no cambien de ancho entre si al terminar de
  // cargar (mismo defecto que se arreglo en `settings/billing`).
  if (isLoading) {
    return (
      <PageShell title="Perfil del salon" back contentClassName="max-w-[554px]">
        <LoadingSkeleton count={4} />
      </PageShell>
    )
  }

  return (
    <PageShell title="Perfil del salon" back contentClassName="max-w-[554px]">
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Nombre</Label>
          <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Telefono</Label>
          <Input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Descripcion</Label>
          <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={3} />
        </div>

        {salon && (
          <div className="space-y-1 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <p><span className="font-medium">Slug:</span> {salon.slug}</p>
            <p><span className="font-medium">Email:</span> {salon.email}</p>
            <p><span className="font-medium">Direccion:</span> {salon.addressStreet}, {salon.addressCity} {salon.addressPostalCode}</p>
          </div>
        )}

        <Button className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar cambios
        </Button>
      </div>
    </PageShell>
  )
}
