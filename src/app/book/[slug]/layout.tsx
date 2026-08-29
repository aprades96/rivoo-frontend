import type { ReactNode } from "react"

export default function BookingLayout({ children }: { children: ReactNode }) {
  return (
    // `min-h-dvh` (no `min-h-full`) a proposito: `body` (src/app/layout.tsx)
    // solo fija `min-height`, nunca `height`, asi que un `%` aqui no resuelve
    // a nada. `dvh` es una unidad de viewport y resuelve siempre. Mismo
    // defecto corregido en (onboarding)/layout.tsx.
    //
    // Sin `<header>` de "Reserva online" ni `<footer>` de "Powered by Rivoo":
    // ninguno de los 14 artboards de `design/Reserva*` los pinta. El chasis
    // (`BookingStepShell` / `BookingResultShell`, montado por
    // `book/[slug]/page.tsx`) pone su propia cabecera con el nombre del
    // salon, asi que este layout se limita a dar la altura real del viewport.
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
