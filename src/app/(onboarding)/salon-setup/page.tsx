"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { salonsApi } from "@/lib/api/salons"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { useAuth } from "@/hooks/use-auth"

export default function SalonSetupPage() {
  const router = useRouter()
  const { setCurrentStep, setSalonId } = useOnboardingStore()
  const { user } = useAuth()

  useEffect(() => {
    setCurrentStep(2)
  }, [setCurrentStep])

  const [form, setForm] = useState({
    name: "",
    slug: "",
    phone: "",
    description: "",
    addressStreet: "",
    addressCity: "Barcelona",
    addressPostalCode: "",
  })

  const mutation = useMutation({
    mutationFn: () =>
      salonsApi.register({
        name: form.name,
        slug: form.slug,
        ownerEmail: user?.email ?? "",
        phone: form.phone,
        description: form.description || undefined,
        addressStreet: form.addressStreet,
        addressCity: form.addressCity,
        addressPostalCode: form.addressPostalCode,
      }),
    onSuccess: (salon) => {
      setSalonId(salon.id)
      toast.success("Salon creado")
      router.push("/business-hours")
    },
    onError: () => toast.error("Error al crear el salon. Revisa los datos."),
  })

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    update("name", value)
    const slug = value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    update("slug", slug)
  }

  const isValid = form.name && form.slug && form.phone && form.addressStreet && form.addressCity && form.addressPostalCode

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Datos del salon</h2>
        <p className="text-sm text-muted-foreground">
          Informacion basica de tu negocio
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Nombre del salon *</Label>
          <Input value={form.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Mi Peluqueria" />
        </div>
        <div>
          <Label className="text-xs">URL de reservas *</Label>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">rivoo.com/book/</span>
            <Input value={form.slug} onChange={(e) => update("slug", e.target.value)} placeholder="mi-peluqueria" className="flex-1" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Telefono *</Label>
          <Input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="612 345 678" />
        </div>
        <div>
          <Label className="text-xs">Direccion *</Label>
          <Input value={form.addressStreet} onChange={(e) => update("addressStreet", e.target.value)} placeholder="Calle Gran Via 123" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Ciudad *</Label>
            <Input value={form.addressCity} onChange={(e) => update("addressCity", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Codigo postal *</Label>
            <Input value={form.addressPostalCode} onChange={(e) => update("addressPostalCode", e.target.value)} placeholder="08001" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Descripcion</Label>
          <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Cuentanos sobre tu salon..." rows={2} />
        </div>

        <Button className="w-full" size="lg" onClick={() => mutation.mutate()} disabled={!isValid || mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Siguiente
        </Button>
      </div>
    </div>
  )
}
