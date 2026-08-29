/**
 * Generic "salon" mark (scissors) used in every artboard header instead of
 * `salon.logoUrl` -- no artboard shows a logo-image variant, and wiring one
 * in is outside this chassis task's scope. `design/ReservaDesktopPaso1.dc.html:38`.
 * Shared by both chassis: the public booking header and the internal app
 * shell (desktop sidebar / mobile header).
 */
export function SalonMark({ className }: { className?: string }) {
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
