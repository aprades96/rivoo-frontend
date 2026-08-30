"use client"

import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { clientsApi } from "@/lib/api/clients"
import { useAuth } from "@/hooks/use-auth"
import type { Client, CreateClientRequest } from "@/types/client"
import type { Page } from "@/types/api"

/** ~250ms so typing does not fire one request per keystroke, without adding
 * visible lag to the input itself (the caller keeps its own, undebounced,
 * state for the `Input` value -- only the value fed into `useClients` is
 * delayed). */
const SEARCH_DEBOUNCE_MS = 250

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

export function useClients(search: string) {
  const { accessToken, isAuthenticated } = useAuth()

  // Sin `search`, el paso 4 del asistente pinta "Clientes recientes" en vez de
  // exigir texto -- de ahi que la guarda de longitud minima haya desaparecido.
  // Lo que SI hace falta, y desaparecio con ella sin sustituto, es no lanzar
  // una peticion por tecla: `debouncedSearch` retrasa el valor que entra en
  // la `queryKey`/`queryFn` ~250ms, mientras el `Input` de quien llama sigue
  // controlado por su propio estado sin retraso (`ClientStep`).
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)

  // El tamano de pagina (10) va DENTRO de la `queryKey`, no solo en el body:
  // `/clients` (`src/app/(app)/clients/page.tsx:27`) comparte el prefijo
  // `["clients", { search }]` pero pide paginas de 50. Antes no chocaban
  // porque este hook estaba deshabilitado con `search` vacio -- justo la
  // guarda que se quita aqui. Sin separar la clave, con `staleTime: 10s` una
  // pantalla podria heredar la cache de tamano equivocado de la otra, de
  // forma intermitente.
  return useQuery<Page<Client>>({
    queryKey: ["clients", { search: debouncedSearch, size: 10 }],
    queryFn: () => clientsApi.list({ search: debouncedSearch, page: 0, size: 10 }, accessToken!),
    enabled: isAuthenticated && !!accessToken,
    staleTime: 10 * 1000,
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()

  return useMutation({
    mutationFn: (data: CreateClientRequest) =>
      clientsApi.create(data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] })
    },
  })
}
