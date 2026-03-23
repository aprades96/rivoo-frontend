"use client"

import { useAuth } from "@/hooks/use-auth"
import { useSalon } from "@/hooks/use-salon"

export function AppHeader() {
  const { user } = useAuth()
  const { data: salon } = useSalon()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
        <div>
          <h1 className="text-base font-semibold">
            {salon?.name ?? "Rivoo"}
          </h1>
        </div>
        {user && (
          <span className="text-xs text-muted-foreground">
            {user.name || user.email}
          </span>
        )}
      </div>
    </header>
  )
}
