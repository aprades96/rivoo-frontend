import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useClients } from "./use-clients"
import type { Client } from "@/types/client"
import type { Page } from "@/types/api"

const useAuthMock = vi.fn()

vi.mock("@/hooks/use-auth", () => ({
  useAuth: (...args: unknown[]) => useAuthMock(...args),
}))

const list = vi.fn()

vi.mock("@/lib/api/clients", () => ({
  clientsApi: {
    list: (...args: unknown[]) => list(...args),
  },
}))

function makePage(names: string[]): Page<Client> {
  return {
    content: names.map((firstName, i) => ({
      id: `cli_${i}`,
      firstName,
      lastName: "Test",
      email: null,
      phone: null,
      gender: null,
      dateOfBirth: null,
      notes: null,
      source: null,
      totalVisits: 0,
      lastVisitAt: null,
      gdprConsentAt: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    })),
    totalElements: names.length,
    totalPages: 1,
    size: 10,
    number: 0,
    first: true,
    last: true,
    empty: names.length === 0,
  }
}

function Probe({ search }: { search: string }) {
  const { data, isLoading } = useClients(search)

  return (
    <ul>
      <li>{`cargando: ${isLoading}`}</li>
      <li>{`clientes: ${data?.content.map((c) => c.firstName).join(",") ?? "-"}`}</li>
    </ul>
  )
}

function renderProbe(search: string, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  render(
    <QueryClientProvider client={client}>
      <Probe search={search} />
    </QueryClientProvider>
  )
  return { client }
}

describe("useClients", () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    useAuthMock.mockReturnValue({ accessToken: "token", isAuthenticated: true })
    list.mockReset()
    list.mockImplementation((params: { search?: string }) =>
      Promise.resolve(makePage(params.search ? [`resultado-${params.search}`] : ["reciente-1", "reciente-2"]))
    )
  })

  it('con "search" vacio, la query esta habilitada y pide la lista inicial (clientes recientes)', async () => {
    renderProbe("")

    // `findBy*`, no una afirmacion sincrona: el aviso de AGENTS.md sobre
    // `notifyManager` notificando en un macrotask.
    expect(await screen.findByText("clientes: reciente-1,reciente-2")).toBeInTheDocument()
    expect(list).toHaveBeenCalledWith({ search: "", page: 0, size: 10 }, "token")
  })

  it("con texto, manda el search recibido", async () => {
    renderProbe("ana")

    expect(await screen.findByText("clientes: resultado-ana")).toBeInTheDocument()
    expect(list).toHaveBeenCalledWith({ search: "ana", page: 0, size: 10 }, "token")
  })

  it("la queryKey lleva el tamano de pagina, distinto del de /clients (50)", async () => {
    const { client } = renderProbe("")

    expect(await screen.findByText("clientes: reciente-1,reciente-2")).toBeInTheDocument()

    const cached = client.getQueryData(["clients", { search: "", size: 10 }])
    expect(cached).toBeDefined()
    // La clave de /clients (`src/app/(app)/clients/page.tsx:27`) no lleva
    // `size`: si esta cambiara a `["clients", { search: "" }]` sin `size`,
    // ambas pantallas volverian a compartir la misma entrada de cache pese a
    // pedir tamanos de pagina distintos (10 aqui, 50 alli).
    expect(client.getQueryData(["clients", { search: "" }])).toBeUndefined()
  })

  it("no pide nada sin sesion", () => {
    useAuthMock.mockReturnValue({ accessToken: null, isAuthenticated: false })

    renderProbe("")

    expect(list).not.toHaveBeenCalled()
  })
})
