"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { staffApi } from "@/lib/api/staff"
import { useAuth } from "@/hooks/use-auth"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"

export default function AddServicePage() {
  const router = useRouter()
  const { accessToken } = useAuth()
  const { setCurrentStep } = useOnboardingStore()

  useEffect(() => {
    setCurrentStep(4)
  }, [setCurrentStep])

  const [form, setForm] = useState({
    name: "",
    description: "",
    durationMinutes: "30",
    price: "",
  })

  const mutation = useMutation({
    mutationFn: () =>
      staffApi.createService(
        {
          name: form.name,
          description: form.description || undefined,
          durationMinutes: parseInt(form.durationMinutes),
          price: parseFloat(form.price),
        },
        accessToken!
      ),
    onSuccess: () => {
      toast.success("Servicio anadido")
      router.push("/complete")
    },
    onError: () => toast.error("Error al crear servicio"),
  })

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const isValid = form.name && form.price && form.durationMinutes

  return (
    <div className="space-y-4">
      <button
        onClick={() => router.push("/add-employee")}
        className="flex cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver
      </button>

      <div>
        <h2 className="text-lg font-semibold">Anade tu primer servicio</h2>
        <p className="text-sm text-muted-foreground">
          Puedes omitir este paso y anadirlo despues
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Nombre del servicio *</Label>
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
            <Input type="number" min="0" step="0.5" value={form.price} onChange={(e) => update("price", e.target.value)} placeholder="15" />
          </div>
        </div>

        <Button className="w-full" size="lg" onClick={() => mutation.mutate()} disabled={!isValid || mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Anadir y finalizar
        </Button>
      </div>

      <button
        className="w-full cursor-pointer py-2 text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => router.push("/complete")}
      >
        Omitir este paso
      </button>
    </div>
  )
}
