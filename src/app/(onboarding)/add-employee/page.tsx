"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import type { ReactNode } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { staffApi } from "@/lib/api/staff"
import { useAuth } from "@/hooks/use-auth"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { cn } from "@/lib/utils"
import { OnboardingFooter } from "../_components/onboarding-footer"
import {
  onboardingFieldClassName,
  onboardingLabelClassName,
} from "../_components/field-styles"

// Los cuatro colores de empleado del sistema (design/Onboarding3.dc.html:34),
// en el mismo orden que --chart-1..4 de globals.css.
const COLOR_SWATCHES = [
  { hex: "#B4522F", className: "bg-chart-1" },
  { hex: "#5C7A5E", className: "bg-chart-2" },
  { hex: "#4A6274", className: "bg-chart-3" },
  { hex: "#A8762F", className: "bg-chart-4" },
] as const

export default function AddEmployeePage() {
  const router = useRouter()
  const { accessToken } = useAuth()
  const { setCurrentStep } = useOnboardingStore()

  useEffect(() => {
    setCurrentStep(3)
  }, [setCurrentStep])

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    jobTitle: "",
    colorHex: COLOR_SWATCHES[0].hex as string,
    createAccount: false,
    password: "",
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
          colorHex: form.colorHex || undefined,
          createKeycloakAccount: form.createAccount || undefined,
          password: form.createAccount ? form.password : undefined,
        },
        accessToken!
      ),
    onSuccess: () => {
      toast.success("Empleado anadido")
      router.push("/add-service")
    },
    onError: () => toast.error("Error al crear empleado"),
  })

  const update = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const isValid =
    form.firstName && form.lastName && form.email && (!form.createAccount || form.password.length >= 8)

  return (
    <>
      <div className="flex flex-col gap-[5px] md:gap-1.5">
        <h1 className="font-heading text-[26px] font-semibold leading-[1.12] tracking-display md:text-[32px] md:leading-[1.08]">
          Anade tu primer empleado
        </h1>
        <p className="text-[13px] leading-[1.5] text-muted-foreground md:hidden">
          Puedes ser tu mismo. Anadiras mas cuando quieras.
        </p>
        <p className="hidden text-[14px] leading-[1.5] text-muted-foreground md:block">
          Puedes ser tu mismo. Anadiras mas cuando quieras desde Equipo.
        </p>
      </div>

      <div className="flex flex-col gap-[13px]">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Nombre *">
            <Input
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
              placeholder="Nombre"
              className={onboardingFieldClassName}
            />
          </FieldGroup>
          <FieldGroup label="Apellidos *">
            <Input
              value={form.lastName}
              onChange={(e) => update("lastName", e.target.value)}
              placeholder="Apellidos"
              className={onboardingFieldClassName}
            />
          </FieldGroup>
        </div>

        {/* `contents` en movil deja que Email y Telefono se apilen como
            hermanos sueltos del gap-13 del contenedor; en escritorio pasan a
            ser una rejilla de 2 columnas (design/Onboarding3Desktop.dc.html:36). */}
        <div className="contents md:grid md:grid-cols-2 md:gap-3">
          <FieldGroup label="Email *">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="email@ejemplo.com"
              className={onboardingFieldClassName}
            />
          </FieldGroup>
          <FieldGroup label="Telefono">
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="612 345 678"
              className={onboardingFieldClassName}
            />
          </FieldGroup>
        </div>

        <div className="contents md:grid md:grid-cols-2 md:gap-3">
          <FieldGroup label="Puesto">
            <Input
              value={form.jobTitle}
              onChange={(e) => update("jobTitle", e.target.value)}
              placeholder="Barbero, Estilista..."
              className={onboardingFieldClassName}
            />
          </FieldGroup>
          <FieldGroup label="Color identificativo">
            <div className="flex h-[42px] items-center gap-[10px]">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch.hex}
                  type="button"
                  aria-label={`Color ${swatch.hex}`}
                  aria-pressed={form.colorHex === swatch.hex}
                  onClick={() => update("colorHex", swatch.hex)}
                  className={cn(
                    "h-[30px] w-[30px] shrink-0 cursor-pointer rounded-full",
                    swatch.className,
                    form.colorHex === swatch.hex &&
                      "ring-2 ring-primary ring-offset-2 ring-offset-background"
                  )}
                />
              ))}
            </div>
          </FieldGroup>
        </div>

        <div className="h-px bg-hairline" />

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">Crear cuenta de acceso</span>
            <span className="text-xs text-muted-foreground">
              Podra entrar y ver su propia agenda
            </span>
          </div>
          <Switch
            checked={form.createAccount}
            onCheckedChange={(checked) => update("createAccount", checked)}
          />
        </div>

        {form.createAccount && (
          <FieldGroup label="Contrasena temporal *">
            <Input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder="Min. 8 caracteres"
              className={onboardingFieldClassName}
            />
          </FieldGroup>
        )}
      </div>

      <OnboardingFooter
        ctaLabel="Continuar"
        onCta={() => mutation.mutate()}
        ctaDisabled={!isValid || mutation.isPending}
        ctaLoading={mutation.isPending}
        skipLabel="Omitir"
        onSkip={() => router.push("/add-service")}
      />
    </>
  )
}

function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[5px]">
      <Label className={onboardingLabelClassName}>{label}</Label>
      {children}
    </div>
  )
}
