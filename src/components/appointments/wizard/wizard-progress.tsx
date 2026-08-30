import { cn } from "@/lib/utils"

export interface WizardProgressProps {
  step: 1 | 2 | 3 | 4 | 5
  totalSteps?: number
}

/**
 * Cinco (o `totalSteps`) barras planas de progreso, MOVIL unicamente
 * (`design/NuevaCitaPaso1.dc.html:33-39`). Sin contador "N / 5": a
 * diferencia del progreso de la reserva publica (`MobileProgress` en
 * `booking-step-shell.tsx:231-247`), ningun artboard de este asistente lo
 * dibuja.
 *
 * Sin clase de visibilidad propia -- la monta o no `NewAppointmentShell`
 * segun el breakpoint, en JS, no aqui.
 */
export function WizardProgress({ step, totalSteps = 5 }: WizardProgressProps) {
  return (
    <div className="flex gap-[5px]">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={cn("h-[3px] flex-1 rounded-full", i < step ? "bg-primary" : "bg-border")}
        />
      ))}
    </div>
  )
}
