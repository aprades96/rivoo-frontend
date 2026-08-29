"use client"

import { useState, use } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Mail, Phone, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ClientFormSheet } from "@/components/clients/client-form"
import { GdprPanel } from "@/components/clients/gdpr-panel"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { PageShell } from "@/components/layout/page-shell"
import { clientsApi } from "@/lib/api/clients"
import { useAuth } from "@/hooks/use-auth"
import { initials } from "@/lib/utils/format"
import type { Client } from "@/types/client"

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const queryClient = useQueryClient()
  const { accessToken, isOwner } = useAuth()
  const [editOpen, setEditOpen] = useState(false)

  const { data: client, isLoading } = useQuery<Client>({
    queryKey: ["client", id],
    queryFn: () => clientsApi.getById(id, accessToken!),
    enabled: !!accessToken,
  })

  if (isLoading || !client) {
    return (
      <PageShell title="Cliente" back desktopBack="plain">
        <LoadingSkeleton count={5} />
      </PageShell>
    )
  }

  const fullName = `${client.firstName} ${client.lastName}`
  const clientSince = `Cliente desde ${new Date(client.createdAt).toLocaleDateString("es-ES")}`

  return (
    <PageShell
      title={fullName}
      titleSize="lg"
      back
      desktopBack="plain"
      titleAdjacent={<span className="text-xs text-muted-foreground">{clientSince}</span>}
      actions={
        isOwner && (
          <Button variant="outline" size="action" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Editar
          </Button>
        )
      }
      mobileActions={null}
    >
      <div className="space-y-4">
        {/* Profile */}
        <div className="flex items-center gap-3">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-lg">
              {initials(client.firstName, client.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-base font-semibold">{fullName}</p>
            <p className="text-xs text-muted-foreground lg:hidden">{clientSince}</p>
          </div>
          {/* `mobileActions={null}` vacia la cabecera movil (igual que en
              /staff/[id]): en movil, Editar vive aqui como boton-icono 36x36
              (`DetalleCliente.dc.html:47-49`), con `lg:hidden` porque en
              escritorio ese mismo destino ya esta en la barra superior con
              etiqueta (`actions` arriba). */}
          {isOwner && (
            <Button
              variant="outline"
              size="icon"
              className="size-9 lg:hidden"
              aria-label="Editar"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <Card className="p-3 text-center">
            <p className="text-2xl font-bold">{client.totalVisits}</p>
            <p className="text-xs text-muted-foreground">Visitas</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-sm font-medium">
              {client.lastVisitAt
                ? new Date(client.lastVisitAt).toLocaleDateString("es-ES")
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Ultima visita</p>
          </Card>
        </div>

        {/* Contact info */}
        <div className="space-y-2">
          {client.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{client.phone}</span>
            </div>
          )}
          {client.notes && (
            <div className="flex items-start gap-2 text-sm">
              <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{client.notes}</span>
            </div>
          )}
        </div>

        <Separator />

        {/* GDPR */}
        {isOwner && (
          <GdprPanel
            clientId={client.id}
            clientName={fullName}
            gdprConsentAt={client.gdprConsentAt}
            onAnonymized={() => {
              queryClient.invalidateQueries({ queryKey: ["client", id] })
              queryClient.invalidateQueries({ queryKey: ["clients"] })
            }}
          />
        )}

        {/* Edit sheet */}
        <ClientFormSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          client={client}
        />
      </div>
    </PageShell>
  )
}
