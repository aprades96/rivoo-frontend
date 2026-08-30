import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import StaffPage from "./page"
import type { Employee } from "@/types/employee"
import type { ServiceOffering } from "@/types/service"

// The repo's usual `next/navigation` double (e.g. `staff/[id]/page.test.tsx`)
// hands back an inert `replace: vi.fn()`: with the panel now controlled by
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

// Los cinco empleados dibujados por los dos artboards de Equipo (§1.3):
// cuatro activos y un inactivo (Nil Bosch, sin telefono ni color), en el
// orden `active DESC` que ya da el backend (B1).
const laura: Employee = {
  id: "emp_laura",
  firstName: "Laura",
  lastName: "Martinez",
  email: "laura@rivoo.test",
  phone: "612345678",
  jobTitle: "Estilista",
  colorHex: "#B4522F",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
}
const sofia: Employee = {
  id: "emp_sofia",
  firstName: "Sofia",
  lastName: "Prat",
  email: "sofia@rivoo.test",
  phone: "622345678",
  jobTitle: "Colorista",
  colorHex: "#3B82F6",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
}
const marc: Employee = {
  id: "emp_marc",
  firstName: "Marc",
  lastName: "Oliva",
  email: "marc@rivoo.test",
  phone: "632345678",
  jobTitle: "Barbero",
  colorHex: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
}
const laia: Employee = {
  id: "emp_laia",
  firstName: "Laia",
  lastName: "Serra",
  email: "laia@rivoo.test",
  phone: "642345678",
  jobTitle: "Estilista junior",
  colorHex: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
}
const nil: Employee = {
  id: "emp_nil",
  firstName: "Nil",
  lastName: "Bosch",
  email: "nil@rivoo.test",
  phone: null,
  jobTitle: "Recepcion",
  colorHex: null,
  isActive: false,
  createdAt: "2026-01-01T00:00:00Z",
}
const fiveEmployees = [laura, sofia, marc, laia, nil]

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
    useEmployeesMock.mockReturnValue({
      data: { content: [employee], totalElements: 1 },
      isLoading: false,
    })
    useServicesMock.mockReturnValue({ data: { content: [service] }, isLoading: false })
  })

  afterEach(() => {
    mockMatchMedia(false)
  })

  it("pinta 'Equipo' como titulo de la cabecera en móvil y en escritorio", () => {
    mockMatchMedia(false)
    const { rerenderPage } = renderPage()
    expect(screen.getByRole("heading", { name: "Equipo" })).toBeInTheDocument()

    mockMatchMedia(true)
    rerenderPage()
    expect(screen.getByRole("heading", { name: "Equipo" })).toBeInTheDocument()
  })

  it("cambia el contenido del panel al pulsar la pestaña Servicios, no solo la URL", async () => {
    const user = userEvent.setup()
    const { rerenderPage } = renderPage()

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Ana Garcia")

    await user.click(screen.getByRole("tab", { name: "Servicios" }))

    // El destino de la barra lateral solo escribe la URL: prueba también que
    // se llamó con `replace` (no `push`, no es un paso que "atrás" deba
    // deshacer) antes de comprobar que el panel realmente cambió.
    expect(replaceMock).toHaveBeenCalledWith("/staff?tab=services", { scroll: false })

    // Nuestro doble de router no está enganchado a la reactividad de React
    // (a diferencia del contexto real de Next): el componente no se
    // reevalúa solo porque la variable oculta del mock haya cambiado.
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

  it("sigue a la query cuando cambia sin remontar (navegacion de cliente desde la barra lateral)", async () => {
    // A diferencia de los dos tests anteriores, aquí no hay clic sobre el
    // propio segmentado ni remontaje con la query ya puesta: se monta en
    // /staff (sin query), la query cambia por debajo -- como hace el
    // <Link> de la barra lateral hacia /staff?tab=services, que es
    // navegacion de cliente dentro de la MISMA ruta, no un remount -- y
    // solo entonces se re-renderiza. Con `value={tab}` el panel visible
    // sigue a la query.
    const { rerenderPage } = renderPage()

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Ana Garcia")

    replaceMock("/staff?tab=services")
    rerenderPage()

    const servicesPanel = await screen.findByRole("tabpanel")
    expect(servicesPanel).toHaveTextContent("Corte de pelo")
    expect(servicesPanel).not.toHaveTextContent("Ana Garcia")
  })

  it("cuando falla la petición de empleados, avisa del fallo en vez de afirmar 'Sin empleados' (F1)", async () => {
    const refetch = vi.fn()
    useEmployeesMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch })
    const user = userEvent.setup()

    renderPage()

    expect(screen.getByText("No se ha podido cargar el equipo")).toBeInTheDocument()
    expect(screen.queryByText("Sin empleados")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Reintentar" }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it("cuando falla la petición de servicios, avisa del fallo en vez de afirmar 'Sin servicios' (F1)", async () => {
    const refetch = vi.fn()
    useServicesMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch })
    const user = userEvent.setup()

    const { rerenderPage } = renderPage()
    await user.click(screen.getByRole("tab", { name: "Servicios" }))
    // El doble de `next/navigation` no es reactivo (ver el test de arriba):
    // hace falta un `rerenderPage()` explícito para que el panel lea la
    // nueva query.
    rerenderPage()

    const servicesPanel = await screen.findByRole("tabpanel")
    expect(servicesPanel).toHaveTextContent("No se han podido cargar los servicios")
    expect(screen.queryByText("Sin servicios")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Reintentar" }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  describe("panel Empleados en escritorio", () => {
    beforeEach(() => {
      mockMatchMedia(true)
      useEmployeesMock.mockReturnValue({
        data: { content: fiveEmployees, totalElements: 5 },
        isLoading: false,
      })
    })

    it("pinta una tabla con las seis columnas de §1.3", () => {
      renderPage()

      expect(screen.getByRole("table")).toBeInTheDocument()
      const headers = screen.getAllByRole("columnheader")
      expect(headers.map((h) => h.textContent)).toEqual([
        "Empleado",
        "Puesto",
        "Contacto",
        "Color",
        "Estado",
        "",
      ])
    })

    it("el contador dice '5 empleados · 4 activos' (D8: la página contiene a todo el mundo)", () => {
      renderPage()

      // M4: en escritorio el contador vive junto al segmentado, no dentro
      // del tabpanel (EquipoDesktop.dc.html:92-97, misma fila).
      expect(screen.getByText("5 empleados · 4 activos")).toBeInTheDocument()
      expect(screen.getByRole("tabpanel")).not.toHaveTextContent("5 empleados · 4 activos")
    })

    it("la fila inactiva lleva su clase de tinte (D9) y hay un enlace por fila", () => {
      const { container } = renderPage()

      // La fila de DataTable con `href` lleva `role="row"` explícito (A1):
      // `getByRole("link")` ya no la encuentra, así que se cuenta por el
      // atributo `href` del ancla. El CTA de escritorio ("Añadir empleado")
      // es un <button>, no un <Link>, así que los cinco anclas son
      // exactamente las cinco filas.
      const links = [...container.querySelectorAll("a[href]")]
      expect(links).toHaveLength(5)

      const nilRow = links.find((link) => link.textContent?.includes("Nil Bosch"))
      expect(nilRow).toHaveClass("bg-muted-subtle")

      const lauraRow = links.find((link) => link.textContent?.includes("Laura Martinez"))
      expect(lauraRow).not.toHaveClass("bg-muted-subtle")
    })

    it("'Sin teléfono' y 'Por defecto' aparecen para el empleado sin telefono ni color", () => {
      renderPage()

      // Nil Bosch es el único sin telefono; Marc y Laia también carecen de
      // `colorHex` (§1.3 solo fija el color de Laura y Sofia en el
      // artboard), así que "Por defecto" puede aparecer mas de una vez.
      expect(screen.getByText("Sin teléfono")).toBeInTheDocument()
      expect(screen.getAllByText("Por defecto").length).toBeGreaterThan(0)
    })

    it("con mas gente por debajo de la página y ningun inactivo visto, calla el desglose (D8)", () => {
      const manyActive: Employee[] = Array.from({ length: 100 }, (_, i) => ({
        ...laura,
        id: `emp_${i}`,
        firstName: `Empleado${i}`,
      }))
      useEmployeesMock.mockReturnValue({
        data: { content: manyActive, totalElements: 150 },
        isLoading: false,
      })

      renderPage()

      expect(screen.getByText("150 empleados")).toBeInTheDocument()
      expect(screen.queryByText(/activos/)).not.toBeInTheDocument()
    })

    it("con 150 empleados y una página de 100, avisa del recorte con números reales (F2)", () => {
      const manyActive: Employee[] = Array.from({ length: 100 }, (_, i) => ({
        ...laura,
        id: `emp_${i}`,
        firstName: `Empleado${i}`,
      }))
      useEmployeesMock.mockReturnValue({
        data: { content: manyActive, totalElements: 150 },
        isLoading: false,
      })

      renderPage()

      expect(
        screen.getByText("Mostrando 100 de 150 · la lista pide 100 por página")
      ).toBeInTheDocument()
    })
  })

  describe("panel Empleados en móvil", () => {
    beforeEach(() => {
      mockMatchMedia(false)
      useEmployeesMock.mockReturnValue({
        data: { content: fiveEmployees, totalElements: 5 },
        isLoading: false,
      })
    })

    it("no pinta ninguna tabla y muestra cinco tarjetas enlazadas", () => {
      renderPage()

      expect(screen.queryByRole("table")).not.toBeInTheDocument()
      const links = screen.getAllByRole("link")
      expect(links).toHaveLength(5)
    })

    it("el contador dice '5 empleados' sin desglose", () => {
      renderPage()

      const panel = screen.getByRole("tabpanel")
      expect(panel).toHaveTextContent("5 empleados")
      expect(panel).not.toHaveTextContent("activos")
    })

    it("el CTA 'Añadir' está en el cuerpo del panel, no en la cabecera", () => {
      renderPage()

      const addButtons = screen.getAllByRole("button", { name: "Añadir" })
      expect(addButtons).toHaveLength(1)
      expect(screen.getByRole("tabpanel")).toContainElement(addButtons[0])
    })
  })
})
