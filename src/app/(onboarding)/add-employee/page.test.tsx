import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import AddEmployeePage from "./page"

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
    currentStep: 3,
    totalSteps: 5,
    nextStep: vi.fn(),
    prevStep: vi.fn(),
    reset: vi.fn(),
  }),
}))

const createEmployee = vi.fn()

vi.mock("@/lib/api/staff", () => ({
  staffApi: {
    createEmployee: (...args: unknown[]) => createEmployee(...args),
  },
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AddEmployeePage />
    </QueryClientProvider>
  )
}

describe("AddEmployeePage", () => {
  beforeEach(() => {
    push.mockClear()
    setCurrentStep.mockClear()
    createEmployee.mockReset()
  })

  it("keeps 'Continuar' disabled until name, surname and email are filled", async () => {
    const user = userEvent.setup()
    renderPage()

    const cta = screen.getByRole("button", { name: /continuar/i })
    expect(cta).toBeDisabled()

    await user.type(screen.getByPlaceholderText("Nombre"), "Ana")
    await user.type(screen.getByPlaceholderText("Apellidos"), "Ruiz")
    await user.type(screen.getByPlaceholderText("email@ejemplo.com"), "ana@rivoo.test")

    expect(cta).toBeEnabled()
  })

  it("hides the temporary password field until 'Crear cuenta de acceso' is switched on", async () => {
    const user = userEvent.setup()
    renderPage()

    expect(screen.queryByPlaceholderText("Min. 8 caracteres")).not.toBeInTheDocument()

    await user.click(screen.getByRole("switch"))

    expect(screen.getByPlaceholderText("Min. 8 caracteres")).toBeInTheDocument()
  })

  it("sends the selected color swatch and navigates to /add-service on success", async () => {
    createEmployee.mockResolvedValue({ id: "emp_1" })
    const user = userEvent.setup()
    renderPage()

    await user.type(screen.getByPlaceholderText("Nombre"), "Ana")
    await user.type(screen.getByPlaceholderText("Apellidos"), "Ruiz")
    await user.type(screen.getByPlaceholderText("email@ejemplo.com"), "ana@rivoo.test")
    await user.click(screen.getByRole("button", { name: "Color #5C7A5E" }))
    await user.click(screen.getByRole("button", { name: /continuar/i }))

    expect(await screen.findByRole("button", { name: /^omitir$/i })).toBeInTheDocument()
    expect(createEmployee).toHaveBeenCalledWith(
      expect.objectContaining({ colorHex: "#5C7A5E" }),
      "token"
    )
    expect(push).toHaveBeenCalledWith("/add-service")
  })

  it("'Omitir' navigates to /add-service without creating an employee", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole("button", { name: /^omitir$/i }))

    expect(push).toHaveBeenCalledWith("/add-service")
    expect(createEmployee).not.toHaveBeenCalled()
  })

  it("marks the wizard at step 3 on mount", () => {
    renderPage()

    expect(setCurrentStep).toHaveBeenCalledWith(3)
  })
})
