import type { ReactNode } from "react"

export default function BookingLayout({ children }: { children: ReactNode }) {
  return (
    // `min-h-dvh` (no `min-h-full`) a proposito: `body` (src/app/layout.tsx)
    // solo fija `min-height`, nunca `height`, asi que un `%` aqui no resuelve
    // a nada. `dvh` es una unidad de viewport y resuelve siempre. Mismo
    // defecto corregido en (onboarding)/layout.tsx. Sin variante `md:`
    // porque el layout de escritorio de esta pantalla aun no existe.
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b px-4 py-3">
        <p className="text-xs text-muted-foreground">Reserva online</p>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
        Powered by Rivoo
      </footer>
    </div>
  )
}
