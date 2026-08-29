"use client"

import { useState, useDeferredValue } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Search, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ClientCard } from "@/components/clients/client-card"
import { ClientFormSheet } from "@/components/clients/client-form"
import { EmptyState } from "@/components/shared/empty-state"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { PageShell } from "@/components/layout/page-shell"
import { clientsApi } from "@/lib/api/clients"
import { useAuth } from "@/hooks/use-auth"
import type { Client } from "@/types/client"
import type { Page } from "@/types/api"

export default function ClientsPage() {
  const router = useRouter()
  const { accessToken, isAuthenticated } = useAuth()
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)
  const [formOpen, setFormOpen] = useState(false)

  const { data, isLoading } = useQuery<Page<Client>>({
    queryKey: ["clients", { search: deferredSearch }],
    queryFn: () =>
      clientsApi.list(
        { search: deferredSearch || undefined, page: 0, size: 50 },
        accessToken!
      ),
    enabled: isAuthenticated && !!accessToken,
  })

  const clients = data?.content ?? []

  return (
    <PageShell
      title="Clientes"
      actions={
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Anadir
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* List */}
        {isLoading ? (
          <LoadingSkeleton count={5} />
        ) : clients.length === 0 ? (
          <EmptyState
            title={search ? "Sin resultados" : "Sin clientes"}
            description={
              search
                ? `No se encontraron clientes para "${search}".`
                : "Anade a tu primer cliente."
            }
          />
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {data?.totalElements ?? clients.length} cliente{(data?.totalElements ?? clients.length) !== 1 ? "s" : ""}
            </p>
            {clients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onTap={(c) => router.push(`/clients/${c.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <ClientFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        client={null}
      />
    </PageShell>
  )
}
