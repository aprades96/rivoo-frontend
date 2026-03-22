import type { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-muted p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Rivoo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestion de peluquerias
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
