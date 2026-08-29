import type { ReactNode } from "react"
import { Fragment } from "react"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface BookingSummaryRow {
  label: string
  /** `undefined`/`null`/`""` renders the `--text-placeholder` "—" instead. */
  value?: ReactNode
  /** Secondary line under the value, e.g. "1h 30min · 65,00 €" (step 2/4/5 "Servicio" row). */
  detail?: ReactNode
}

export interface BookingSummaryAsideProps {
  /**
   * Flat label/value rows (steps 2, 4 and 5:
   * `design/ReservaDesktopPaso2.dc.html:102-108`,
   * `design/ReservaDesktopPaso5.dc.html:85-93`). Mutually exclusive with
   * `body` -- pass one or the other, never both.
   */
  rows?: BookingSummaryRow[]
  /**
   * Escape hatch for step 3's richer layout (service card + avatar row + time
   * block, `design/ReservaDesktopPaso3.dc.html:157-180`), which doesn't fit
   * the label/value row shape. The caller builds that markup; this component
   * only wraps it in the same card/CTA/trust-note frame. Mutually exclusive
   * with `rows`.
   */
  body?: ReactNode
  /** "Total" row, step 5 only -- rendered at 20px after the rows/separators. */
  total?: string
  ctaLabel: string
  ctaDisabled?: boolean
  onCtaClick?: () => void
  /** 46px everywhere except step 3, which asks for 48px (`ReservaDesktopPaso3.dc.html:182`). */
  ctaHeight?: 46 | 48
}

/**
 * Right-column card for booking steps 2-5: the booking summary plus the CTA
 * that advances the wizard. Paints itself only -- `BookingStepShell` (the
 * chassis) owns width and position via its `aside` slot. Not wired to any
 * step yet; that is each step task's job.
 */
export function BookingSummaryAside({
  rows,
  body,
  total,
  ctaLabel,
  ctaDisabled = false,
  onCtaClick,
  ctaHeight = 46,
}: BookingSummaryAsideProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-[22px]">
      <span className="text-xs font-semibold tracking-[0.06em] text-muted-foreground-2 uppercase">
        Tu reserva
      </span>

      {body ?? (
        <>
          {rows?.map((row, index) => (
            <Fragment key={row.label}>
              <SummaryRow row={row} />
              {(index < rows.length - 1 || total !== undefined) && <div className="h-px bg-hairline" />}
            </Fragment>
          ))}

          {total !== undefined && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground-2">Total</span>
              <span className="text-xl font-semibold tabular-nums">{total}</span>
            </div>
          )}
        </>
      )}

      {/*
        `xl` already carries the 15px/600 label and the color logic
        (default/hover/pressed/disabled, including `disabled:bg-primary-disabled`)
        -- overridden here only on height and width, never on color, per brief.
      */}
      <Button
        size="xl"
        className={cn("mt-1 w-full", ctaHeight === 48 ? "h-12" : "h-[46px]")}
        disabled={ctaDisabled}
        onClick={onCtaClick}
      >
        {ctaLabel}
      </Button>

      <div className="flex items-center justify-center gap-[7px]">
        <Lock className="size-[13px] text-muted-foreground-2" aria-hidden="true" />
        <span className="text-[11px] text-muted-foreground-2">
          Sin registro &middot; cancela gratis hasta 24h antes
        </span>
      </div>
    </div>
  )
}

function SummaryRow({ row }: { row: BookingSummaryRow }) {
  const hasValue = row.value !== undefined && row.value !== null && row.value !== ""

  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-muted-foreground-2">{row.label}</span>
      <div className="flex flex-col items-end gap-0.5">
        {hasValue ? (
          <span className="text-sm font-semibold">{row.value}</span>
        ) : (
          <span className="text-sm text-text-placeholder">&mdash;</span>
        )}
        {hasValue && row.detail && (
          <span className="text-xs tabular-nums text-muted-foreground-2">{row.detail}</span>
        )}
      </div>
    </div>
  )
}
