import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import AddServicePage from "./page"

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}))

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ accessToken: "token", isAuthenticated: true }),
}))

const setCurrentStep = vi.fn()

vi.mock("@/lib/stores/onboarding-store", () => ({
  useOnboardingStore: () => ({
    setCurrentStep,
    currentStep: 4,
    totalSteps: 5,
    nextStep: vi.fn(),
    prevStep: vi.fn(),
    reset: vi.fn(),
  }),
}))

const createService = vi.fn()

vi.mock("@/lib/api/staff", () => ({
  staffApi: {
    createService: (...args: unknown[]) => createService(...args),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AddServicePage />
    </QueryClientProvider>
  )
}

describe("AddServicePage", () => {
  beforeEach(() => {
    push.mockClear()
    setCurrentStep.mockClear()
    createService.mockReset()
  })

  it("shows the literal callout about how duration decides the slot size", () => {
    renderPage()

    expect(
      screen.getByText(
        "La duracion decide el tamano del hueco en la agenda y en la reserva online."
      )
    ).toBeInTheDocument()
  })

  it("keeps 'Continuar' disabled until name and price are filled", async () => {
    const user = userEvent.setup()
    renderPage()

    const cta = screen.getByRole("button", { name: /continuar/i })
    expect(cta).toBeDisabled()

    await user.type(screen.getByPlaceholderText("Corte hombre, Tinte..."), "Corte")
    await user.type(screen.getByPlaceholderText("0,00"), "15")

    expect(cta).toBeEnabled()
  })

  it("creates the service and navigates to /complete on success", async () => {
    createService.mockResolvedValue({ id: "svc_1" })
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText("Corte hombre, Tinte..."), "Corte")
    await user.type(screen.getByPlaceholderText("0,00"), "15")
    await user.click(screen.getByRole("button", { name: /continuar/i }))

    // "Omitir" ya esta presente desde el primer render (no depende de la
    // mutacion), asi que esperar por el no demuestra que createService haya
    // aterrizado -- solo la navegacion (efecto de onSuccess) lo hace.
    await waitFor(() => expect(push).toHaveBeenCalledWith("/complete"))
    expect(createService).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Corte", price: 15 }),
      "token"
    )
  })

  it("'Omitir' navigates to /complete without creating a service", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole("button", { name: /^omitir$/i }))

    expect(push).toHaveBeenCalledWith("/complete")
    expect(createService).not.toHaveBeenCalled()
  })

  it("marks the wizard at step 4 on mount", () => {
    renderPage()

    expect(setCurrentStep).toHaveBeenCalledWith(4)
  })
})
