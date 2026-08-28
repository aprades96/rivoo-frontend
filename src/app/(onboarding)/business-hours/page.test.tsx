import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import OnboardingBusinessHoursPage from "./page"
import type { BusinessHoursResponse } from "@/types/salon"

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
    currentStep: 2,
    totalSteps: 5,
    nextStep: vi.fn(),
    prevStep: vi.fn(),
    reset: vi.fn(),
  }),
}))

const getBusinessHours = vi.fn()
const updateBusinessHours = vi.fn()

vi.mock("@/lib/api/salons", () => ({
  salonsApi: {
    getBusinessHours: (...args: unknown[]) => getBusinessHours(...args),
    updateBusinessHours: (...args: unknown[]) => updateBusinessHours(...args),
  },
}))

// Loaded schedule that is deliberately different from WorkingHoursEditor's
// DEFAULT_HOURS ("09:00"), so a match proves the real GET landed instead of
// the component falling back to its own defaults.
const STORED_HOURS: BusinessHoursResponse[] = [
  { dayOfWeek: 1, isOpen: true, openTime: "10:30", closeTime: "18:00", breakStartTime: null, breakEndTime: null },
  { dayOfWeek: 2, isOpen: true, openTime: "09:00", closeTime: "20:00", breakStartTime: null, breakEndTime: null },
  { dayOfWeek: 3, isOpen: true, openTime: "09:00", closeTime: "20:00", breakStartTime: null, breakEndTime: null },
  { dayOfWeek: 4, isOpen: true, openTime: "09:00", closeTime: "20:00", breakStartTime: null, breakEndTime: null },
  { dayOfWeek: 5, isOpen: true, openTime: "09:00", closeTime: "20:00", breakStartTime: null, breakEndTime: null },
  { dayOfWeek: 6, isOpen: false, openTime: "09:00", closeTime: "14:00", breakStartTime: null, breakEndTime: null },
  { dayOfWeek: 7, isOpen: false, openTime: "09:00", closeTime: "14:00", breakStartTime: null, breakEndTime: null },
]

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <OnboardingBusinessHoursPage />
    </QueryClientProvider>
  )
}

describe("OnboardingBusinessHoursPage", () => {
  beforeEach(() => {
    push.mockClear()
    setCurrentStep.mockClear()
    getBusinessHours.mockReset()
    updateBusinessHours.mockReset()
  })

  it("preloads the stored schedule into WorkingHoursEditor instead of always starting from defaults", async () => {
    getBusinessHours.mockResolvedValue(STORED_HOURS)
    renderPage()

    // The fetch resolves asynchronously (real QueryClient, no seeded cache):
    // find a value the page markup never hardcodes, proving the GET landed.
    expect(await screen.findByDisplayValue("10:30")).toBeInTheDocument()
    expect(getBusinessHours).toHaveBeenCalledWith("token")
  })

  it("has no 'Omitir' or 'Configurar mas tarde' control -- the design draws none here", async () => {
    getBusinessHours.mockResolvedValue(STORED_HOURS)
    renderPage()

    await screen.findByDisplayValue("10:30")

    expect(screen.queryByText(/omitir/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/configurar mas tarde/i)).not.toBeInTheDocument()
  })

  it("'Continuar' saves the schedule before advancing to /add-employee", async () => {
    getBusinessHours.mockResolvedValue(STORED_HOURS)
    updateBusinessHours.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderPage()

    await screen.findByDisplayValue("10:30")
    await user.click(screen.getByRole("button", { name: /continuar/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith("/add-employee"))
    expect(updateBusinessHours).toHaveBeenCalledWith(expect.anything(), "token")

    // Order matters: the schedule must land before the wizard moves on.
    const saveOrder = updateBusinessHours.mock.invocationCallOrder[0]
    const pushOrder = push.mock.invocationCallOrder[0]
    expect(saveOrder).toBeLessThan(pushOrder)
  })

  it("does not mount the editor nor allow 'Continuar' while the stored schedule is still loading", async () => {
    let resolveHours!: (value: BusinessHoursResponse[]) => void
    getBusinessHours.mockReturnValue(
      new Promise<BusinessHoursResponse[]>((resolve) => {
        resolveHours = resolve
      })
    )
    renderPage()

    // While the GET is in flight there is no editor to type into (nothing to
    // overwrite the user's keystrokes) and no way to send default values by
    // pressing Continuar too early.
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /continuar/i })).toBeDisabled()

    resolveHours(STORED_HOURS)

    expect(await screen.findByDisplayValue("10:30")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /continuar/i })).toBeEnabled()
  })

  it("does NOT navigate to /add-employee when the save fails, so the user can retry", async () => {
    getBusinessHours.mockResolvedValue(STORED_HOURS)
    updateBusinessHours.mockRejectedValue(new Error("network down"))
    const user = userEvent.setup()
    renderPage()

    await screen.findByDisplayValue("10:30")
    await user.click(screen.getByRole("button", { name: /continuar/i }))

    await waitFor(() => expect(updateBusinessHours).toHaveBeenCalled())

    expect(push).not.toHaveBeenCalled()
  })

  it("marks the wizard at step 2 on mount", () => {
    getBusinessHours.mockResolvedValue(STORED_HOURS)
    renderPage()

    expect(setCurrentStep).toHaveBeenCalledWith(2)
  })
})
