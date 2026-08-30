import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { GdprPanel } from "./gdpr-panel"

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ accessToken: "token" }),
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args), error: (...args: unknown[]) => toastError(...args) },
}))

const exportData = vi.fn()
const anonymize = vi.fn()
vi.mock("@/lib/api/clients", () => ({
  clientsApi: {
    exportData: (...args: unknown[]) => exportData(...args),
    anonymize: (...args: unknown[]) => anonymize(...args),
  },
}))

function renderPanel(overrides: Partial<Parameters<typeof GdprPanel>[0]> = {}) {
  const onAnonymized = vi.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <GdprPanel
        clientId="cli_1"
        clientName="Ana Garcia"
        gdprConsentAt="2023-03-12T00:00:00Z"
        onAnonymized={onAnonymized}
        {...overrides}
      />
    </QueryClientProvider>
  )
  return { ...view, onAnonymized }
}

/**
 * `gdpr-panel.tsx` es codigo destructivo e irreversible (anonimizacion) y
 * hoy (`§1.9`) no tiene NINGUN test. D27: la premisa "falta disabled en los
 * dos botones" era falsa -- los dos YA llevan `disabled={isPending}`
 * (`:76`, `:127`). Lo que de verdad falta, y es lo que este fichero cubre
 * con mas cuidado, son los dos huecos reales: `Cancelar` sin `disabled` y el
 * `onOpenChange` del dialogo sin bloquear durante la mutacion.
 */
describe("GdprPanel", () => {
  beforeEach(() => {
    exportData.mockReset()
    anonymize.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
  })

  it("D21: pinta el consentimiento con formatDate, no dd/mm/yyyy", () => {
    renderPanel({ gdprConsentAt: "2023-03-12T00:00:00Z" })

    expect(screen.getByText("Consentimiento dado: 12 mar 2023")).toBeInTheDocument()
  })

  it("sin gdprConsentAt no pinta la linea de consentimiento", () => {
    renderPanel({ gdprConsentAt: null })

    expect(screen.queryByText(/Consentimiento dado/)).not.toBeInTheDocument()
  })

  it("D27: usa tokens de warning en vez de la paleta cruda de Tailwind", () => {
    renderPanel()

    const heading = screen.getByText("Protección de datos (GDPR)")
    const card = heading.closest('[data-slot="card"]')
    expect(card).not.toBeNull()
    expect(card?.className).not.toMatch(/orange/)
    expect(card?.className).toMatch(/border-warning-border/)
    expect(card?.className).toMatch(/bg-warning-soft/)
  })

  it("exportar descarga un JSON con los datos y muestra un toast de exito", async () => {
    const user = userEvent.setup()
    const createObjectURL = vi.fn(() => "blob:mock-url")
    const revokeObjectURL = vi.fn()
    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
    exportData.mockResolvedValue({ client: { id: "cli_1" } })

    renderPanel()
    await user.click(screen.getByRole("button", { name: /Exportar datos/ }))

    // `findBy*` sobre algo que el componente NO posee sincronamente (el
    // toast, que llega tras resolver la promesa): prueba que el dato
    // aterrizo de verdad, no solo que el mock se llamo (AGENTS.md).
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Datos exportados"))
    expect(exportData).toHaveBeenCalledWith("cli_1", "token")
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)

    clickSpy.mockRestore()
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })

  it("un fallo al exportar muestra un toast de error", async () => {
    const user = userEvent.setup()
    exportData.mockRejectedValue(new Error("boom"))

    renderPanel()
    await user.click(screen.getByRole("button", { name: /Exportar datos/ }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Error al exportar datos"))
  })

  it("anonimizar con exito: cierra el dialogo, muestra un toast y llama a onAnonymized", async () => {
    const user = userEvent.setup()
    anonymize.mockResolvedValue(undefined)

    const { onAnonymized } = renderPanel()
    await user.click(screen.getByRole("button", { name: "Anonimizar" }))
    await user.click(screen.getByRole("button", { name: "Anonimizar permanentemente" }))

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(toastSuccess).toHaveBeenCalledWith("Cliente anonimizado")
    expect(onAnonymized).toHaveBeenCalledTimes(1)
    expect(anonymize).toHaveBeenCalledWith("cli_1", "token")
  })

  it("un fallo al anonimizar deja el dialogo abierto con un toast de error", async () => {
    const user = userEvent.setup()
    anonymize.mockRejectedValue(new Error("boom"))

    renderPanel()
    await user.click(screen.getByRole("button", { name: "Anonimizar" }))
    await user.click(screen.getByRole("button", { name: "Anonimizar permanentemente" }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Error al anonimizar"))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  // D27 -- el hueco real 1/2: `Cancelar` no llevaba `disabled`, asi que se
  // podia cancelar mientras la anonimizacion ya estaba en vuelo.
  it("mientras la anonimizacion esta en vuelo, 'Cancelar' esta deshabilitado", async () => {
    const user = userEvent.setup()
    let resolveAnonymize!: () => void
    anonymize.mockReturnValue(new Promise<void>((resolve) => { resolveAnonymize = resolve }))

    renderPanel()
    await user.click(screen.getByRole("button", { name: "Anonimizar" }))
    await user.click(screen.getByRole("button", { name: "Anonimizar permanentemente" }))

    const cancelButton = await screen.findByRole("button", { name: "Cancelar" })
    expect(cancelButton).toBeDisabled()

    resolveAnonymize()
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  // D27 -- el hueco real 2/2: el `onOpenChange` no se bloqueaba durante
  // `isPending`, asi que un `Esc` cerraba el dialogo sobre una operacion
  // irreversible en curso.
  it("mientras la anonimizacion esta en vuelo, Escape NO cierra el dialogo", async () => {
    const user = userEvent.setup()
    let resolveAnonymize!: () => void
    anonymize.mockReturnValue(new Promise<void>((resolve) => { resolveAnonymize = resolve }))

    renderPanel()
    await user.click(screen.getByRole("button", { name: "Anonimizar" }))
    await user.click(screen.getByRole("button", { name: "Anonimizar permanentemente" }))

    // Prueba independiente de que el dialogo esta de verdad montado antes de
    // disparar Escape -- si esto fallase, la asercion de abajo pasaria en
    // falso.
    expect(await screen.findByRole("button", { name: "Cancelar" })).toBeDisabled()

    await user.keyboard("{Escape}")
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    resolveAnonymize()
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  // Contraprueba del test anterior: fuera de una mutacion en curso, Escape
  // SI cierra el dialogo con normalidad -- el freno es solo para `isPending`.
  it("sin ninguna mutacion en vuelo, Escape SI cierra el dialogo", async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole("button", { name: "Anonimizar" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
