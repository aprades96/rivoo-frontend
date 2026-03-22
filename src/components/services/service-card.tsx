import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils/format"
import { formatDuration } from "@/lib/utils/dates"
import type { ServiceOffering } from "@/types/service"

interface ServiceCardProps {
  service: ServiceOffering
  onTap?: (service: ServiceOffering) => void
}

export function ServiceCard({ service, onTap }: ServiceCardProps) {
  return (
    <Card
      className="cursor-pointer p-3 transition-colors hover:bg-muted/50"
      onClick={() => onTap?.(service)}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{service.name}</p>
            {!service.isActive && (
              <Badge variant="outline" className="text-[10px]">Inactivo</Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDuration(service.durationMinutes)}
            {service.category && ` · ${service.category}`}
          </p>
        </div>
        <span className="ml-3 shrink-0 text-sm font-semibold">
          {formatCurrency(service.price)}
        </span>
      </div>
    </Card>
  )
}
