import { cn } from "@/lib/utils"

const STEP_LABELS = ["Servicio", "Profesional", "Fecha y hora", "Tus datos", "Confirmar"] as const

interface BookingStepperProps {
  step: 1 | 2 | 3 | 4 | 5
}

/**
 * Horizontal 5-node desktop stepper, hidden below `md:`. Values from
 * `design/ReservaDesktopPaso1.dc.html:50-60` and
 * `design/ReservaDesktopPaso2.dc.html:50-60`.
 *
 * Completed-label color: the artboards disagree with each other (D2 uses
 * `#B8A99C`, D3 uses `#7A6A5F` -- see `.step` vs `.stepdone` base color in
 * their respective <style> blocks). D3 is the later artboard, so this uses
 * its `#7A6A5F` (== `text-muted-foreground`) for completed labels.
 */
export function BookingStepper({ step }: BookingStepperProps) {
  return (
    // `gap` y conectores mas cortos hasta `xl:`, y las etiquetas sin partir.
    // A 1024 —donde el aside ya ocupa 320px de los 1024— los cinco nodos no
    // caben: "Fecha y hora" y "Tus datos" partian en dos lineas y "Confirmar"
    // quedaba cortado contra el aside. Lo vio la comparacion visual; ningun
    // test lo habria visto, porque jsdom no hace layout.
    <div className="hidden items-center gap-2 md:flex xl:gap-3.5">
      {STEP_LABELS.map((label, index) => {
        const stepNumber = index + 1
        const isActive = stepNumber === step
        const isCompleted = stepNumber < step

        return (
          <div key={label} className="flex items-center gap-2 xl:gap-3.5">
            {index > 0 && (
              <div
                className={cn(
                  "h-px w-3 xl:w-[26px]",
                  // Completado = el paso a su izquierda ya se supero.
                  index < step ? "bg-[#D8C9B8]" : "bg-border"
                )}
              />
            )}
            <div
              className={cn(
                "flex items-center gap-1.5 text-[13px] whitespace-nowrap",
                isActive
                  ? "font-semibold text-foreground"
                  : isCompleted
                    ? "text-muted-foreground"
                    : "text-text-subtle"
              )}
            >
              <span
                className={cn(
                  "flex size-[22px] items-center justify-center rounded-full text-[11px] font-bold",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isCompleted
                      ? "bg-success-soft text-success"
                      : "border border-[#D8C9B8]"
                )}
              >
                {isCompleted ? (
                  <svg
                    width={12}
                    height={12}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  stepNumber
                )}
              </span>
              {label}
            </div>
          </div>
        )
      })}
    </div>
  )
}
