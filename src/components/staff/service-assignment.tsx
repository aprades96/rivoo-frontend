"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useServices } from "@/hooks/use-staff"
import { formatCurrency } from "@/lib/utils/format"
import { formatDuration } from "@/lib/utils/dates"
import { cn } from "@/lib/utils"
import type { EmployeeServiceResponse } from "@/types/employee"

interface ServiceAssignmentProps {
  assignedServices: EmployeeServiceResponse[] | undefined
  onSave: (serviceIds: string[]) => Promise<unknown>
  isSaving?: boolean
  /**
   * `DetalleEmpleadoDesktop.dc.html:235` draws the `.cardtitle` "Servicios que
   * realiza" above the counter -- only in the desktop card. The mobile panel
   * reuses this same component "sin sus anchos fijos, con las mismas piezas:
   * contador 4 de 6, filas .svc, ayuda y CTA" (D12): that enumeration names
   * the counter but not the card title, so the caller omits `title` on
   * mobile and the header keeps only the live count.
   */
  title?: string
  className?: string
}

export function ServiceAssignment({
  assignedServices,
  onSave,
  isSaving,
  title,
  className,
}: ServiceAssignmentProps) {
  const { data: servicesData } = useServices()
  const services = servicesData?.content?.filter((s) => s.isActive) ?? []

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(assignedServices?.map((s) => s.serviceId))
  )

  // Adopt the server list once, when it first arrives. Later refetches return a
  // new array for the same employee and must not discard the boxes the user has
  // just ticked; a different employee gets a fresh editor via `key` at the call
  // site (the props carry no employee identity of their own).
  const syncKey = assignedServices !== undefined
  const [syncedKey, setSyncedKey] = useState(syncKey)
  if (syncKey !== syncedKey) {
    setSyncedKey(syncKey)
    setSelectedIds(new Set(assignedServices?.map((s) => s.serviceId)))
  }

  const toggleService = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* D15: `4 de 6` = seleccionados / activos del catalogo, en vivo. Sin
          `title` (movil) se pinta solo el contador, alineado al hueco que
          dejaria el rotulo. */}
      <div className={cn("flex items-baseline", title ? "justify-between" : "justify-end")}>
        {title && <span className="text-[15px] font-semibold leading-tight">{title}</span>}
        <span className="text-xs tabular-nums text-muted-foreground">
          {selectedIds.size} de {services.length}
        </span>
      </div>

      <div className="space-y-2">
        {services.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No hay servicios en el catalogo. Crea uno primero.
          </p>
        ) : (
          services.map((service) => {
            const isSelected = selectedIds.has(service.id)
            return (
              <label
                key={service.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleService(service.id)}
                  className="h-4 w-4 rounded border-border"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{service.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(service.durationMinutes)} · {formatCurrency(service.price)}
                  </p>
                </div>
              </label>
            )
          })
        )}
      </div>

      {/* `DetalleEmpleadoDesktop.dc.html:298` -- D12 lists it among the mobile
          panel's reused pieces too. */}
      <p className="text-[11px] leading-[1.45] text-muted-foreground-2">
        Solo aparecen los servicios activos del catalogo.
      </p>

      <Button
        className="w-full"
        onClick={() => onSave(Array.from(selectedIds))}
        disabled={isSaving}
      >
        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Guardar servicios ({selectedIds.size})
      </Button>
    </div>
  )
}
