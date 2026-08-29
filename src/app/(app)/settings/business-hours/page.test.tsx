import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import BusinessHoursSettingsPage from "./page"
import type { BusinessHoursResponse } from "@/types/salon"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

/**
 * `matches: desktop` simulates `(min-width: 1024px)`, the same query
 * `useMediaQuery` reads via `window.matchMedia` -- jsdom has no real layout.
 * Same helper shape as `page-shell.test.tsx`.
 */
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

  afterEach(() => {
    // Every other test in this file relies on the mobile default
    // (`matches: false`, src/test/setup.ts:23-35); reset it so a desktop
    // override here never leaks into a later test.
    mockMatchMedia(false)
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

  // Horario.dc.html:37 and HorarioDesktop.dc.html:126 each draw exactly ONE
  // save action, in different places: the mobile artboard puts it in the
  // header, the desktop one in the body. They are mutually exclusive by
  // design, not a duplicate that slipped in and needs merging back -- the
  // two tests below pin one width each so neither regresses into showing
  // both (or neither).
  it("on mobile, offers Guardar only in the header -- the editor's own body button stays hidden (Horario.dc.html:37)", async () => {
    getBusinessHours.mockResolvedValue(STORED_HOURS)
    renderPage()

    expect(await screen.findByDisplayValue("10:30")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled()
    expect(screen.queryByRole("button", { name: /guardar horarios/i })).not.toBeInTheDocument()
  })

  it("on desktop, offers Guardar only in the editor's body -- the header carries no save action (HorarioDesktop.dc.html:126)", async () => {
    mockMatchMedia(true)
    getBusinessHours.mockResolvedValue(STORED_HOURS)
    renderPage()

    expect(await screen.findByDisplayValue("10:30")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /guardar horarios/i })).toBeEnabled()
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument()
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
