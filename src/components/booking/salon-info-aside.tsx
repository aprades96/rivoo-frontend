import { Phone } from "lucide-react"
import { formatTimeOfDay, getTodayBusinessHours, groupBusinessHours } from "@/lib/utils/business-hours"
import { formatPhone } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import type { SalonPublic } from "@/types/salon"

export interface SalonInfoAsideProps {
  salon: SalonPublic
}

/**
 * Right-column card for booking step 1 only
 * (`design/ReservaDesktopPaso1.dc.html:132-145`): salon description, whether
 * it is open right now, the weekly schedule grouped by `groupBusinessHours`,
 * and the phone number. Paints itself only -- `BookingStepShell` (the
 * chassis) owns width and position via its `aside` slot.
 */
export function SalonInfoAside({ salon }: SalonInfoAsideProps) {
  const today = getTodayBusinessHours(salon.businessHours)
  const isOpenNow = today?.isOpen ?? false
  const groups = groupBusinessHours(salon.businessHours)
  const hasDescription = salon.description != null && salon.description.trim().length > 0

  return (
    <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-[22px]">
      <span className="text-xs font-semibold tracking-[0.06em] text-muted-foreground-2 uppercase">
        El salon
      </span>

      {hasDescription && (
        <>
          <p className="text-[13px] leading-[1.55] text-muted-foreground">{salon.description}</p>
          <div className="h-px bg-hairline" />
        </>
      )}

      <div className="flex items-center gap-2">
        {/*
          `bg-[#5C7A5E]` matches the dot color already used for this same
          open/closed signal in `MobileStepOneHeader`
          (booking-step-shell.tsx:161) -- an arbitrary hex, not a token, kept
          consistent with that precedent rather than introducing a second name
          for the same color.
        */}
        <div className={cn("size-[7px] shrink-0 rounded-full", isOpenNow ? "bg-[#5C7A5E]" : "bg-text-subtle")} />
        <span className={cn("text-[13px] font-medium", isOpenNow ? "text-success" : "text-text-subtle")}>
          {isOpenNow ? `Abierto hoy hasta las ${formatTimeOfDay(today?.closeTime)}` : "Cerrado hoy"}
        </span>
      </div>

      <div className="flex flex-col gap-[5px]">
        {groups.map((group) => (
          <div key={group.label} className="flex items-start justify-between gap-3">
            <span className="text-xs text-muted-foreground-2">{group.label}</span>
            {group.isOpen ? (
              <span className="text-[13px] tabular-nums">
                {formatTimeOfDay(group.openTime)} - {formatTimeOfDay(group.closeTime)}
              </span>
            ) : (
              <span className="text-[13px] text-text-subtle">Cerrado</span>
            )}
          </div>
        ))}
      </div>

      <div className="h-px bg-hairline" />

      <div className="flex items-center gap-2 text-primary">
        <Phone className="size-3.5" aria-hidden="true" />
        <span className="text-sm font-semibold tabular-nums">{formatPhone(salon.phone)}</span>
      </div>
    </div>
  )
}
