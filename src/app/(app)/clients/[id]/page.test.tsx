import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import ClientDetailPage from "./page"
import { useClientAppointments } from "@/hooks/use-clients"
import type { Client, ClientAppointmentsPage } from "@/types/client"

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (...args: unknown[]) => push(...args), back: vi.fn(), replace: vi.fn() }),
}))

let mockIsOwner = true
let mockAccessToken: string | null = "token"
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ accessToken: mockAccessToken, isOwner: mockIsOwner }),
}))

const getClientById = vi.fn()
vi.mock("@/lib/api/clients", () => ({
  clientsApi: { getById: (...args: unknown[]) => getClientById(...args) },
}))

vi.mock("@/hooks/use-clients", () => ({ useClientAppointments: vi.fn() }))
const useClientAppointmentsMock = vi.mocked(useClientAppointments)

// Los tres componentes de abajo son suyos de esta misma tarea, pero cada uno
// tiene su PROPIO fichero de test (D27, D38): aqui se sustituyen por un doble
// inerte para que `page.test.tsx` no dependa de su implementacion interna --
// mismo patron que `clients/page.test.tsx:16-20` con `ClientFormSheet`.
vi.mock("@/components/clients/client-form", () => ({
  ClientFormSheet: ({ open }: { open: boolean }) => (open ? <div data-testid="client-form-sheet" /> : null),
}))
vi.mock("@/components/clients/gdpr-panel", () => ({
  GdprPanel: ({ clientName }: { clientName: string }) => (
    <div data-testid="gdpr-panel">{clientName}</div>
  ),
}))
vi.mock("@/components/clients/client-appointment-history", () => ({
  ClientAppointmentHistory: ({ clientId, isDesktop }: { clientId: string; isDesktop: boolean }) => (
    <div data-testid="appointment-history" data-client-id={clientId} data-desktop={String(isDesktop)} />
  ),
}))

/**
 * El polyfill de `src/test/setup.ts` devuelve SIEMPRE `matches: false`, o sea
 * movil. Escritorio hay que simularlo aqui, y devolverlo a movil en
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
    totalVisits: 0,
    lastVisitAt: null,
    gdprConsentAt: null,
    createdAt: "2023-03-12T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

function makeAppointmentsPage(overrides: Partial<ClientAppointmentsPage["summary"]> = {}): ClientAppointmentsPage {
  return {
    content: [],
    page: 0,
    size: 7,
    totalElements: 0,
    totalPages: 0,
    summary: {
      totalAppointments: 0,
      billedAmount: 0,
      completedCount: 0,
      lastCompletedAt: null,
      ...overrides,
    },
  }
}

function mockAppointments(data: ClientAppointmentsPage | undefined = makeAppointmentsPage()) {
  useClientAppointmentsMock.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useClientAppointments>)
}

// `use()` over a native Promise never resolves synchronously in a test
// render, and neither `await act(async () => {})` nor `await screen.findBy*`
// gets a Suspense retry to commit in jsdom. A synchronous thenable hands back
// the already-available value inside the same `.then()` call, so `use()`
// never needs to suspend. Same pattern as `staff/[id]/page.test.tsx`.
function resolvedParams<T>(value: T): Promise<T> {
  return { then: (onFulfilled: (v: T) => void) => onFulfilled(value) } as unknown as Promise<T>
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ClientDetailPage params={resolvedParams({ id: "cli_1" })} />
    </QueryClientProvider>
  )
}

describe("ClientDetailPage", () => {
  beforeEach(() => {
    push.mockReset()
    getClientById.mockReset()
    mockIsOwner = true
    mockAccessToken = "token"
    mockMatchMedia(false)
    mockAppointments()
  })

  afterEach(() => {
    mockMatchMedia(false)
    mockAccessToken = "token"
  })

  it("mientras carga, pinta un esqueleto", () => {
    getClientById.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(document.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
    expect(screen.queryByText("Ana Garcia")).not.toBeInTheDocument()
  })

  // F1 -- regresion: React Query v5 reporta `isLoading: false` para una query
  // deshabilitada (`enabled: !!accessToken`). En carga en frio `useAuth`
  // devuelve `accessToken: null` mientras resuelve `/api/auth/session`
  // (`use-auth.ts`): sin el `!accessToken` en la guarda de carga, este hueco
  // se colaba directo a la rama de error ("No se ha podido cargar el
  // cliente") en vez de pintar el esqueleto.
  it("F1: con accessToken null (carga en frio), pinta el esqueleto, NO el error", () => {
    mockAccessToken = null
    getClientById.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(document.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
    expect(screen.queryByText("No se ha podido cargar el cliente")).not.toBeInTheDocument()
    expect(getClientById).not.toHaveBeenCalled()
  })

  // §1.11.3: la rama de error tiene que ser VISIBLE, no un esqueleto
  // perpetuo. `isLoading`/`isError`/`!client` estaban colapsados en un solo
  // camino antes de esta tarea.
  it("con un 404/500, pinta un estado de error con reintentar (no un esqueleto perpetuo)", async () => {
    getClientById.mockRejectedValue(new Error("not found"))

    renderPage()

    expect(await screen.findByText("No se ha podido cargar el cliente")).toBeInTheDocument()
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument()

    getClientById.mockResolvedValue(makeClient())
    await userEvent.setup().click(screen.getByRole("button", { name: "Reintentar" }))

    await screen.findAllByText("Ana Garcia")
  })

  describe("movil", () => {
    it("titulo generico 'Detalle cliente', Editar como icono, sin 'Nueva cita', y solo UN boton Editar", async () => {
      getClientById.mockResolvedValue(makeClient())

      renderPage()

      // El titulo generico "Detalle cliente" tambien lo pinta el ESQUELETO
      // (`title="Cliente" mobileTitle="Detalle cliente"`, `:69-74`): hay que
      // esperar a algo que solo exista una vez cargado el cliente antes de
      // comprobar el resto.
      await screen.findAllByText("Ana Garcia")

      expect(screen.getByRole("heading", { name: "Detalle cliente" })).toBeInTheDocument()
      expect(screen.queryByRole("heading", { name: "Ana Garcia" })).not.toBeInTheDocument()
      expect(screen.getAllByRole("button", { name: "Editar" })).toHaveLength(1)
      expect(screen.queryByText("Nueva cita")).not.toBeInTheDocument()
      expect(screen.getByTestId("appointment-history")).toHaveAttribute("data-desktop", "false")
    })

    it("D29: el telefono se pinta formateado, y el boton Llamar es un enlace tel:", async () => {
      getClientById.mockResolvedValue(makeClient({ phone: "612345678" }))

      renderPage()

      expect(await screen.findByText("612 345 678")).toBeInTheDocument()
      const callLink = screen.getByRole("link", { name: /Llamar/ })
      expect(callLink).toHaveAttribute("href", "tel:612345678")
    })

    it("sin telefono, no pinta el boton Llamar", async () => {
      getClientById.mockResolvedValue(makeClient({ phone: null }))

      renderPage()

      await screen.findAllByText("Ana Garcia")
      expect(screen.queryByRole("link", { name: /Llamar/ })).not.toBeInTheDocument()
    })
  })

  describe("escritorio", () => {
    it("el nombre del cliente es el titulo, Editar lleva texto, y CTA 'Nueva cita'", async () => {
      mockMatchMedia(true)
      getClientById.mockResolvedValue(makeClient())

      renderPage()

      expect(await screen.findByRole("heading", { name: "Ana Garcia" })).toBeInTheDocument()
      expect(screen.queryByRole("heading", { name: "Detalle cliente" })).not.toBeInTheDocument()
      expect(screen.getAllByRole("button", { name: /Editar/ })).toHaveLength(1)
      expect(screen.getByRole("button", { name: /Nueva cita/ })).toBeInTheDocument()
      expect(screen.getByTestId("appointment-history")).toHaveAttribute("data-desktop", "true")
    })

    it("D28: en NINGUN momento hay dos botones 'Editar' a la vez en el DOM", async () => {
      mockMatchMedia(true)
      getClientById.mockResolvedValue(makeClient())

      renderPage()
      await screen.findByRole("heading", { name: "Ana Garcia" })

      expect(screen.getAllByRole("button", { name: /Editar/ })).toHaveLength(1)
    })

    it("badge 'Reserva online' solo si source === ONLINE_BOOKING", async () => {
      mockMatchMedia(true)
      getClientById.mockResolvedValue(makeClient({ source: "ONLINE_BOOKING" }))

      renderPage()

      expect(await screen.findByText("Reserva online")).toBeInTheDocument()
    })

    it("sin ONLINE_BOOKING, no pinta el badge", async () => {
      mockMatchMedia(true)
      getClientById.mockResolvedValue(makeClient({ source: "MANUAL" }))

      renderPage()

      await screen.findByRole("heading", { name: "Ana Garcia" })
      expect(screen.queryByText("Reserva online")).not.toBeInTheDocument()
    })

    it("no pinta el boton 'Llamar' (D25)", async () => {
      mockMatchMedia(true)
      getClientById.mockResolvedValue(makeClient())

      renderPage()

      await screen.findByRole("heading", { name: "Ana Garcia" })
      expect(screen.queryByRole("link", { name: /Llamar/ })).not.toBeInTheDocument()
    })

    it("D26: 'Nueva cita' navega a /appointments/new con el clientId", async () => {
      mockMatchMedia(true)
      getClientById.mockResolvedValue(makeClient({ id: "cli_42" }))

      renderPage()
      await userEvent.setup().click(await screen.findByRole("button", { name: /Nueva cita/ }))

      expect(push).toHaveBeenCalledWith("/appointments/new?clientId=cli_42")
    })
  })

  // D21: `formatDate`, no `toLocaleDateString` a mano -- el repo entero usa
  // "12 mar 2023", no "12/3/2023".
  it("D21: 'Cliente desde' usa formatDate", async () => {
    getClientById.mockResolvedValue(makeClient({ createdAt: "2023-03-12T00:00:00Z" }))

    renderPage()

    expect(await screen.findByText("Cliente desde 12 mar 2023")).toBeInTheDocument()
  })

  describe("D36: los KPIs salen del resumen del historial, no del contador almacenado", () => {
    it("con client.totalVisits en 0 y un resumen con completedCount 11, el KPI Visitas dice 11", async () => {
      getClientById.mockResolvedValue(makeClient({ totalVisits: 0 }))
      mockAppointments(makeAppointmentsPage({ completedCount: 11, lastCompletedAt: "2026-08-05T10:00:00Z" }))

      renderPage()

      const visitsLabel = await screen.findByText("Visitas")
      const visitsCard = visitsLabel.closest('[data-slot="card"]')
      expect(visitsCard).not.toBeNull()
      expect(visitsCard!.textContent).toContain("11")
      expect(visitsCard!.textContent).not.toContain("0")
    })

    it("con lastCompletedAt nulo, 'Última visita' pinta — (D21)", async () => {
      getClientById.mockResolvedValue(makeClient())
      mockAppointments(makeAppointmentsPage({ completedCount: 0, lastCompletedAt: null }))

      renderPage()

      const label = await screen.findByText("Última visita")
      expect(label.closest('[data-slot="card"]')!.textContent).toContain("—")
    })

    it("con lastCompletedAt presente, pinta la fecha con formatDate", async () => {
      getClientById.mockResolvedValue(makeClient())
      mockAppointments(makeAppointmentsPage({ completedCount: 3, lastCompletedAt: "2026-08-05T10:00:00Z" }))

      renderPage()

      const label = await screen.findByText("Última visita")
      expect(label.closest('[data-slot="card"]')!.textContent).toContain("5 ago 2026")
    })

    // F2 -- D38 aplicado a los KPIs: si el historial esta en error, `data` es
    // `undefined` y antes se pintaba "Visitas 0 · Última visita —" como si
    // fueran datos reales, a la vez que la columna del historial decia "No se
    // ha podido cargar el historial". Un cero que parece un dato no vale.
    it("F2: con el historial en error, los KPIs NO pintan '0' -- usan el mismo valor vacio que una fecha ausente", async () => {
      getClientById.mockResolvedValue(makeClient())
      useClientAppointmentsMock.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useClientAppointments>)

      renderPage()

      const visitsCard = (await screen.findByText("Visitas")).closest('[data-slot="card"]')
      const lastVisitCard = screen.getByText("Última visita").closest('[data-slot="card"]')
      expect(visitsCard!.textContent).not.toContain("0")
      expect(visitsCard!.textContent).toContain("—")
      expect(lastVisitCard!.textContent).toContain("—")
    })
  })

  describe("GDPR solo para SALON_OWNER", () => {
    it("isOwner: pinta el panel GDPR", async () => {
      mockIsOwner = true
      getClientById.mockResolvedValue(makeClient())

      renderPage()

      expect(await screen.findByTestId("gdpr-panel")).toBeInTheDocument()
    })

    it("sin isOwner: no pinta el panel GDPR ni el boton Editar", async () => {
      mockIsOwner = false
      getClientById.mockResolvedValue(makeClient())

      renderPage()

      await screen.findAllByText("Ana Garcia")
      expect(screen.queryByTestId("gdpr-panel")).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument()
    })
  })
})
