import type { ReactNode } from "react"

export default function BookingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-background">
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
