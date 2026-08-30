import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ReactElement } from "react"
import { act, render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useClients, useClientAppointments } from "./use-clients"
import type { Client, ClientAppointmentsPage } from "@/types/client"
import type { Page } from "@/types/api"

const useAuthMock = vi.fn()

vi.mock("@/hooks/use-auth", () => ({
  useAuth: (...args: unknown[]) => useAuthMock(...args),
}))

const list = vi.fn()
const listAppointments = vi.fn()

vi.mock("@/lib/api/clients", () => ({
  clientsApi: {
    list: (...args: unknown[]) => list(...args),
    listAppointments: (...args: unknown[]) => listAppointments(...args),
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

  it("teclear rapido no dispara una peticion por letra: solo el valor asentado tras ~250ms", async () => {
    // Timers falsos, no `userEvent`/`fireEvent`: aqui no hay ningun `<input>`
    // que pulsar, solo cambios de la prop `search` en sucesion -- el mismo
    // "teclear" que hace `ClientStep` al reescribir su estado local en cada
    // `onChange`, sin el conflicto de AGENTS.md entre timers falsos y la
    // simulacion de click/type de `userEvent`.
    vi.useFakeTimers()
    try {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const tree = (search: string) => (
        <QueryClientProvider client={client}>
          <Probe search={search} />
        </QueryClientProvider>
      )
      let rerender!: (ui: ReactElement) => void
      await act(async () => {
        ;({ rerender } = render(tree("")))
        await vi.advanceTimersByTimeAsync(0)
      })

      // Peticion inicial en el montaje: 1 llamada de partida.
      expect(list).toHaveBeenCalledTimes(1)

      // Tres cambios de prop separados 80ms, cada uno por debajo del
      // debounce de 250ms: si cada tecla disparase su propia peticion,
      // `list` tendria 4 llamadas aqui.
      for (const partial of ["F", "Fe", "Fer"]) {
        await act(async () => {
          rerender(tree(partial))
          await vi.advanceTimersByTimeAsync(80)
        })
      }
      expect(list).toHaveBeenCalledTimes(1)

      // Pasado el debounce completo desde el ultimo cambio, se asienta UNA
      // sola peticion con el valor final.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250)
      })
      expect(list).toHaveBeenCalledTimes(2)
      expect(list).toHaveBeenLastCalledWith({ search: "Fer", page: 0, size: 10 }, "token")
    } finally {
      vi.useRealTimers()
    }
  })
})

function makeAppointmentsPage(totalAppointments: number): ClientAppointmentsPage {
  return {
    content: [
      {
        id: "apt_1",
        startTime: "2026-08-05T10:00:00",
        serviceName: "Corte + Secado",
        employeeName: "Laura Martinez",
        price: 35,
        status: "COMPLETED",
      },
    ],
    page: 0,
    size: 7,
    totalElements: totalAppointments,
    totalPages: 1,
    summary: {
      totalAppointments,
      billedAmount: 612,
      completedCount: 11,
      lastCompletedAt: "2026-08-05T10:00:00Z",
    },
  }
}

function AppointmentsProbe({
  clientId,
  page,
  size,
}: {
  clientId: string | undefined
  page?: number
  size?: number
}) {
  const { data, isError } = useClientAppointments(clientId, { page, size })

  return (
    <ul>
      <li>{`total: ${data?.summary.totalAppointments ?? "-"}`}</li>
      <li>{`error: ${isError}`}</li>
    </ul>
  )
}

describe("useClientAppointments", () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    useAuthMock.mockReturnValue({ accessToken: "token", isAuthenticated: true })
    listAppointments.mockReset()
  })

  it("passes page and size through to clientsApi.listAppointments, and reads them back from the queryKey", async () => {
    listAppointments.mockResolvedValue(makeAppointmentsPage(14))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <QueryClientProvider client={client}>
        <AppointmentsProbe clientId="cli_1" page={1} size={7} />
      </QueryClientProvider>
    )

    expect(await screen.findByText("total: 14")).toBeInTheDocument()
    expect(listAppointments).toHaveBeenCalledWith("cli_1", { page: 1, size: 7 }, "token")
    expect(client.getQueryData(["client-appointments", "cli_1", 1, 7])).toBeDefined()
  })

  it("exposes isError instead of hiding a failed fetch behind an empty list (D38)", async () => {
    listAppointments.mockRejectedValue(new Error("appointment-service unavailable"))

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AppointmentsProbe clientId="cli_1" />
      </QueryClientProvider>
    )

    // `findBy*` on the error flag itself: it is what the component does NOT
    // own until the rejected promise's macrotask notification lands
    // (AGENTS.md: `notifyManager` / `await act(async () => {})` cannot flush
    // it). A synchronous assertion here would read the initial render and
    // pass even if `isError` were never wired up.
    expect(await screen.findByText("error: true")).toBeInTheDocument()
    expect(screen.getByText("total: -")).toBeInTheDocument()
  })

  it("does not fetch when there is no clientId", () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AppointmentsProbe clientId={undefined} />
      </QueryClientProvider>
    )

    expect(listAppointments).not.toHaveBeenCalled()
  })
})
