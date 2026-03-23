"use client"

import { useState } from "react"
import { PlanComparison } from "@/components/register/plan-comparison"
import { RegisterForm } from "@/components/register/register-form"

type Step = "plans" | "form"

export type SelectedPlan = "FREE_TRIAL" | "BASIC" | "PREMIUM" | "ENTERPRISE"

export default function RegisterPage() {
  const [step, setStep] = useState<Step>("plans")
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan>("FREE_TRIAL")

  return step === "plans" ? (
    <PlanComparison
      selectedPlan={selectedPlan}
      onSelectPlan={setSelectedPlan}
      onContinue={() => setStep("form")}
    />
  ) : (
    <RegisterForm selectedPlan={selectedPlan} onBack={() => setStep("plans")} />
  )
}
