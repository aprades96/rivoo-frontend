import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatPhone, initials } from "@/lib/utils/format"
import { employeeFallbackAvatarClassName } from "@/lib/utils/avatar"
import { cn } from "@/lib/utils"
import type { Client } from "@/types/client"

interface ClientCardProps {
  client: Client
  /** Posición del cliente en la lista mostrada (M13): resuelve el mismo color
   * de reserva que `ClientTable`, por posición, ya que `Client` nunca trae un
   * color propio (a diferencia de `Employee.colorHex`). */
  index: number
}

/**
 * `Clientes.dc.html:44-52` (D5, D29). La fila entera es un `<Link>` hacia
 * `/clients/{id}` en vez de `<Card onClick>` -- alcanzable por teclado, con
 * foco visible, sin necesitar `onTap` desde quien la monta.
 */
export function ClientCard({ client, index }: ClientCardProps) {
  const contact = [client.phone ? formatPhone(client.phone) : null, client.email].filter(Boolean)

  return (
    <Link
      href={`/clients/${client.id}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <Avatar className="h-10 w-10">
        <AvatarFallback
          className={cn(
            "text-[13px] leading-none font-semibold",
            employeeFallbackAvatarClassName(index)
          )}
        >
          {initials(client.firstName, client.lastName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {client.firstName} {client.lastName}
        </p>
        {/* Una sola línea, `telefono · email` (D29): "Sin contacto" no lleva
            `.num` (tabular-nums), el resto sí. */}
        <p className="truncate text-xs text-muted-foreground">
          {contact.length > 0 ? (
            <span className="tabular-nums">{contact.join(" · ")}</span>
          ) : (
            <span className="text-muted-foreground-2">Sin contacto</span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="font-heading font-semibold tracking-display tabular-nums text-[20px] leading-[1.1]">
          {client.totalVisits}
        </span>
        <span className="text-[10px] leading-tight text-muted-foreground-2">visitas</span>
      </div>
    </Link>
  )
}
