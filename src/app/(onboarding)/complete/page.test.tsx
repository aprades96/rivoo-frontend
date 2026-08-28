import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import OnboardingCompletePage from "./page"
import type { Salon } from "@/types/salon"

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}))

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ accessToken: "token", isAuthenticated: true }),
}))

// Only the booking-URL display depends on this hook; the cache write under
// test goes straight through a real QueryClient (see renderPage below), not
// through this mock.
vi.mock("@/hooks/use-salon", () => ({
  useSalon: () => ({
    data: { slug: "bella-vista" } as Salon,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

const reset = vi.fn()
const setCurrentStep = vi.fn()

vi.mock("@/lib/stores/onboarding-store", () => ({
  useOnboardingStore: () => ({
    setCurrentStep,
    currentStep: 5,
    totalSteps: 5,
    nextStep: vi.fn(),
    prevStep: vi.fn(),
    reset,
  }),
}))

const completeOnboarding = vi.fn()

vi.mock("@/lib/api/salons", () => ({
  salonsApi: {
    completeOnboarding: (...args: unknown[]) => completeOnboarding(...args),
  },
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

const SALON_KEY = ["salon", "me"]

const UPDATED_SALON = {
  id: "sal_1",
  name: "Rivoo Salon",
  slug: "bella-vista",
  ownerUserId: "usr_1",
  email: "hola@rivoo.test",
  phone: "930000000",
  description: null,
  logoUrl: null,
  primaryColor: null,
  addressStreet: "Carrer Gran 1",
  addressCity: "Barcelona",
  addressPostalCode: "08001",
  timezone: "Europe/Madrid",
  currency: "EUR",
  subscriptionPlan: "BASIC",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  onboardingCompletedAt: "2026-08-28T10:00:00Z",
} as Salon

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // Seed a stale, not-yet-completed salon -- the same shape the gate would
  // see if it re-read the cache right now.
  queryClient.setQueryData(SALON_KEY, { ...UPDATED_SALON, onboardingCompletedAt: null })

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <OnboardingCompletePage />
    </QueryClientProvider>
  )

  return { ...utils, queryClient }
}

describe("OnboardingCompletePage", () => {
  beforeEach(() => {
    push.mockClear()
    reset.mockClear()
    setCurrentStep.mockClear()
    completeOnboarding.mockReset()
  })

  it("does not navigate to /today until completeOnboarding resolves", async () => {
    let resolveCall!: (salon: Salon) => void
    completeOnboarding.mockReturnValue(
      new Promise<Salon>((resolve) => {
        resolveCall = resolve
      })
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole("button", { name: /ir al dashboard/i }))

    // The network call is still in flight: must not have navigated yet.
    expect(push).not.toHaveBeenCalled()

    resolveCall(UPDATED_SALON)

    await waitFor(() => expect(push).toHaveBeenCalledWith("/today"))
  })

  it("writes the already-completed salon into the exact ['salon','me'] cache entry before navigating", async () => {
    completeOnboarding.mockResolvedValue(UPDATED_SALON)
    const user = userEvent.setup()
    const { queryClient } = renderPage()

    const cancelSpy = vi.spyOn(queryClient, "cancelQueries")
    const setDataSpy = vi.spyOn(queryClient, "setQueryData")

    await user.click(screen.getByRole("button", { name: /ir al dashboard/i }))

    await waitFor(() => expect(push).toHaveBeenCalledWith("/today"))

    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: SALON_KEY })
    expect(setDataSpy).toHaveBeenCalledWith(SALON_KEY, UPDATED_SALON)
    expect(queryClient.getQueryData(SALON_KEY)).toEqual(UPDATED_SALON)

    // Order matters: cancel the in-flight refetch, THEN write, THEN navigate.
    const cancelOrder = cancelSpy.mock.invocationCallOrder[0]
    const setDataOrder = setDataSpy.mock.invocationCallOrder[0]
    const pushOrder = push.mock.invocationCallOrder[0]
    expect(cancelOrder).toBeLessThan(setDataOrder)
    expect(setDataOrder).toBeLessThan(pushOrder)

    expect(reset).toHaveBeenCalled()
  })

  it("does NOT navigate when completeOnboarding fails, and leaves the stale flag untouched", async () => {
    completeOnboarding.mockRejectedValue(new Error("network down"))
    const user = userEvent.setup()
    const { queryClient } = renderPage()

    await user.click(screen.getByRole("button", { name: /ir al dashboard/i }))

    await waitFor(() => expect(completeOnboarding).toHaveBeenCalled())

    expect(push).not.toHaveBeenCalled()
    expect(reset).not.toHaveBeenCalled()
    expect(queryClient.getQueryData<Salon>(SALON_KEY)?.onboardingCompletedAt).toBeNull()
  })

  it("shows the /book/ booking URL built from the salon slug", () => {
    renderPage()

    expect(screen.getByText(/\/book\/bella-vista$/)).toBeInTheDocument()
  })

  it("marks the wizard at step 5 on mount", () => {
    renderPage()

    expect(setCurrentStep).toHaveBeenCalledWith(5)
  })
})
