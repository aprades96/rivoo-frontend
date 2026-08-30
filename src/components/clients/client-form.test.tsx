import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ClientFormSheet } from "./client-form"
import { ApiError, type ProblemDetail } from "@/lib/api/client"
import type { Client } from "@/types/client"

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ accessToken: "token" }),
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}))

const createClient = vi.fn()
const updateClient = vi.fn()
vi.mock("@/lib/api/clients", () => ({
  clientsApi: {
    create: (...args: unknown[]) => createClient(...args),
    update: (...args: unknown[]) => updateClient(...args),
  },
}))

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

const mockClient: Client = {
  id: "cli_1",
  firstName: "Ana",
  lastName: "Lopez",
  email: "ana@test.com",
  phone: "612345678",
  gender: null,
  notes: null,
  source: null,
  totalVisits: 5,
  lastVisitAt: null,
  gdprConsentAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}

function renderSheet(client: Client | null, onOpenChange: (open: boolean) => void = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const ui = (c: Client | null) => (
    <QueryClientProvider client={queryClient}>
      <ClientFormSheet open onOpenChange={onOpenChange} client={c} />
    </QueryClientProvider>
  )
  const utils = render(ui(client))
  return {
    ...utils,
    rerenderWith: (next: Client | null) => utils.rerender(ui(next)),
  }
}

const firstNameInput = () =>
  screen.getByPlaceholderText("Nombre") as HTMLInputElement
const lastNameInput = () =>
  screen.getByPlaceholderText("Apellidos") as HTMLInputElement
const emailInput = () =>
  screen.getByPlaceholderText("email@ejemplo.com") as HTMLInputElement

describe("ClientFormSheet", () => {
  beforeEach(() => {
    mockMatchMedia(false)
    createClient.mockReset()
    updateClient.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
  })

  afterEach(() => {
    mockMatchMedia(false)
  })

  it("populates the form from the client when it opens", () => {
    renderSheet(mockClient)
    expect(firstNameInput().value).toBe("Ana")
  })

  it("keeps the in-progress edit when a background refetch returns a new object for the same client", () => {
    const { rerenderWith } = renderSheet(mockClient)

    fireEvent.change(firstNameInput(), { target: { value: "Anabel" } })
    expect(firstNameInput().value).toBe("Anabel")

    // React Query refetches on window focus and hands down a brand new object
    // for the same client (different identity, server-side fields refreshed).
    rerenderWith({ ...mockClient, totalVisits: 6, updatedAt: "2026-02-01T00:00:00Z" })

    expect(firstNameInput().value).toBe("Anabel")
  })

  it("repopulates when the sheet is pointed at a different client", () => {
    const { rerenderWith } = renderSheet(mockClient)

    fireEvent.change(firstNameInput(), { target: { value: "Anabel" } })

    rerenderWith({ ...mockClient, id: "cli_2", firstName: "Marta", lastName: "Ruiz" })

    expect(firstNameInput().value).toBe("Marta")
  })

  it("clears the form when pointed at create mode", () => {
    const { rerenderWith } = renderSheet(mockClient)

    rerenderWith(null)

    expect(firstNameInput().value).toBe("")
  })

  // D17/D18: una rama por ancho para el contenedor. El polyfill de
  // `src/test/setup.ts` siempre devuelve `matches:false`, asi que la rama de
  // escritorio solo se cubre si el test la fuerza explicitamente.
  it("mounts as a bottom sheet with its grabber on mobile", () => {
    mockMatchMedia(false)
    renderSheet(null)

    expect(screen.getByTestId("responsive-form-modal-grabber")).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Nuevo cliente" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Crear cliente" })).toBeInTheDocument()
  })

  it("mounts as a centered dialog with no grabber on desktop", () => {
    mockMatchMedia(true)
    renderSheet(null)

    expect(screen.queryByTestId("responsive-form-modal-grabber")).not.toBeInTheDocument()
    expect(screen.getByTestId("responsive-form-modal-dialog")).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Nuevo cliente" })).toBeInTheDocument()
  })

  it("D18: alta pinta 'Nuevo cliente' / 'Crear cliente'; edicion pinta 'Editar cliente' / 'Guardar cambios'", () => {
    const { rerenderWith } = renderSheet(null)
    expect(screen.getByRole("dialog", { name: "Nuevo cliente" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Crear cliente" })).toBeInTheDocument()

    rerenderWith(mockClient)

    expect(screen.getByRole("dialog", { name: "Editar cliente" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument()
  })

  it("D31: trims the name fields and maps blank optional fields to undefined when creating a client", async () => {
    const user = userEvent.setup()
    createClient.mockResolvedValue({ ...mockClient, id: "cli_new" })
    renderSheet(null)

    fireEvent.change(firstNameInput(), { target: { value: "  Ana  " } })
    fireEvent.change(lastNameInput(), { target: { value: "  Lopez  " } })
    fireEvent.change(screen.getByPlaceholderText("612 345 678"), { target: { value: "  612345678  " } })
    // Email and Notas are left blank on purpose.

    await user.click(screen.getByRole("button", { name: "Crear cliente" }))

    await waitFor(() => expect(createClient).toHaveBeenCalledTimes(1))
    expect(createClient).toHaveBeenCalledWith(
      {
        firstName: "Ana",
        lastName: "Lopez",
        email: undefined,
        phone: "612345678",
        notes: undefined,
      },
      "token"
    )
  })

  it("D31: a whitespace-only name does not pass the guard -- the CTA stays disabled", () => {
    renderSheet(null)

    fireEvent.change(firstNameInput(), { target: { value: "   " } })
    fireEvent.change(lastNameInput(), { target: { value: "Lopez" } })

    expect(screen.getByRole("button", { name: "Crear cliente" })).toBeDisabled()
  })

  it("calls updateClient with the client's id and the edited fields", async () => {
    const user = userEvent.setup()
    updateClient.mockResolvedValue(mockClient)
    renderSheet(mockClient)

    fireEvent.change(emailInput(), { target: { value: "ana2@test.com" } })

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => expect(updateClient).toHaveBeenCalledTimes(1))
    expect(updateClient).toHaveBeenCalledWith(
      "cli_1",
      {
        firstName: "Ana",
        lastName: "Lopez",
        email: "ana2@test.com",
        phone: "612345678",
        notes: undefined,
      },
      "token"
    )
  })

  // Deuda documentada (§1.9, D31): el formulario manda `undefined` para un
  // string vacio, y en un PUT eso significa "no tocar", no "borrar". Un email
  // ya guardado NO se puede vaciar desde este formulario -- este test
  // documenta el comportamiento actual, no lo aprueba.
  it("DEUDA: clearing an already-saved email maps it to undefined on update, so it cannot be erased this way", async () => {
    const user = userEvent.setup()
    updateClient.mockResolvedValue(mockClient)
    renderSheet(mockClient)

    fireEvent.change(emailInput(), { target: { value: "" } })

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() => expect(updateClient).toHaveBeenCalledTimes(1))
    const [, payload] = updateClient.mock.calls[0]
    expect(payload.email).toBeUndefined()
  })

  it("D30: shows the ProblemDetail's detail in the toast when creating fails", async () => {
    const user = userEvent.setup()
    const problem: ProblemDetail = {
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      detail: "Ya existe un cliente con ese email.",
      instance: "/api/v1/clients",
      timestamp: "2026-08-27T10:00:00Z",
      correlationId: "corr-1",
    }
    createClient.mockRejectedValue(new ApiError(problem))
    renderSheet(null)

    fireEvent.change(firstNameInput(), { target: { value: "Ana" } })
    fireEvent.change(lastNameInput(), { target: { value: "Lopez" } })

    await user.click(screen.getByRole("button", { name: "Crear cliente" }))

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Ya existe un cliente con ese email.")
    )
  })

  it("D30: falls back to a generic message when the error carries no ProblemDetail", async () => {
    const user = userEvent.setup()
    updateClient.mockRejectedValue(new Error("network down"))
    renderSheet(mockClient)

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }))

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Error al actualizar cliente")
    )
  })

  it("closes and invalidates the client caches on a successful create", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    createClient.mockResolvedValue({ ...mockClient, id: "cli_new" })
    renderSheet(null, onOpenChange)

    fireEvent.change(firstNameInput(), { target: { value: "Ana" } })
    fireEvent.change(lastNameInput(), { target: { value: "Lopez" } })

    await user.click(screen.getByRole("button", { name: "Crear cliente" }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(toastSuccess).toHaveBeenCalledWith("Cliente creado")
  })
})
