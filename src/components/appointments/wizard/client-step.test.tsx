import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ClientStep } from "./client-step"
import { useWizardStore } from "@/lib/stores/wizard-store"
import { useClients } from "@/hooks/use-clients"
import { useEmployees } from "@/hooks/use-staff"
import type { Client } from "@/types/client"

vi.mock("@/hooks/use-clients", () => ({ useClients: vi.fn() }))

// `WizardContextPills` (pintada en movil) llama a `useEmployees`, que a su vez
// llama a `useAuth`/`useSession` -- sin mock revienta con "useSession must be
// wrapped in a SessionProvider" porque el test no monta ese provider. Mismo
// mock que `wizard-context-pills.test.tsx:9`.
vi.mock("@/hooks/use-staff", () => ({ useEmployees: vi.fn(() => ({ data: { content: [] } })) }))

// D26: la resolucion de `preferredClientId` llama a `useAuth()` directamente
// (no a traves de un hook ya mockeado como `useClients`), asi que hace falta
// su propio doble -- mismo motivo que `confirmation-step.test.tsx:14-16`.
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ accessToken: "token", isAuthenticated: true }),
}))

const getClientById = vi.fn()
vi.mock("@/lib/api/clients", () => ({
  clientsApi: { getById: (...args: unknown[]) => getClientById(...args) },
}))

// `useWizardNavigation` llama a `useRouter()`: sin `AppRouterContext` montado
// lanza "invariant expected app router to be mounted" -- mismo mock que
// `service-step.test.tsx:20-22`.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}))

const useClientsMock = vi.mocked(useClients)

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

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "cli_1",
    firstName: "Ana",
    lastName: "Garcia",
    email: null,
    phone: "612345678",
    gender: null,
    notes: null,
    source: null,
    totalVisits: 14,
    lastVisitAt: null,
    gdprConsentAt: null,
    createdAt: "2026-01-01T00:00:00",
    updatedAt: "2026-01-01T00:00:00",
    ...overrides,
  }
}

function clientsPage(content: Client[]) {
  return { content, totalElements: content.length } as unknown as ReturnType<typeof useClients>["data"]
}

function mockClients(content: Client[], isLoading = false) {
  useClientsMock.mockReturnValue({
    data: clientsPage(content),
    isLoading,
  } as unknown as ReturnType<typeof useClients>)
}

// `preferredClientId` (D26) resuelve con un `useQuery` REAL sobre
// `clientsApi.getById`, no con un hook mockeado -- necesita su propio
// `QueryClientProvider`, igual que `confirmation-step.test.tsx:128-137`.
function renderStep() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ClientStep />
    </QueryClientProvider>
  )
}

describe("ClientStep", () => {
  beforeEach(() => {
    // `nextStep` avanza UN paso desde donde este el store
    // (`wizard-store.ts:63`): sembrado en 4, como si el asistente ya
    // hubiera pasado por los tres primeros pasos.
    useWizardStore.getState().reset({ step: 4 })
    mockMatchMedia(false)
    mockClients([makeClient()])
    getClientById.mockReset()
    // El fichero no resetea mocks entre tests: sin re-sembrar aqui el valor por
    // defecto, un `mockReturnValue` de cualquier test se filtraria a todos los
    // siguientes.
    vi.mocked(useEmployees).mockReturnValue({
      data: { content: [] },
    } as unknown as ReturnType<typeof useEmployees>)
  })

  afterEach(() => {
    mockMatchMedia(false)
  })

  it("pinta la lista sin haber escrito nada en el buscador", () => {
    renderStep()

    expect(screen.getByText("Ana Garcia")).toBeInTheDocument()
    expect(screen.getByText("Clientes recientes")).toBeInTheDocument()
  })

  it("escribir en el buscador cambia la consulta que hace useClients", async () => {
    const user = userEvent.setup()
    renderStep()

    await user.type(screen.getByPlaceholderText("Buscar por nombre..."), "Carla")

    // Ultima llamada al hook mockeado: prueba que el texto tecleado llega
    // como argumento de `useClients`, no solo que el input cambio de valor.
    const lastCall = useClientsMock.mock.calls.at(-1)
    expect(lastCall?.[0]).toBe("Carla")
  })

  it("con texto en el buscador no pinta la etiqueta 'Clientes recientes'", async () => {
    const user = userEvent.setup()
    renderStep()

    await user.type(screen.getByPlaceholderText("Buscar por nombre..."), "Carla")

    expect(screen.queryByText("Clientes recientes")).not.toBeInTheDocument()
  })

  it("elegir un cliente lo guarda en el store y avanza al paso 5", async () => {
    const user = userEvent.setup()
    renderStep()

    await user.click(screen.getByRole("button", { name: /Ana Garcia/ }))

    const state = useWizardStore.getState()
    expect(state.selectedClient?.id).toBe("cli_1")
    expect(state.step).toBe(5)
  })

  it("'Crear nuevo cliente' abre el formulario de alta en linea", async () => {
    const user = userEvent.setup()
    renderStep()

    await user.click(screen.getByRole("button", { name: /Crear nuevo cliente/ }))

    expect(screen.getByLabelText("Nombre *")).toBeInTheDocument()
    expect(screen.getByLabelText("Apellidos *")).toBeInTheDocument()
  })

  it("no existe ningun boton 'Continuar sin cliente'", () => {
    renderStep()

    expect(screen.queryByText(/Continuar sin cliente/)).not.toBeInTheDocument()
  })

  it("en movil el buscador pide nombre, en escritorio nombre/telefono/email", () => {
    const { unmount } = renderStep()
    expect(screen.getByPlaceholderText("Buscar por nombre...")).toBeInTheDocument()
    expect(screen.queryByPlaceholderText("Buscar por nombre, teléfono o email...")).not.toBeInTheDocument()
    unmount()

    mockMatchMedia(true)
    renderStep()
    expect(screen.getByPlaceholderText("Buscar por nombre, teléfono o email...")).toBeInTheDocument()
    expect(screen.queryByPlaceholderText("Buscar por nombre...")).not.toBeInTheDocument()
  })

  it("pinta '0 visitas' tal cual devuelve el backend, sin derivarlo de otra fuente", () => {
    mockClients([makeClient({ totalVisits: 0 })])
    renderStep()

    expect(screen.getByText(/0 visitas/)).toBeInTheDocument()
  })

  it("sin telefono muestra 'Sin contacto' junto a las visitas", () => {
    mockClients([makeClient({ phone: null })])
    renderStep()

    expect(screen.getByText(/Sin contacto/)).toBeInTheDocument()
  })

  it("con 1 visita usa el singular", () => {
    mockClients([makeClient({ totalVisits: 1 })])
    renderStep()

    expect(screen.getByText(/1 visita(?!s)/)).toBeInTheDocument()
    expect(screen.queryByText(/1 visitas/)).not.toBeInTheDocument()
  })

  it("el aside de escritorio pinta 'Resumen', no la cabecera ni la nota de la reserva publica", () => {
    mockMatchMedia(true)
    renderStep()

    expect(screen.getByText("Resumen")).toBeInTheDocument()
    expect(screen.queryByText("Tu reserva")).not.toBeInTheDocument()
    expect(screen.queryByText(/Sin registro/)).not.toBeInTheDocument()
    expect(screen.queryByText(/cancela gratis/)).not.toBeInTheDocument()
  })

  // Con "Sin preferencia" la cita YA tiene profesional en cuanto hay hueco: es
  // el dueno del hueco (`selectedSlotEmployeeId`). Los pasos 3 y 5 lo nombran
  // en su aside; si el 4 no lo hiciera, el asistente afirmaria "Sin
  // preferencia" en una pantalla y el nombre en las dos de al lado.
  it("con 'Sin preferencia' y hueco elegido el aside nombra al dueno del hueco", () => {
    mockMatchMedia(true)
    vi.mocked(useEmployees).mockReturnValue({
      data: { content: [{ id: "emp_2", firstName: "Mia", lastName: "Soler" }] },
    } as unknown as ReturnType<typeof useEmployees>)
    useWizardStore.setState({
      anyEmployee: true,
      selectedEmployee: null,
      selectedSlotEmployeeId: "emp_2",
      selectedDate: "2026-08-28",
      selectedSlot: "2026-08-28T11:00:00",
    })
    renderStep()

    expect(screen.getByText("Mia Soler")).toBeInTheDocument()
    expect(screen.queryByText("Sin preferencia")).not.toBeInTheDocument()
  })

  // D26: `/clients/{id}` -> "Nueva cita" siembra `preferredClientId`. El
  // resto del asistente NO se altera: el usuario sigue pasando por los pasos
  // 1-3 con normalidad y este paso resuelve el cliente en cuanto llega su
  // turno.
  describe("prefill de preferredClientId (D26)", () => {
    it("con un preferredClientId que resuelve, selecciona el cliente y avanza al paso 5 sin intervencion", async () => {
      const preferred = makeClient({ id: "cli_9", firstName: "Marc", lastName: "Oliva" })
      getClientById.mockResolvedValue(preferred)
      useWizardStore.getState().reset({ step: 4, preferredClientId: "cli_9" })

      renderStep()

      // `findBy*` sobre el paso 5 -- algo que este componente NO posee -- para
      // probar que el dato aterrizo de verdad (AGENTS.md: los tests de React
      // Query pueden pasar en falso si solo se comprueba de forma sincrona).
      await waitFor(() => expect(useWizardStore.getState().step).toBe(5))
      expect(useWizardStore.getState().selectedClient?.id).toBe("cli_9")
      expect(useWizardStore.getState().preferredClientId).toBeNull()
      expect(getClientById).toHaveBeenCalledWith("cli_9", "token")
    })

    it("con un preferredClientId que no resuelve (404), limpia la preferencia y deja la lista normal", async () => {
      getClientById.mockRejectedValue(new Error("not found"))
      useWizardStore.getState().reset({ step: 4, preferredClientId: "cli_ghost" })

      renderStep()

      await waitFor(() => expect(useWizardStore.getState().preferredClientId).toBeNull())
      expect(useWizardStore.getState().step).toBe(4)
      expect(screen.getByText("Ana Garcia")).toBeInTheDocument()
    })

    it("sin preferredClientId, no llama a clientsApi.getById", () => {
      renderStep()

      expect(getClientById).not.toHaveBeenCalled()
    })
  })

  describe("alta de cliente en linea", () => {
    async function openForm(user: ReturnType<typeof userEvent.setup>) {
      renderStep()
      await user.click(screen.getByRole("button", { name: /Crear nuevo cliente/ }))
    }

    it("rellenar nombre y apellidos y pulsar 'Continuar' escribe newClientData y avanza al paso 5", async () => {
      const user = userEvent.setup()
      await openForm(user)

      await user.type(screen.getByLabelText("Nombre *"), "Fernando")
      await user.type(screen.getByLabelText("Apellidos *"), "Perez")
      await user.click(screen.getByRole("button", { name: "Continuar" }))

      const state = useWizardStore.getState()
      expect(state.newClientData).toMatchObject({ firstName: "Fernando", lastName: "Perez" })
      expect(state.step).toBe(5)
    })

    it("sin apellidos, 'Continuar' esta deshabilitado y no avanza", async () => {
      const user = userEvent.setup()
      await openForm(user)

      await user.type(screen.getByLabelText("Nombre *"), "Fernando")
      const continueButton = screen.getByRole("button", { name: "Continuar" })
      expect(continueButton).toBeDisabled()

      await user.click(continueButton)

      const state = useWizardStore.getState()
      expect(state.newClientData).toBeNull()
      expect(state.step).toBe(4)
    })

    it("con nombre y apellidos completos, 'Continuar' se habilita", async () => {
      const user = userEvent.setup()
      await openForm(user)

      const continueButton = screen.getByRole("button", { name: "Continuar" })
      expect(continueButton).toBeDisabled()

      await user.type(screen.getByLabelText("Nombre *"), "Fernando")
      expect(continueButton).toBeDisabled()

      await user.type(screen.getByLabelText("Apellidos *"), "Perez")
      expect(continueButton).toBeEnabled()
    })
  })
})
