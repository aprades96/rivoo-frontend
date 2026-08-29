import { formatAddress } from "@/lib/utils/format"
import type { SalonPublic } from "@/types/salon"
import { SalonMark } from "@/components/brand/salon-mark"

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
