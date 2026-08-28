"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useServices } from "@/hooks/use-staff"
import { formatCurrency } from "@/lib/utils/format"
import { formatDuration } from "@/lib/utils/dates"
import type { EmployeeServiceResponse } from "@/types/employee"

interface ServiceAssignmentProps {
  assignedServices: EmployeeServiceResponse[] | undefined
  onSave: (serviceIds: string[]) => Promise<unknown>
  isSaving?: boolean
}

export function ServiceAssignment({ assignedServices, onSave, isSaving }: ServiceAssignmentProps) {
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
