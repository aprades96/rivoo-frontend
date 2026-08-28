"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Info } from "lucide-react"
import type { ReactNode } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { staffApi } from "@/lib/api/staff"
import { useAuth } from "@/hooks/use-auth"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { OnboardingFooter } from "../_components/onboarding-footer"
import {
  onboardingFieldClassName,
  onboardingLabelClassName,
  onboardingTextareaClassName,
} from "../_components/field-styles"

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

  const update = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }))

  const isValid = form.name && form.price && form.durationMinutes

  return (
    <>
      <div className="flex flex-col gap-[5px] md:gap-1.5">
        <h1 className="font-heading text-[26px] font-semibold leading-[1.12] tracking-display md:text-[32px] md:leading-[1.08]">
          Anade tu primer servicio
        </h1>
        <p className="text-[13px] leading-[1.5] text-muted-foreground md:hidden">
          Es lo que tus clientes veran al reservar.
        </p>
        <p className="hidden text-[14px] leading-[1.5] text-muted-foreground md:block">
          Es lo que tus clientes veran al reservar online.
        </p>
      </div>

      {/* Cuerpo identico en movil y escritorio: solo cambia el pie. */}
      <div className="flex flex-col gap-[13px]">
        <FieldGroup label="Nombre del servicio *">
          <Input
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Corte hombre, Tinte..."
            className={onboardingFieldClassName}
          />
        </FieldGroup>

        <FieldGroup label="Descripcion">
          <Textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Descripcion del servicio"
            className={onboardingTextareaClassName}
          />
        </FieldGroup>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="Duracion (min) *">
            <Input
              type="number"
              min="5"
              step="5"
              value={form.durationMinutes}
              onChange={(e) => update("durationMinutes", e.target.value)}
              placeholder="15"
              className={onboardingFieldClassName}
            />
          </FieldGroup>
          <FieldGroup label="Precio (EUR) *">
            <Input
              type="number"
              min="0"
              step="0.5"
              value={form.price}
              onChange={(e) => update("price", e.target.value)}
              placeholder="0,00"
              className={onboardingFieldClassName}
            />
          </FieldGroup>
        </div>

        <div className="flex items-center gap-[9px] rounded-lg border border-border bg-secondary px-[14px] py-3">
          <Info size={15} strokeWidth={1.75} className="shrink-0 text-muted-foreground" />
          <span className="text-xs leading-[1.45] text-muted-foreground">
            La duracion decide el tamano del hueco en la agenda y en la reserva online.
          </span>
        </div>
      </div>

      <OnboardingFooter
        ctaLabel="Continuar"
        onCta={() => mutation.mutate()}
        ctaDisabled={!isValid || mutation.isPending}
        ctaLoading={mutation.isPending}
        skipLabel="Omitir"
        onSkip={() => router.push("/complete")}
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
