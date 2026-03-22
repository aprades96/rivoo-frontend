const STEP_LABELS = ["Empleado", "Servicio", "Fecha y hora", "Cliente", "Confirmar"]

interface WizardProgressProps {
  currentStep: number
  totalSteps?: number
}

export function WizardProgress({ currentStep, totalSteps = 5 }: WizardProgressProps) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const stepNum = i + 1
        const isActive = stepNum === currentStep
        const isCompleted = stepNum < currentStep
        return (
          <div key={stepNum} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isCompleted
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {stepNum}
              </div>
              <span className="mt-0.5 hidden text-[10px] text-muted-foreground sm:block">
                {STEP_LABELS[i]}
              </span>
            </div>
            {stepNum < totalSteps && (
              <div
                className={`h-0.5 w-4 rounded-full transition-colors sm:w-6 ${
                  isCompleted ? "bg-primary/40" : "bg-muted"
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
