import { formatAddress } from "@/lib/utils/format"
import type { SalonPublic } from "@/types/salon"

/**
 * Generic "salon" mark (scissors) used in every artboard header instead of
 * `salon.logoUrl` -- no artboard shows a logo-image variant, and wiring one
 * in is outside this chassis task's scope. `design/ReservaDesktopPaso1.dc.html:38`.
 */
function SalonMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx={32} cy={32} r={29} />
      <circle cx={24} cy={42} r={6} />
      <circle cx={40} cy={42} r={6} />
      <line x1={28.2} y1={37.5} x2={35} y2={22} />
      <line x1={35.8} y1={37.5} x2={29} y2={22} />
      <circle cx={32} cy={30} r={1.5} fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * 76px centered desktop header, shared by the step chassis and the result
 * chassis: both use the exact same markup from `md:` up
 * (`design/ReservaDesktopPaso1.dc.html:37-43` and
 * `design/ReservaDesktopPaso6.dc.html:37-43` are byte-for-byte identical).
 * Only the mobile header differs between the two, so each shell builds its
 * own mobile variant and reuses this one for `md:`.
 */
export function BookingDesktopHeader({ salon }: { salon: SalonPublic }) {
  return (
    <div className="hidden h-[76px] shrink-0 items-center justify-center gap-3 border-b bg-muted md:flex">
      <SalonMark className="size-[30px] text-primary" />
      <div className="flex flex-col">
        <span className="font-heading text-[26px] leading-[1.05] font-semibold tracking-display">
          {salon.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatAddress(salon.addressStreet, salon.addressCity, salon.addressPostalCode)}
        </span>
      </div>
    </div>
  )
}

export { SalonMark }
