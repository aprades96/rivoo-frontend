"use client"

import { useState, use } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Pencil, Mail, Phone, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ClientFormSheet } from "@/components/clients/client-form"
import { GdprPanel } from "@/components/clients/gdpr-panel"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
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
    return <div className="p-4"><LoadingSkeleton count={5} /></div>
  }

  const fullName = `${client.firstName} ${client.lastName}`

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-sm font-semibold">Detalle cliente</h1>
      </div>

      {/* Profile */}
      <div className="flex items-center gap-3">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="text-lg">
            {initials(client.firstName, client.lastName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="text-base font-semibold">{fullName}</p>
          <p className="text-xs text-muted-foreground">
            Cliente desde {new Date(client.createdAt).toLocaleDateString("es-ES")}
          </p>
        </div>
        {isOwner && (
          <Button variant="ghost" size="icon-sm" onClick={() => setEditOpen(true)}>
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
  )
}
