"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { staffApi } from "@/lib/api/staff"
import { useAuth } from "@/hooks/use-auth"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"

export default function AddEmployeePage() {
  const router = useRouter()
  const { accessToken } = useAuth()
  const { setCurrentStep } = useOnboardingStore()

  useEffect(() => {
    setCurrentStep(4)
  }, [setCurrentStep])

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    jobTitle: "",
  })

  const mutation = useMutation({
    mutationFn: () =>
      staffApi.createEmployee(
        {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone || undefined,
          jobTitle: form.jobTitle || undefined,
        },
        accessToken!
      ),
    onSuccess: () => {
      toast.success("Empleado anadido")
      router.push("/add-service")
    },
    onError: () => toast.error("Error al crear empleado"),
  })

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const isValid = form.firstName && form.lastName && form.email

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Anade tu primer empleado</h2>
        <p className="text-sm text-muted-foreground">
          Puedes omitir este paso y anadirlo despues
        </p>
      </div>

      <div className="space-y-3">
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

        <Button className="w-full" size="lg" onClick={() => mutation.mutate()} disabled={!isValid || mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Anadir y continuar
        </Button>
      </div>

      <button
        className="w-full py-2 text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => router.push("/add-service")}
      >
        Omitir este paso
      </button>
    </div>
  )
}
