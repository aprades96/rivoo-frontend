import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import StaffPage from "./page"
import type { Employee } from "@/types/employee"
import type { ServiceOffering } from "@/types/service"

// The repo's usual `next/navigation` double (e.g. `staff/[id]/page.test.tsx`)
// hands back an inert `replace: vi.fn()`: with the Tabs now controlled by
// the URL, clicking a tab would only record that call -- `useSearchParams()`
// would stay frozen, the panel would never switch, and the test would be a
// permanent false green for the exact defect this suite exists to catch
// (`?tab=services` lighting up the sidebar destination without the content
// following). This double instead feeds the mocked `replace` back into a
// `URLSearchParams` that the mocked `useSearchParams` reads, and each test
// calls `rerenderPage()` afterward to observe it -- our double isn't wired
// into React's reactivity the way Next's real router context is.
const { getSearchParams, replaceMock, resetSearchParams } = vi.hoisted(() => {
  let params = new URLSearchParams()
  return {
    getSearchParams: () => params,
    replaceMock: vi.fn((url: string) => {
      const queryString = url.includes("?") ? url.split("?")[1] : ""
      params = new URLSearchParams(queryString)
    }),
    resetSearchParams: () => {
      params = new URLSearchParams()
    },
  }
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock, back: vi.fn() }),
  useSearchParams: () => getSearchParams(),
}))

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ accessToken: "token", isAuthenticated: true, isOwner: true }),
}))

const useEmployeesMock = vi.fn()
const useServicesMock = vi.fn()

vi.mock("@/hooks/use-staff", () => ({
  useEmployees: (...args: unknown[]) => useEmployeesMock(...args),
  useServices: (...args: unknown[]) => useServicesMock(...args),
}))

const employee: Employee = {
  id: "emp_1",
  firstName: "Ana",
  lastName: "Garcia",
  email: "ana@rivoo.test",
  phone: null,
  jobTitle: "Estilista",
  colorHex: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
}

const service: ServiceOffering = {
  id: "svc_1",
  name: "Corte de pelo",
  description: null,
  durationMinutes: 30,
  price: 20,
  category: null,
  isActive: true,
}

/** `matches: desktop` para simular `(min-width: 1024px)`; jsdom no tiene layout real. */
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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // `buildUi()` crea un elemento NUEVO en cada llamada a proposito: pasar el
  // mismo objeto JSX de vuelta a `rerender` deja a React bailar la
  // reconciliacion entera (oldProps === newProps en cada nivel, incluido
  // `StaffPageContent`), que es indistinguible de "no cambio nada" -- y es
  // justo el escenario que hace falta forzar, porque nuestro doble de
  // `useSearchParams` no es reactivo por si solo.
  const buildUi = () => (
    <QueryClientProvider client={queryClient}>
      <StaffPage />
    </QueryClientProvider>
  )
  const utils = render(buildUi())
  return {
    ...utils,
    rerenderPage: () => utils.rerender(buildUi()),
  }
}

describe("StaffPage", () => {
  beforeEach(() => {
    resetSearchParams()
    replaceMock.mockClear()
    useEmployeesMock.mockReset()
    useServicesMock.mockReset()
    useEmployeesMock.mockReturnValue({ data: { content: [employee] }, isLoading: false })
    useServicesMock.mockReturnValue({ data: { content: [service] }, isLoading: false })
  })

  afterEach(() => {
    mockMatchMedia(false)
  })

  it("pinta 'Equipo' como titulo de la cabecera en movil y en escritorio", () => {
    mockMatchMedia(false)
    const { rerenderPage } = renderPage()
    expect(screen.getByRole("heading", { name: "Equipo" })).toBeInTheDocument()

    mockMatchMedia(true)
    rerenderPage()
    expect(screen.getByRole("heading", { name: "Equipo" })).toBeInTheDocument()
  })

  it("cambia el contenido del panel al pulsar la pestana Servicios, no solo la URL", async () => {
    const user = userEvent.setup()
    const { rerenderPage } = renderPage()

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Ana Garcia")

    await user.click(screen.getByRole("tab", { name: "Servicios" }))

    // El destino de la barra lateral solo escribe la URL: prueba tambien que
    // se llamo con `replace` (no `push`, no es un paso que "atras" deba
    // deshacer) antes de comprobar que el panel realmente cambio.
    expect(replaceMock).toHaveBeenCalledWith("/staff?tab=services", { scroll: false })

    // Nuestro doble de router no esta enganchado a la reactividad de React
    // (a diferencia del contexto real de Next): el componente no se
    // reevalua solo porque la variable oculta del mock haya cambiado.
    rerenderPage()

    const servicesPanel = await screen.findByRole("tabpanel")
    expect(servicesPanel).toHaveTextContent("Corte de pelo")
    expect(servicesPanel).not.toHaveTextContent("Ana Garcia")
  })

  it("aterriza directamente en Servicios cuando la URL ya trae '?tab=services'", async () => {
    replaceMock("/staff?tab=services")

    renderPage()

    const servicesPanel = await screen.findByRole("tabpanel")
    expect(servicesPanel).toHaveTextContent("Corte de pelo")
  })
})
