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
import { cn } from "@/lib/utils"
import type { Client } from "@/types/client"
import type { Page } from "@/types/api"

// Tailwind's `lg:` breakpoint (1024px), igual que `page-shell.tsx` (D28): la
// única bifurcación de ancho es este `useMediaQuery`, nunca `hidden lg:...`.
const DESKTOP_QUERY = "(min-width: 1024px)"

// `/clients` pide páginas de 50 (D22); `useClients` (el paso 4 del asistente)
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

  const { data, isLoading, isError, refetch } = useQuery<Page<Client>>({
    queryKey: ["clients", { search: debouncedSearch, size: PAGE_SIZE }],
    queryFn: () =>
      clientsApi.list(
        { search: debouncedSearch || undefined, page: 0, size: PAGE_SIZE },
        accessToken!
      ),
    enabled: isAuthenticated && !!accessToken,
    // D20: sin esto, cada letra cambia la queryKey a una entrada sin datos,
    // `isLoading` sube y la lista se desmonta para montar el esqueleto --
    // parpadeo en cada tecla. Con `keepPreviousData`, la página anterior
    // sigue pintada mientras la nueva petición está en vuelo.
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
      <div className="flex flex-col gap-3 lg:gap-[18px]">
        {/* Buscador (+ contador en escritorio, H4: ClientesDesktop.dc.html:83-88
            es una sola fila space-between; en móvil el contador va debajo,
            Clientes.dc.html:33-40). */}
        <div className={cn("flex gap-3", isDesktop ? "items-center justify-between" : "flex-col")}>
          <div className="relative w-full lg:max-w-[340px]">
            <Search className="absolute left-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-muted-foreground-2" />
            <Input
              placeholder="Buscar clientes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 bg-card pl-9 lg:h-10"
            />
          </div>
          {isDesktop && !isLoading && !isError && clients.length > 0 && (
            <p className="shrink-0 text-[13px] leading-none tabular-nums text-muted-foreground">
              {totalElements} cliente{totalElements !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Lista */}
        {isLoading ? (
          <LoadingSkeleton count={5} />
        ) : isError ? (
          // F1: con la petición fallada, `data` queda `undefined` igual que
          // "sin clientes" -- sin esta rama, un fallo del backend se veía
          // idéntico a un salón sin clientes (peor aún con búsqueda activa,
          // que afirmaba que la búsqueda no tuvo resultados). `refetch`
          // reintenta sin recargar la página entera.
          <EmptyState
            title="No se han podido cargar los clientes"
            description="Comprueba tu conexión e inténtalo de nuevo."
            action={<Button onClick={() => refetch()}>Reintentar</Button>}
          />
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
          <ClientTable clients={clients} totalElements={totalElements} pageSize={PAGE_SIZE} />
        ) : (
          <div className="flex flex-col gap-2">
            {/* R2 (residuo de auditoria): `/clients` pide una sola pagina de
                `PAGE_SIZE` (D22) sin paginacion real -- con mas clientes que
                eso, `clients.length < totalElements` y esta linea NO puede
                afirmar `totalElements` sin mentir sobre cuantas tarjetas hay
                debajo de las que de verdad se pintan. `Clientes.dc.html` no
                dibuja la linea "Mostrando X de Y" que si tiene el escritorio
                (`ClientTable`) -- inventarla aqui incumpliria el artboard.
                La salida menos inventiva: el contador afirma el numero que
                se PUEDE mostrar (coincide con `totalElements` en el caso
                normal, ningun salon con <=PAGE_SIZE clientes lo nota). */}
            <p className="text-xs text-muted-foreground">
              {clients.length} cliente{clients.length !== 1 ? "s" : ""}
            </p>
            {clients.map((client, index) => (
              <ClientCard key={client.id} client={client} index={index} />
            ))}
          </div>
        )}
      </div>

      <ClientFormSheet open={formOpen} onOpenChange={setFormOpen} client={null} />
    </PageShell>
  )
}
