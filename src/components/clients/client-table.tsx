import { ChevronRight } from "lucide-react"
import { DataTable, type DataTableColumn } from "@/components/ui/data-table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatPhone, initials } from "@/lib/utils/format"
import { formatDate } from "@/lib/utils/dates"
import { employeeFallbackAvatarClassName } from "@/lib/utils/avatar"
import { cn } from "@/lib/utils"
import type { Client } from "@/types/client"

interface ClientTableProps {
  clients: Client[]
  /** Total real del backend (`data.totalElements`), no `clients.length`: la
   * línea de paginación (D22) compara la página servida contra el total. */
  totalElements: number
  /** El tamaño de página que pide `/clients` (50, D22) -- ninguna otra
   * pantalla del bloque reutiliza este componente con otro valor, pero se
   * recibe como prop en vez de constante literal para no esconder el número
   * que la línea de texto anuncia. */
  pageSize: number
}

/**
 * `ClientesDesktop.dc.html:91-193` (D5, D20-D22, D29). Cinco columnas sobre
 * `DataTable` (D2): la quinta celda (chevron) no lleva cabecera, igual que
 * `EquipoDesktop.dc.html:124`. La fila entera es un `<Link>` hacia
 * `/clients/{id}` (D5): el chevron es decorativo, confirma que la fila
 * navega, no un control propio.
 */
export function ClientTable({ clients, totalElements, pageSize }: ClientTableProps) {
  const columns: DataTableColumn<Client>[] = [
    {
      key: "client",
      header: "Cliente",
      width: "minmax(0,1.5fr)",
      // M13: los clientes nunca traen un color propio (a diferencia de
      // `Employee.colorHex`), así que el avatar SIEMPRE cae en la paleta de
      // reserva -- por posición en la lista, igual que `employee-card.tsx` y
      // `employee-table.tsx` -- en vez de salir siempre gris (`bg-muted`).
      cell: (client) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-[38px] w-[38px]">
            <AvatarFallback
              className={cn(
                "text-[13px] leading-none font-semibold",
                employeeFallbackAvatarClassName(clients.indexOf(client))
              )}
            >
              {initials(client.firstName, client.lastName)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-sm font-semibold">
            {client.firstName} {client.lastName}
          </span>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contacto",
      width: "minmax(0,1.5fr)",
      cell: (client) => <ContactCell client={client} />,
    },
    {
      key: "lastVisit",
      header: "Última visita",
      width: "150px",
      cell: (client) => (
        <span className="text-[13px] tabular-nums text-muted-foreground">
          {client.lastVisitAt ? formatDate(client.lastVisitAt) : "—"}
        </span>
      ),
    },
    {
      key: "visits",
      header: "Visitas",
      width: "96px",
      align: "end",
      cell: (client) => (
        <span className="font-heading font-semibold tracking-display tabular-nums text-[18px] leading-none">
          {client.totalVisits}
        </span>
      ),
    },
    {
      key: "chevron",
      header: "",
      width: "20px",
      cell: () => <ChevronRight className="h-[17px] w-[17px] text-text-subtle" strokeWidth={2} />,
    },
  ]

  return (
    <div className="flex flex-col gap-[18px]">
      <DataTable
        columns={columns}
        rows={clients}
        rowKey={(client) => client.id}
        href={(client) => `/clients/${client.id}`}
        rowHeight={68}
        gap={16}
        caption="Clientes"
      />
      {/* D22: fuera de la tarjeta de la tabla, con números reales -- sin
          controles de paginación, porque ningún artboard los dibuja. */}
      <p className="text-xs text-muted-foreground-2">
        Mostrando {clients.length} de {totalElements} · la lista pide {pageSize} por página
      </p>
    </div>
  )
}

/**
 * Las tres formas de la columna Contacto (§1.6, D29,
 * `ClientesDesktop.dc.html:106-109,139-140,154`): email + teléfono; teléfono +
 * "Sin correo" cuando falta el email; o "Sin contacto" a secas cuando no hay
 * ninguno de los dos. El cuarto caso (solo email, sin teléfono) no lo dibuja
 * ningún artboard -- se degrada a una sola línea con el email, sin inventar
 * un "Sin teléfono" que nadie ha pedido.
 */
function ContactCell({ client }: { client: Client }) {
  if (client.email && client.phone) {
    return (
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13px]">{client.email}</span>
        <span className="truncate text-xs tabular-nums text-muted-foreground-2">
          {formatPhone(client.phone)}
        </span>
      </div>
    )
  }

  if (client.phone) {
    return (
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13px] tabular-nums">{formatPhone(client.phone)}</span>
        <span className="text-xs text-muted-foreground-2">Sin correo</span>
      </div>
    )
  }

  if (client.email) {
    return <span className="truncate text-[13px]">{client.email}</span>
  }

  return <span className="text-[13px] text-muted-foreground-2">Sin contacto</span>
}
