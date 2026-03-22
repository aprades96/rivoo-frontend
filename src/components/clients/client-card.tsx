import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { initials } from "@/lib/utils/format"
import type { Client } from "@/types/client"

interface ClientCardProps {
  client: Client
  onTap?: (client: Client) => void
}

export function ClientCard({ client, onTap }: ClientCardProps) {
  return (
    <Card
      className="cursor-pointer p-3 transition-colors hover:bg-muted/50"
      onClick={() => onTap?.(client)}
    >
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="text-sm">
            {initials(client.firstName, client.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {client.firstName} {client.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[client.phone, client.email].filter(Boolean).join(" · ") || "Sin contacto"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">{client.totalVisits}</p>
          <p className="text-[10px] text-muted-foreground">visitas</p>
        </div>
      </div>
    </Card>
  )
}
