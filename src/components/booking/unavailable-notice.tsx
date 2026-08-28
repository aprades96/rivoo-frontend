"use client"

import { TriangleAlert } from "lucide-react"
import { Card } from "@/components/ui/card"

interface UnavailableNoticeProps {
  title: string
  description: string
}

/**
 * Aviso para una lista que el backend marco como no cargada
 * (`servicesUnavailable` / `employeesUnavailable`). Solo se usa cuando la lista
 * llega vacia: separa "ahora mismo no se ha podido cargar" de "el salon no
 * tiene ninguno", que hasta ahora se veian identicos.
 */
export function UnavailableNotice({ title, description }: UnavailableNoticeProps) {
  return (
    <Card
      size="sm"
      role="status"
      className="flex-row items-start gap-3 px-4 bg-muted ring-foreground/5"
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Card>
  )
}
