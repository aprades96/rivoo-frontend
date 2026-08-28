import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import BusinessHoursSettingsPage from "./page"
import type { BusinessHoursResponse } from "@/types/salon"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

const useAuthMock = vi.fn()

vi.mock("@/hooks/use-auth", () => ({
  useAuth: (...args: unknown[]) => useAuthMock(...args),
}))

const getBusinessHours = vi.fn()
const updateBusinessHours = vi.fn()

vi.mock("@/lib/api/salons", () => ({
  salonsApi: {
    getBusinessHours: (...args: unknown[]) => getBusinessHours(...args),
    updateBusinessHours: (...args: unknown[]) => updateBusinessHours(...args),
  },
}))

const STORED_HOURS: BusinessHoursResponse[] = [
  { dayOfWeek: 1, isOpen: true, openTime: "10:30", closeTime: "18:00", breakStartTime: null, breakEndTime: null },
]

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <BusinessHoursSettingsPage />
    </QueryClientProvider>
  )
}

describe("BusinessHoursSettingsPage", () => {
  beforeEach(() => {
    getBusinessHours.mockReset()
    updateBusinessHours.mockReset()
    useAuthMock.mockReset()
    useAuthMock.mockReturnValue({ accessToken: "token", isAuthenticated: true })
  })

  it("does not mount the editor nor its internal 'Guardar horarios' button during a half-alive session (authenticated, accessToken not set yet)", () => {
    // Same window as business-hours/page.tsx (onboarding): the query is
    // `enabled: !!accessToken`, so with accessToken null it never runs and
    // React Query v5 reports `isLoading: false` for it. Guarding on
    // `isLoading` alone would mount WorkingHoursEditor on DEFAULT_HOURS with
    // its internal save button enabled (isSaving only reflects the mutation,
    // not this GET) -- a click there would overwrite the stored schedule.
    useAuthMock.mockReturnValue({ accessToken: null, isAuthenticated: true })

    const { container } = renderPage()

    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /guardar horarios/i })).not.toBeInTheDocument()
    expect(getBusinessHours).not.toHaveBeenCalled()
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
  })

  it("mounts the editor with the stored schedule once accessToken and data are both ready", async () => {
    getBusinessHours.mockResolvedValue(STORED_HOURS)
    renderPage()

    expect(await screen.findByDisplayValue("10:30")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /guardar horarios/i })).toBeEnabled()
  })

  it("shows an error with a retry action instead of an infinite skeleton when the stored schedule fails to load, and recovers once the retry succeeds", async () => {
    getBusinessHours.mockRejectedValueOnce(new Error("network down"))
    getBusinessHours.mockResolvedValueOnce(STORED_HOURS)
    const user = userEvent.setup()
    const { container } = renderPage()

    expect(await screen.findByText(/no se ha podido cargar el horario/i)).toBeInTheDocument()
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument()
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /reintentar/i }))

    // Proves the retry's data actually landed (react-query's notifyManager
    // macrotask, per AGENTS.md), not just that the error text disappeared.
    expect(await screen.findByDisplayValue("10:30")).toBeInTheDocument()
    expect(screen.queryByText(/no se ha podido cargar el horario/i)).not.toBeInTheDocument()
  })
})
