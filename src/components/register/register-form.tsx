"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { salonsApi } from "@/lib/api/salons"
import { ApiError } from "@/lib/api/client"
import type { SelectedPlan } from "@/app/(auth)/register/page"

const planLabels: Record<SelectedPlan, string> = {
  FREE_TRIAL: "Prueba Gratuita (14 dias)",
  BASIC: "Basic — 29€/mes",
  PREMIUM: "Premium — 59€/mes",
  ENTERPRISE: "Enterprise — 99€/mes",
}

interface RegisterFormProps {
  selectedPlan: SelectedPlan
  onBack: () => void
}

export function RegisterForm({ selectedPlan, onBack }: RegisterFormProps) {
  const router = useRouter()

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    addressStreet: "",
    addressCity: "Barcelona",
    addressPostalCode: "",
    ownerFirstName: "",
    ownerLastName: "",
    ownerPassword: "",
    ownerPasswordConfirm: "",
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: "" }))
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!form.ownerFirstName.trim()) newErrors.ownerFirstName = "El nombre es obligatorio"
    if (!form.ownerLastName.trim()) newErrors.ownerLastName = "El apellido es obligatorio"
    if (!form.email.trim()) newErrors.email = "El email es obligatorio"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = "Email no valido"
    if (!form.ownerPassword) newErrors.ownerPassword = "La contraseña es obligatoria"
    else if (form.ownerPassword.length < 8) newErrors.ownerPassword = "Minimo 8 caracteres"
    if (form.ownerPassword !== form.ownerPasswordConfirm) newErrors.ownerPasswordConfirm = "Las contraseñas no coinciden"
    if (!form.name.trim()) newErrors.name = "El nombre es obligatorio"
    if (!form.phone.trim()) newErrors.phone = "El telefono es obligatorio"
    if (!form.addressStreet.trim()) newErrors.addressStreet = "La direccion es obligatoria"
    if (!form.addressPostalCode.trim()) newErrors.addressPostalCode = "El codigo postal es obligatorio"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const mutation = useMutation({
    mutationFn: () =>
      salonsApi.register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        addressStreet: form.addressStreet,
        addressCity: form.addressCity || undefined,
        addressPostalCode: form.addressPostalCode,
        ownerFirstName: form.ownerFirstName,
        ownerLastName: form.ownerLastName,
        ownerPassword: form.ownerPassword,
      }),
    onSuccess: () => {
      toast.success("Cuenta creada correctamente")
      router.push("/login?registered=true")
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error(error.problem.detail || "Error al crear la cuenta")
      } else {
        toast.error("Error de conexion. Intentalo de nuevo.")
      }
    },
  })

  const handleSubmit = () => {
    if (validate()) {
      mutation.mutate()
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a planes
        </button>
        <div className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {planLabels[selectedPlan]}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold">Crea tu cuenta</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Completa los datos para empezar a usar Rivoo
        </p>
      </div>

      {/* Owner credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tus datos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Nombre *</Label>
              <Input
                value={form.ownerFirstName}
                onChange={(e) => update("ownerFirstName", e.target.value)}
                placeholder="Carlos"
                aria-invalid={!!errors.ownerFirstName}
              />
              {errors.ownerFirstName && <p className="mt-0.5 text-xs text-destructive">{errors.ownerFirstName}</p>}
            </div>
            <div>
              <Label className="text-xs">Apellido *</Label>
              <Input
                value={form.ownerLastName}
                onChange={(e) => update("ownerLastName", e.target.value)}
                placeholder="Garcia"
                aria-invalid={!!errors.ownerLastName}
              />
              {errors.ownerLastName && <p className="mt-0.5 text-xs text-destructive">{errors.ownerLastName}</p>}
            </div>
          </div>
          <div>
            <Label className="text-xs">Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="tu@email.com"
              aria-invalid={!!errors.email}
            />
            {errors.email && <p className="mt-0.5 text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Contraseña *</Label>
              <Input
                type="password"
                value={form.ownerPassword}
                onChange={(e) => update("ownerPassword", e.target.value)}
                placeholder="Min. 8 caracteres"
                aria-invalid={!!errors.ownerPassword}
              />
              {errors.ownerPassword && <p className="mt-0.5 text-xs text-destructive">{errors.ownerPassword}</p>}
            </div>
            <div>
              <Label className="text-xs">Confirmar *</Label>
              <Input
                type="password"
                value={form.ownerPasswordConfirm}
                onChange={(e) => update("ownerPasswordConfirm", e.target.value)}
                placeholder="Repetir contraseña"
                aria-invalid={!!errors.ownerPasswordConfirm}
              />
              {errors.ownerPasswordConfirm && <p className="mt-0.5 text-xs text-destructive">{errors.ownerPasswordConfirm}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Salon data */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Datos del salon</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Nombre del salon *</Label>
            <Input
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Mi Peluqueria"
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="mt-0.5 text-xs text-destructive">{errors.name}</p>}
          </div>
          <div>
            <Label className="text-xs">Telefono *</Label>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+34 612 345 678"
              aria-invalid={!!errors.phone}
            />
            {errors.phone && <p className="mt-0.5 text-xs text-destructive">{errors.phone}</p>}
          </div>
          <div>
            <Label className="text-xs">Direccion *</Label>
            <Input
              value={form.addressStreet}
              onChange={(e) => update("addressStreet", e.target.value)}
              placeholder="Calle Gran Via 123"
              aria-invalid={!!errors.addressStreet}
            />
            {errors.addressStreet && <p className="mt-0.5 text-xs text-destructive">{errors.addressStreet}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Ciudad</Label>
              <Input
                value={form.addressCity}
                onChange={(e) => update("addressCity", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Codigo postal *</Label>
              <Input
                value={form.addressPostalCode}
                onChange={(e) => update("addressPostalCode", e.target.value)}
                placeholder="08001"
                aria-invalid={!!errors.addressPostalCode}
              />
              {errors.addressPostalCode && <p className="mt-0.5 text-xs text-destructive">{errors.addressPostalCode}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creando cuenta...
            </>
          ) : selectedPlan === "FREE_TRIAL" ? (
            "Crear cuenta gratuita"
          ) : (
            `Crear cuenta — ${planLabels[selectedPlan]}`
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Al crear tu cuenta, aceptas los terminos de servicio y la politica de privacidad.
        </p>

        <div className="text-center text-sm">
          <span className="text-muted-foreground">Ya tienes cuenta? </span>
          <Link href="/login" className="font-medium text-primary hover:underline">
            Iniciar sesion
          </Link>
        </div>
      </div>
    </div>
  )
}
