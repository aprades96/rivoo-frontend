import { cn } from "@/lib/utils"

const DEFAULT_STEP_LABELS = ["Servicio", "Profesional", "Fecha y hora", "Tus datos", "Confirmar"] as const

export interface WizardStepperProps {
  step: 1 | 2 | 3 | 4 | 5
  /** Defaults to the public booking wizard's five labels. */
  labels?: readonly string[]
  /**
   * Breakpoint from which the stepper becomes visible (`hidden` below it).
   * Defaults to `"md"`, today's public booking behaviour.
   */
  visibleFrom?: "md" | "lg"
  /**
   * Text color for a step already completed. Defaults to `"muted"`
   * (`text-muted-foreground`, `#7A6A5F`) -- the public booking wizard's
   * `.stepdone` color (`design/ReservaDesktopPaso3.dc.html:20`). The NuevaCita
   * artboards have no `.stepdone` at all: a completed step keeps the plain
   * `.step` color, `#B8A99C` (`design/NuevaCitaDesktopPaso3.dc.html:18,56,58`)
   * -- pass `"subtle"` for that.
   */
  completedTone?: "muted" | "subtle"
}

// Full, literal class strings per `visibleFrom` value -- Tailwind scans the
// source and would not see `hidden ${bp}:flex` built at runtime.
const VISIBLE_FROM_CLASSNAMES: Record<NonNullable<WizardStepperProps["visibleFrom"]>, string> = {
  md: "hidden items-center gap-2 md:flex xl:gap-3.5",
  lg: "hidden items-center gap-2 lg:flex xl:gap-3.5",
}

/**
 * Horizontal 5-node desktop stepper, hidden below `md:`. Values from
 * `design/ReservaDesktopPaso1.dc.html:50-60` and
 * `design/ReservaDesktopPaso2.dc.html:50-60`.
 *
 * Completed-label color: the public booking artboards disagree with each
 * other (D2 uses `#B8A99C`, D3 uses `#7A6A5F` -- see `.step` vs `.stepdone`
 * base color in their respective <style> blocks). D3 is the later artboard,
 * so `completedTone="muted"` (the default, `text-muted-foreground`) uses its
 * `#7A6A5F`. See `completedTone` for the NuevaCita override.
 */
export function WizardStepper({
  step,
  labels = DEFAULT_STEP_LABELS,
  visibleFrom = "md",
  completedTone = "muted",
}: WizardStepperProps) {
  return (
    // `gap` y conectores mas cortos hasta `xl:`, y las etiquetas sin partir.
    // A 1024 —donde el aside ya ocupa 320px de los 1024— los cinco nodos no
    // caben: "Fecha y hora" y "Tus datos" partian en dos lineas y "Confirmar"
    // quedaba cortado contra el aside. Lo vio la comparacion visual; ningun
    // test lo habria visto, porque jsdom no hace layout.
    <div className={VISIBLE_FROM_CLASSNAMES[visibleFrom]}>
      {labels.map((label, index) => {
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
                  index < step ? "bg-border-dashed" : "bg-border"
                )}
              />
            )}
            <div
              className={cn(
                "flex items-center gap-1.5 text-[13px] whitespace-nowrap",
                isActive
                  ? "font-semibold text-foreground"
                  : isCompleted
                    ? completedTone === "subtle"
                      ? "text-text-subtle"
                      : "text-muted-foreground"
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
                      : "border border-border-dashed"
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
