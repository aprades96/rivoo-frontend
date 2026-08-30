"use client"

import { useState } from "react"
import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { Search, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ClientCard } from "@/components/clients/client-card"
import { ClientTable } from "@/components/clients/client-table"
import { ClientFormSheet } from "@/components/clients/client-form"
import { EmptyState } from "@/components/shared/empty-state"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { PageShell } from "@/components/layout/page-shell"
import { clientsApi } from "@/lib/api/clients"
import { useAuth } from "@/hooks/use-auth"
import { useDebouncedValue, SEARCH_DEBOUNCE_MS } from "@/hooks/use-clients"
import { useMediaQuery } from "@/hooks/use-media-query"
import type { Client } from "@/types/client"
import type { Page } from "@/types/api"

// Tailwind's `lg:` breakpoint (1024px), igual que `page-shell.tsx` (D28): la
// unica bifurcacion de ancho es este `useMediaQuery`, nunca `hidden lg:...`.
const DESKTOP_QUERY = "(min-width: 1024px)"

// `/clients` pide paginas de 50 (D22); `useClients` (el paso 4 del asistente)
// pide 10 -- las dos claves llevan `size` para no compartir cache (D34).
const PAGE_SIZE = 50

export default function ClientsPage() {
  const { accessToken, isAuthenticated } = useAuth()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const [search, setSearch] = useState("")
  const [formOpen, setFormOpen] = useState(false)

  // D20: `useDeferredValue` (que no es un debounce, solo prioridad de render)
  // sustituido por el debounce de 250ms que ya vive en `use-clients.ts`,
  // probado con fake timers.
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)

  const { data, isLoading } = useQuery<Page<Client>>({
    queryKey: ["clients", { search: debouncedSearch, size: PAGE_SIZE }],
    queryFn: () =>
      clientsApi.list(
        { search: debouncedSearch || undefined, page: 0, size: PAGE_SIZE },
        accessToken!
      ),
    enabled: isAuthenticated && !!accessToken,
    // D20: sin esto, cada letra cambia la queryKey a una entrada sin datos,
    // `isLoading` sube y la lista se desmonta para montar el esqueleto --
    // parpadeo en cada tecla. Con `keepPreviousData`, la pagina anterior
    // sigue pintada mientras la nueva peticion esta en vuelo.
    placeholderData: keepPreviousData,
  })

  const clients = data?.content ?? []
  const totalElements = data?.totalElements ?? clients.length

  return (
    <PageShell
      title="Clientes"
      actions={
        <Button size="action" onClick={() => setFormOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Añadir cliente
        </Button>
      }
      mobileActions={
        <Button size="action" onClick={() => setFormOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Añadir
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Buscador */}
        <div className="relative w-full lg:max-w-[340px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Lista */}
        {isLoading ? (
          <LoadingSkeleton count={5} />
        ) : clients.length === 0 ? (
          <EmptyState
            title={search ? "Sin resultados" : "Sin clientes"}
            description={
              search
                ? `No se encontraron clientes para "${search}".`
                : "Añade a tu primer cliente."
            }
          />
        ) : isDesktop ? (
          <>
            <p className="text-xs text-muted-foreground">
              {totalElements} cliente{totalElements !== 1 ? "s" : ""}
            </p>
            <ClientTable clients={clients} totalElements={totalElements} pageSize={PAGE_SIZE} />
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              {totalElements} cliente{totalElements !== 1 ? "s" : ""}
            </p>
            {clients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        )}
      </div>

      <ClientFormSheet open={formOpen} onOpenChange={setFormOpen} client={null} />
    </PageShell>
  )
}
