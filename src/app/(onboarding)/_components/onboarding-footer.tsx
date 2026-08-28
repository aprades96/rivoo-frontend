"use client"

import { ArrowRight, Loader2 } from "lucide-react"

interface OnboardingFooterProps {
  ctaLabel: string
  onCta: () => void
  ctaDisabled?: boolean
  ctaLoading?: boolean
  skipLabel?: string
  onSkip?: () => void
}

/**
 * Pie de acciones comun a los cinco pasos del onboarding
 * (`design/Onboarding1.dc.html:11` clases `.cta` / `.ghost`).
 * Movil: pegado al fondo (`margin-top:auto`), CTA `flex-grow:2`, Omitir
 * `flex-grow:1`. Escritorio: alineado a la derecha, anchos por padding.
 */
export function OnboardingFooter({
  ctaLabel,
  onCta,
  ctaDisabled = false,
  ctaLoading = false,
  skipLabel,
  onSkip,
}: OnboardingFooterProps) {
  return (
    <div className="mt-auto flex gap-2.5 md:mt-0 md:justify-end">
      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="flex h-12 flex-grow items-center justify-center rounded-lg border border-border bg-white text-[15px] font-semibold text-foreground md:flex-none md:px-6"
        >
          {skipLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onCta}
        disabled={ctaDisabled}
        className="flex h-12 flex-grow-[2] items-center justify-center gap-2 rounded-lg bg-primary text-[15px] font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60 md:flex-none md:px-7"
      >
        {ctaLoading && <Loader2 size={16} className="animate-spin" />}
        {ctaLabel}
        <ArrowRight size={16} strokeWidth={2} />
      </button>
    </div>
  )
}
