"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WizardProgress } from "@/components/appointments/wizard/wizard-progress"
import { EmployeeStep } from "@/components/appointments/wizard/employee-step"
import { ServiceStep } from "@/components/appointments/wizard/service-step"
import { DateTimeStep } from "@/components/appointments/wizard/datetime-step"
import { ClientStep } from "@/components/appointments/wizard/client-step"
import { ConfirmationStep } from "@/components/appointments/wizard/confirmation-step"
import { useWizardStore } from "@/lib/stores/wizard-store"

export default function NewAppointmentPage() {
  const router = useRouter()
  const { step, prevStep, reset } = useWizardStore()

  // Reset wizard on mount
  useEffect(() => {
    reset()
  }, [reset])

  const handleClose = () => {
    reset()
    router.back()
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b bg-background px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step > 1 ? (
              <Button variant="ghost" size="icon-sm" onClick={prevStep}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon-sm" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
            <h1 className="text-sm font-semibold">Nueva cita</h1>
          </div>
          <WizardProgress currentStep={step} />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 p-4">
        {step === 1 && <EmployeeStep />}
        {step === 2 && <ServiceStep />}
        {step === 3 && <DateTimeStep />}
        {step === 4 && <ClientStep />}
        {step === 5 && <ConfirmationStep />}
      </div>
    </div>
  )
}
