import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import ClientsPage from "./page"
import type { Client } from "@/types/client"
import type { Page } from "@/types/api"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ accessToken: "token", isAuthenticated: true }),
}))

// T8 (ola 2, en paralelo) sigue tocando `client-form.tsx`: se sustituye por un
// doble inerte para que este fichero no dependa de su implementacion interna.
vi.mock("@/components/clients/client-form", () => ({
  ClientFormSheet: () => null,
}))

const list = vi.fn()

vi.mock("@/lib/api/clients", () => ({
  clientsApi: {
    list: (...args: unknown[]) => list(...args),
  },
}))

/**
 * El polyfill de `src/test/setup.ts` devuelve SIEMPRE `matches: false`, o sea
 * móvil. Escritorio hay que simularlo aquí, y devolverlo a móvil en
 * `afterEach` para no contaminar el siguiente caso (AGENTS.md).
 */
function mockMatchMedia(desktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: desktop,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "cli_1",
    firstName: "Ana",
    lastName: "Garcia",
    email: "ana@test.com",
    phone: "612345678",
    gender: null,
    notes: null,
    source: null,
    totalVisits: 5,
    lastVisitAt: "2026-08-12T10:00:00Z",
    gdprConsentAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

function makePage(content: Client[], totalElements = content.length): Page<Client> {
  return {
    content,
    totalElements,
    totalPages: 1,
    size: 50,
    number: 0,
    first: true,
    last: true,
    empty: content.length === 0,
  }
}

function renderPage(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  render(
    <QueryClientProvider client={client}>
      <ClientsPage />
    </QueryClientProvider>
  )
  return { client }
}

describe("ClientsPage", () => {
  beforeEach(() => {
    list.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    mockMatchMedia(false)
  })

  it("en móvil, pinta tarjetas (no una tabla), con el subtitulo en una sola línea y el bloque de visitas con etiqueta", async () => {
    mockMatchMedia(false)
    list.mockResolvedValue(makePage([makeClient()], 248))

    renderPage()

    expect(await screen.findByText("Ana Garcia")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.getByText("612 345 678 · ana@test.com")).toBeInTheDocument()
    expect(screen.getByText("visitas")).toBeInTheDocument()
    // D22: el móvil no dibuja la línea de paginacion.
    expect(screen.queryByText(/la lista pide/)).not.toBeInTheDocument()
  })

  // R2 (residuo de auditoria): `/clients` pide una sola pagina de 50 sin
  // paginacion real (D22, `PAGE_SIZE`). Con mas de 50 clientes, el backend
  // sirve `totalElements: 248` pero `content` solo trae la pagina -- el
  // contador de movil NO puede afirmar "248 clientes" cuando solo hay UNA
  // tarjeta pintada debajo: eso es mentir sobre el recorte, no "callar" la
  // linea "Mostrando X de Y" que el artboard de movil no dibuja.
  it("R2: con mas clientes que los que trae la pagina, el contador de movil NO afirma el total recortado", async () => {
    mockMatchMedia(false)
    list.mockResolvedValue(makePage([makeClient()], 248))

    renderPage()

    expect(await screen.findByText("Ana Garcia")).toBeInTheDocument()
    expect(screen.queryByText("248 clientes")).not.toBeInTheDocument()
    expect(screen.getByText("1 cliente")).toBeInTheDocument()
  })

  it("en escritorio, pinta una tabla con las cinco columnas, formatDate, y la línea de paginacion FUERA de la tabla (D21, D22)", async () => {
    mockMatchMedia(true)
    list.mockResolvedValue(
      makePage(
        [
          makeClient({ id: "cli_1", email: "ana@test.com", phone: "612345678", lastVisitAt: "2026-08-12T10:00:00Z" }),
          makeClient({
            id: "cli_2",
            firstName: "Marc",
            lastName: "Oliva",
            email: null,
            phone: "699111222",
            lastVisitAt: null,
          }),
          makeClient({
            id: "cli_3",
            firstName: "Laia",
            lastName: "Serra",
            email: null,
            phone: null,
            lastVisitAt: null,
          }),
        ],
        248
      )
    )

    renderPage()

    const table = await screen.findByRole("table", { name: "Clientes" })
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Cliente",
      "Contacto",
      "Última visita",
      "Visitas",
      "",
    ])
    expect(screen.getByText("12 ago 2026")).toBeInTheDocument()
    expect(screen.getByText("Sin correo")).toBeInTheDocument()
    expect(screen.getByText("Sin contacto")).toBeInTheDocument()

    // Fuera de la tabla, con números reales.
    expect(within(table).queryByText(/Mostrando/)).not.toBeInTheDocument()
    expect(screen.getByText("Mostrando 3 de 248 · la lista pide 50 por página")).toBeInTheDocument()
  })

  it("conserva el vacío inicial (D23) cuando no hay clientes", async () => {
    list.mockResolvedValue(makePage([], 0))

    renderPage()

    expect(await screen.findByText("Sin clientes")).toBeInTheDocument()
  })

  it("cuando la petición falla, avisa del fallo en vez de afirmar 'Sin clientes' (F1)", async () => {
    list.mockRejectedValue(new Error("network down"))

    renderPage()

    // `findBy*` prueba que el estado de error aterrizó de verdad (AGENTS.md:
    // una aserción síncrona pasaría igual con el fallo reintroducido, porque
    // `isLoading` seguiría en `true` en el primer render).
    expect(
      await screen.findByText("No se han podido cargar los clientes")
    ).toBeInTheDocument()
    expect(screen.queryByText("Sin clientes")).not.toBeInTheDocument()
  })

  it("la queryKey lleva `size: 50`, distinto del `size: 10` de useClients (D34)", async () => {
    list.mockResolvedValue(makePage([makeClient()], 1))
    const { client } = renderPage()

    expect(await screen.findByText("Ana Garcia")).toBeInTheDocument()
    expect(list).toHaveBeenCalledWith({ search: undefined, page: 0, size: 50 }, "token")
    expect(client.getQueryData(["clients", { search: "", size: 50 }])).toBeDefined()
    expect(client.getQueryData(["clients", { search: "", size: 10 }])).toBeUndefined()
  })

  it("teclear rapido dispara UNA sola petición tras ~250ms (D20)", async () => {
    vi.useFakeTimers()
    list.mockResolvedValue(makePage([makeClient()], 1))

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ClientsPage />
      </QueryClientProvider>
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText("Ana Garcia")).toBeInTheDocument()
    expect(list).toHaveBeenCalledTimes(1)

    const input = screen.getByPlaceholderText("Buscar clientes...")

    // Tres pulsaciones separadas 80ms, todas por debajo del debounce de
    // 250ms: si cada una disparase su propia petición, `list` tendría 4
    // llamadas al final del bucle.
    for (const partial of ["F", "Fe", "Fer"]) {
      await act(async () => {
        fireEvent.change(input, { target: { value: partial } })
        await vi.advanceTimersByTimeAsync(80)
      })
    }
    expect(list).toHaveBeenCalledTimes(1)

    // Pasado el debounce completo desde la última tecla, se asienta UNA sola
    // petición con el valor final.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250)
    })
    expect(list).toHaveBeenCalledTimes(2)
    expect(list).toHaveBeenLastCalledWith({ search: "Fer", page: 0, size: 50 }, "token")
  })

  it("mientras la petición del texto asentado está en vuelo, la lista NO se desmonta (keepPreviousData, D20)", async () => {
    vi.useFakeTimers()

    // La PRIMERA petición se resuelve al momento (monta la página inicial).
    // La SEGUNDA -- la que dispara el debounce tras teclear -- se deja en
    // vuelo a proposito, con una promesa que esta prueba controla a mano:
    // es el único modo de observar el instante exacto en que la queryKey ya
    // cambio pero el dato nuevo todavia no ha llegado, que es precisamente
    // cuando `useDeferredValue` desmontaba la lista para pintar el
    // esqueleto. Con una promesa que se resuelve sola (como en el test de
    // arriba) ese instante dura 0ms reales y no hay forma de mirarlo.
    let resolveSecond!: (page: Page<Client>) => void
    list
      .mockResolvedValueOnce(makePage([makeClient()], 1))
      .mockImplementationOnce(
        () => new Promise<Page<Client>>((resolve) => { resolveSecond = resolve })
      )

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ClientsPage />
      </QueryClientProvider>
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText("Ana Garcia")).toBeInTheDocument()

    const input = screen.getByPlaceholderText("Buscar clientes...")
    await act(async () => {
      fireEvent.change(input, { target: { value: "Fer" } })
      // El debounce completo: la queryKey cambia y la segunda petición (la
      // promesa controlada, todavia sin resolver) queda en vuelo.
      await vi.advanceTimersByTimeAsync(250)
    })
    expect(list).toHaveBeenCalledTimes(2)

    // AQUI es donde `keepPreviousData` importa: la página anterior sigue
    // pintada y no aparece el esqueleto de carga mientras la respuesta nueva
    // no ha llegado.
    expect(screen.getByText("Ana Garcia")).toBeInTheDocument()
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument()

    // Se resuelve la segunda petición -- dato que el componente NO poseia
    // hasta ahora -- y se comprueba que aterriza de verdad.
    await act(async () => {
      resolveSecond(makePage([makeClient({ firstName: "Resultado-Fer" })], 1))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(screen.getByText("Resultado-Fer Garcia")).toBeInTheDocument()
    expect(screen.queryByText("Ana Garcia")).not.toBeInTheDocument()
  })
})
