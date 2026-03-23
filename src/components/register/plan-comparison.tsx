"use client"

import { Check, X, Users, Calendar, Mail, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { SelectedPlan } from "@/app/(auth)/register/page"

const plans: {
  key: SelectedPlan
  name: string
  price: string
  period: string
  description: string
  popular?: boolean
  features: {
    maxEmployees: string
    maxAppointments: string
    emailReminders: boolean
    smsReminders: boolean
  }
}[] = [
  {
    key: "FREE_TRIAL",
    name: "Prueba Gratuita",
    price: "0",
    period: "14 dias",
    description: "Perfecto para probar Rivoo sin compromiso",
    features: {
      maxEmployees: "1 empleado",
      maxAppointments: "50 citas/mes",
      emailReminders: false,
      smsReminders: false,
    },
  },
  {
    key: "BASIC",
    name: "Basic",
    price: "29",
    period: "/mes",
    description: "Para salones pequenos que empiezan",
    features: {
      maxEmployees: "3 empleados",
      maxAppointments: "200 citas/mes",
      emailReminders: true,
      smsReminders: false,
    },
  },
  {
    key: "PREMIUM",
    name: "Premium",
    price: "59",
    period: "/mes",
    description: "Para salones en crecimiento",
    popular: true,
    features: {
      maxEmployees: "10 empleados",
      maxAppointments: "Citas ilimitadas",
      emailReminders: true,
      smsReminders: true,
    },
  },
  {
    key: "ENTERPRISE",
    name: "Enterprise",
    price: "99",
    period: "/mes",
    description: "Para grandes salones y cadenas",
    features: {
      maxEmployees: "Empleados ilimitados",
      maxAppointments: "Citas ilimitadas",
      emailReminders: true,
      smsReminders: true,
    },
  },
]

function FeatureRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      {typeof value === "boolean" ? (
        <>
          <span className={value ? "text-foreground" : "text-muted-foreground line-through"}>{label}</span>
          {value ? (
            <Check className="ml-auto h-3.5 w-3.5 text-green-600" />
          ) : (
            <X className="ml-auto h-3.5 w-3.5 text-muted-foreground/50" />
          )}
        </>
      ) : (
        <>
          <span>{label}</span>
          <span className="ml-auto font-medium">{value}</span>
        </>
      )}
    </div>
  )
}

interface PlanComparisonProps {
  selectedPlan: SelectedPlan
  onSelectPlan: (plan: SelectedPlan) => void
  onContinue: () => void
}

export function PlanComparison({ selectedPlan, onSelectPlan, onContinue }: PlanComparisonProps) {
  const selected = plans.find((p) => p.key === selectedPlan)

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-bold">Elige el plan que mejor se adapte a ti</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Empieza con 14 dias gratis. Sin tarjeta de credito. Podras cambiar de plan en cualquier momento.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:grid-rows-[1fr_1fr]">
        {plans.map((plan) => {
          const isSelected = plan.key === selectedPlan
          return (
            <Card
              key={plan.key}
              className={[
                "cursor-pointer transition-all",
                plan.popular ? "pt-0" : "",
                isSelected
                  ? "ring-2 ring-primary"
                  : "hover:ring-1 hover:ring-foreground/20",
              ].join(" ")}
              onClick={() => onSelectPlan(plan.key)}
            >
              {plan.popular && (
                <div className="-mt-px rounded-t-xl bg-primary px-3 py-1.5 text-center text-xs font-medium text-primary-foreground">
                  Mas popular
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <div
                    className={[
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/30",
                    ].join(" ")}
                  >
                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                </div>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-2xl font-bold">{plan.price}€</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-xs text-muted-foreground">{plan.description}</p>
              </CardHeader>
              <CardContent className="mt-auto space-y-2">
                <FeatureRow icon={Users} label="Empleados" value={plan.features.maxEmployees} />
                <FeatureRow icon={Calendar} label="Citas" value={plan.features.maxAppointments} />
                <FeatureRow icon={Mail} label="Recordatorios email" value={plan.features.emailReminders} />
                <FeatureRow icon={MessageSquare} label="Recordatorios SMS" value={plan.features.smsReminders} />
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="space-y-2">
        <Button className="w-full" size="lg" onClick={onContinue}>
          {selectedPlan === "FREE_TRIAL"
            ? "Empieza gratis — 14 dias de prueba"
            : `Continuar con ${selected?.name} — ${selected?.price}€${selected?.period}`}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {selectedPlan === "FREE_TRIAL"
            ? "Todos los planes empiezan con 14 dias de prueba gratuita."
            : "Empezaras con 14 dias gratis. El cobro se realizara al finalizar la prueba."}
        </p>
      </div>
    </div>
  )
}
