"use client"

import { useState, use } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Pencil, Mail, Phone, PhoneCall, FileText, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ClientFormSheet } from "@/components/clients/client-form"
import { GdprPanel } from "@/components/clients/gdpr-panel"
import { ClientAppointmentHistory } from "@/components/clients/client-appointment-history"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { PageShell } from "@/components/layout/page-shell"
import { clientsApi } from "@/lib/api/clients"
import { useAuth } from "@/hooks/use-auth"
import { useClientAppointments } from "@/hooks/use-clients"
import { useMediaQuery } from "@/hooks/use-media-query"
import { initials, formatPhone } from "@/lib/utils/format"
import { formatDate } from "@/lib/utils/dates"
import { cn } from "@/lib/utils"
import type { Client } from "@/types/client"

// Tailwind's `lg:` breakpoint (1024px), igual que `page-shell.tsx` (D28): la
// unica bifurcacion de ancho es este `useMediaQuery`, nunca `hidden lg:...`.
// Sustituye a los dos `lg:hidden` de hoy (`:69`, `:76-86`), que dejaban dos
// botones "Editar" a la vez en el DOM porque jsdom no aplica CSS.
const DESKTOP_QUERY = "(min-width: 1024px)"

// B3: el historial pide `size=7` por defecto (D24) -- una sola consulta
// alimenta el footer del historial Y los dos KPIs (D36), asi que se declara
// una sola vez y se comparte.
const HISTORY_SIZE = 7

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const queryClient = useQueryClient()
  const router = useRouter()
  const { accessToken, isOwner } = useAuth()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const [editOpen, setEditOpen] = useState(false)

  const {
    data: client,
    isLoading,
    isError,
    refetch,
  } = useQuery<Client>({
    queryKey: ["client", id],
    queryFn: () => clientsApi.getById(id, accessToken!),
    enabled: !!accessToken,
  })

  // D36: los dos KPIs de la ficha ("Visitas", "Última visita") NO salen de
  // `client.totalVisits`/`client.lastVisitAt` -- esos contadores no tienen
  // backfill y valdrian `0`/`null` para todo cliente existente, a
  // centimetros de "14 citas · 612,00 € facturados" en la misma pantalla.
  // Salen del RESUMEN del historial, que B3 ya carga para la cabecerilla:
  // la misma `queryKey` que `ClientAppointmentHistory` monta abajo, asi que
  // esto sale gratis (una sola peticion en vuelo, no dos).
  const { data: appointmentsPage } = useClientAppointments(id, { size: HISTORY_SIZE })
  const summary = appointmentsPage?.summary

  if (isLoading) {
    return (
      <PageShell title="Cliente" mobileTitle="Detalle cliente" back desktopBack="plain">
        <LoadingSkeleton count={5} />
      </PageShell>
    )
  }

  // §1.11.3: separado de `isLoading` a proposito -- antes los dos colapsaban
  // en el mismo camino y un 404/500 pintaba el esqueleto para siempre.
  if (isError || !client) {
    return (
      <PageShell title="Cliente" mobileTitle="Detalle cliente" back desktopBack="plain">
        <EmptyState
          title="No se ha podido cargar el cliente"
          description="Comprueba tu conexion e intentalo de nuevo."
          action={<Button onClick={() => refetch()}>Reintentar</Button>}
        />
      </PageShell>
    )
  }

  const fullName = `${client.firstName} ${client.lastName}`
  const clientSince = `Cliente desde ${formatDate(client.createdAt)}`
  const isOnlineBooking = client.source === "ONLINE_BOOKING"
  const visits = summary?.completedCount ?? 0
  const lastVisit = summary?.lastCompletedAt ? formatDate(summary.lastCompletedAt) : "—"

  return (
    <PageShell
      title={fullName}
      mobileTitle="Detalle cliente"
      titleSize="lg"
      back
      desktopBack="plain"
      titleAdjacent={
        <span className="text-xs leading-tight tabular-nums text-muted-foreground-2">{clientSince}</span>
      }
      actions={
        <>
          {isOwner && (
            <Button variant="outline" size="action" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Editar
            </Button>
          )}
          <Button
            size="action"
            onClick={() => router.push(`/appointments/new?clientId=${client.id}`)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Nueva cita
          </Button>
        </>
      }
      mobileActions={null}
    >
      {isDesktop ? (
        <div className="flex gap-6">
          {/* §1.7 DetalleClienteDesktop:100 -- columna izquierda FIJA 400px. */}
          <div className="flex w-[400px] shrink-0 flex-col gap-4">
            <Card className="gap-4 p-5">
              <div className="flex flex-col items-start gap-3">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-xl font-bold">
                    {initials(client.firstName, client.lastName)}
                  </AvatarFallback>
                </Avatar>
                <p className="font-heading text-[21px] leading-tight font-semibold">{fullName}</p>
                {isOnlineBooking && (
                  <Badge variant="secondary" className="bg-muted text-muted-foreground">
                    Reserva online
                  </Badge>
                )}
              </div>

              <Separator />

              <ContactInfo client={client} showCallButton={false} />

              {client.notes && <NotesBlock notes={client.notes} />}
            </Card>

            <ClientKpis visits={visits} lastVisit={lastVisit} />

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
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <ClientAppointmentHistory clientId={client.id} isDesktop />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14">
              <AvatarFallback className="text-lg font-bold">
                {initials(client.firstName, client.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-heading text-xl leading-tight font-semibold">{fullName}</p>
              <p className="text-xs leading-tight tabular-nums text-muted-foreground-2">{clientSince}</p>
            </div>
            {/* Movil: editar es un boton-icono, sin etiqueta (`DetalleCliente.dc.html:47-49`).
                En escritorio ese mismo destino ya vive en la topbar con
                texto (`actions` de arriba) -- montaje condicional en JS
                (D28), nunca las dos ramas a la vez. */}
            {isOwner && (
              <Button
                variant="outline"
                size="icon"
                className="size-9"
                aria-label="Editar"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>

          <ClientKpis visits={visits} lastVisit={lastVisit} />

          <ContactInfo client={client} showCallButton />

          {client.notes && <NotesBlock notes={client.notes} />}

          <ClientAppointmentHistory clientId={client.id} isDesktop={false} />

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
        </div>
      )}

      <ClientFormSheet open={editOpen} onOpenChange={setEditOpen} client={client} />
    </PageShell>
  )
}

interface ClientKpisProps {
  visits: number
  lastVisit: string
}

/**
 * D36: los dos numeros de aqui vienen del RESUMEN del historial
 * (`summary.completedCount`/`summary.lastCompletedAt`), no de
 * `client.totalVisits`/`client.lastVisitAt` -- ver el comentario en el
 * cuerpo de la pagina. `—` (D21) es el valor vacio de cualquier fecha
 * ausente, no un caso borde: sin backfill es el caso mayoritario el dia 1.
 */
function ClientKpis({ visits, lastVisit }: ClientKpisProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Card className="gap-0.5 px-3.5 py-3">
        <p className="text-xs text-muted-foreground">Visitas</p>
        <p className="font-heading text-[30px] leading-[1.05] font-semibold tabular-nums">{visits}</p>
      </Card>
      <Card className="gap-0.5 px-3.5 py-3">
        <p className="text-xs text-muted-foreground">Última visita</p>
        <p className="text-[21px] leading-[1.5] font-semibold tabular-nums">{lastVisit}</p>
      </Card>
    </div>
  )
}

interface ContactInfoProps {
  client: Client
  /** Solo movil (`DetalleCliente.dc.html:73`, D25): el boton "Llamar" no
   * existe en escritorio (`DetalleClienteDesktop.dc.html:104-129`). */
  showCallButton: boolean
}

function ContactInfo({ client, showCallButton }: ContactInfoProps) {
  if (!client.phone && !client.email) return null

  if (!showCallButton) {
    // Escritorio: lista simple dentro de la tarjeta de perfil, sin boton ni
    // borde propio (`DetalleClienteDesktop.dc.html:120-129`).
    return (
      <div className="flex flex-col gap-3">
        {client.phone && (
          <div className="flex items-center gap-2.5 text-sm">
            <Phone className="size-[17px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <span className="tabular-nums">{formatPhone(client.phone)}</span>
          </div>
        )}
        {client.email && (
          <div className="flex items-center gap-2.5 text-sm">
            <Mail className="size-[17px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <span className="truncate">{client.email}</span>
          </div>
        )}
      </div>
    )
  }

  // Movil: grupo con borde propio y separador (`DetalleCliente.dc.html:64-80`).
  return (
    <div className="overflow-hidden rounded-[10px] border border-border bg-card">
      {client.phone && (
        <div className="flex h-14 items-center gap-3 px-3.5">
          <Phone className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate text-sm tabular-nums">{formatPhone(client.phone)}</span>
          <a
            href={`tel:${client.phone}`}
            className="flex h-8 shrink-0 items-center rounded-lg border border-border bg-card px-3 text-xs font-semibold text-primary-pressed"
          >
            <PhoneCall className="mr-1 size-3.5" strokeWidth={1.75} />
            Llamar
          </a>
        </div>
      )}
      {client.phone && client.email && <div className="ml-11 h-px bg-hairline" />}
      {client.email && (
        <div className="flex h-14 items-center gap-3 px-3.5">
          <Mail className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate text-sm">{client.email}</span>
        </div>
      )}
    </div>
  )
}

function NotesBlock({ notes }: { notes: string }) {
  return (
    <div className={cn("flex items-start gap-2.5 text-sm text-muted-foreground")}>
      <FileText className="mt-0.5 size-[18px] shrink-0" strokeWidth={1.75} />
      <span className="leading-[1.45]">{notes}</span>
    </div>
  )
}
