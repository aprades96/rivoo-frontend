import type { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-muted p-4">
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Rivoo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestion de peluquerias
          </p>
        </div>
        <div className="w-full max-w-2xl">
          {children}
        </div>
      </div>
      {/* Spacer igual al header para compensar y centrar el card visualmente */}
      <div className="invisible mb-6 text-center">
        <h1 className="text-2xl font-bold">Rivoo</h1>
        <p className="mt-1 text-sm">placeholder</p>
      </div>
    </div>
  )
}
