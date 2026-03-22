"use client"

import { Plus } from "lucide-react"
import Link from "next/link"

export function FabButton() {
  return (
    <Link
      href="/appointments/new"
      className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
    >
      <Plus className="h-6 w-6" />
      <span className="sr-only">Nueva cita</span>
    </Link>
  )
}
