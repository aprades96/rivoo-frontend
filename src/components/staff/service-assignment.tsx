"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  // F2: `assignedServices` has its own not-ready guard at the call site
  // (staff/[id]/page.tsx), but this catalogue GET is a second, independent
  // request that was never guarded. If 3 services are already assigned and
  // this GET fails or is still in flight, `services` used to silently
  // resolve to `[]`, which made the card lie: "3 de 0" and "No hay servicios
  // en el catalogo. Crea uno primero." -- both false, the catalogue was never
  // actually empty. No data loss follows (the same ids are simply resent),
  // but the message asserts something the component does not know. Tracking
  // loading/error separately lets the counter and the list say what is
  // actually true.
  const { data: servicesData, isLoading: isCatalogLoading, isError: isCatalogFailed, refetch: refetchCatalog } = useServices()
  const services = servicesData?.content?.filter((s) => s.isActive) ?? []
  const catalogUnavailable = isCatalogLoading || isCatalogFailed

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
        <span className="text-xs tabular-nums text-muted-foreground-2">
          {/* F2: the denominator only means something once the catalogue GET
              has actually succeeded -- while it is loading or failed, "N de 0"
              would claim an empty catalogue that was never confirmed. */}
          {catalogUnavailable ? `${selectedIds.size} asignados` : `${selectedIds.size} de ${services.length}`}
        </span>
      </div>

      <div className="space-y-2">
        {catalogUnavailable ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center text-sm text-muted-foreground">
            <p>
              {isCatalogFailed
                ? "No se ha podido cargar el catálogo de servicios."
                : "Cargando catálogo de servicios…"}
            </p>
            {isCatalogFailed && (
              <Button variant="outline" size="sm" onClick={() => refetchCatalog()}>
                Reintentar
              </Button>
            )}
          </div>
        ) : services.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No hay servicios en el catálogo. Crea uno primero.
          </p>
        ) : (
          services.map((service) => {
            const isSelected = selectedIds.has(service.id)
            return (
              <label
                key={service.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                  isSelected ? "border-primary bg-surface-now" : "border-border"
                )}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleService(service.id)}
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
        Solo aparecen los servicios activos del catálogo.
      </p>

      <Button
        size="xl"
        className="h-[46px] w-full md:h-10 md:text-sm"
        onClick={() => onSave(Array.from(selectedIds))}
        disabled={isSaving}
      >
        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Guardar servicios ({selectedIds.size})
      </Button>
    </div>
  )
}
