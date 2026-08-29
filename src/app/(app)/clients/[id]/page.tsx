"use client"

import { useState, use } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, CalendarPlus, Mail, Phone, FileText } from "lucide-react"
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
  const router = useRouter()
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
      <PageShell title="" back desktopBack="plain">
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
        <>
          {isOwner && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Editar
            </Button>
          )}
          <Button size="sm" onClick={() => router.push("/appointments/new")}>
            <CalendarPlus className="mr-1.5 h-4 w-4" />
            Nueva cita
          </Button>
        </>
      }
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
            <p className="text-xs text-muted-foreground">{clientSince}</p>
          </div>
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
