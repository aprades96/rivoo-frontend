"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { salonsApi } from "@/lib/api/salons"
import { useSalon } from "@/hooks/use-salon"
import { useAuth } from "@/hooks/use-auth"

export default function SalonSettingsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()
  const { data: salon, isLoading } = useSalon()

  const [form, setForm] = useState({
    name: "",
    phone: "",
    description: "",
  })

  useEffect(() => {
    if (salon) {
      setForm({
        name: salon.name,
        phone: salon.phone,
        description: salon.description ?? "",
      })
    }
  }, [salon])

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

  if (isLoading) return <div className="p-4"><LoadingSkeleton count={4} /></div>

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-sm font-semibold">Perfil del salon</h1>
      </div>

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
    </div>
  )
}
