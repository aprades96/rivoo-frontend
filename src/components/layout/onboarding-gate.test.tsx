import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { OnboardingGate } from "./onboarding-gate"
import { ApiError } from "@/lib/api/client"
import type { Salon } from "@/types/salon"

const replace = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
}))

// Driving the gate through mocked hooks (not a live QueryClient) keeps every
// case below a plain, synchronous render: no react-query notifyManager
// macrotask involved anywhere in this file (see AGENTS.md).
const useAuthMock = vi.fn()
const useSalonMock = vi.fn()

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock("@/hooks/use-salon", () => ({
  useSalon: () => useSalonMock(),
}))

const listEmployees = vi.fn()
const listServices = vi.fn()

vi.mock("@/lib/api/staff", () => ({
  staffApi: {
    listEmployees: (...args: unknown[]) => listEmployees(...args),
    listServices: (...args: unknown[]) => listServices(...args),
  },
}))

const CHILD_TEXT = "Protected dashboard content"

function renderGate() {
  return render(
    <OnboardingGate>
      <div>{CHILD_TEXT}</div>
    </OnboardingGate>
  )
}

function auth(overrides: Partial<ReturnType<typeof defaultAuth>> = {}) {
  return { ...defaultAuth(), ...overrides }
}

function defaultAuth() {
  return {
    isAuthenticated: true,
    isLoading: false,
    accessToken: "token" as string | null,
    isOwner: true,
  }
}

function salonHook(overrides: Partial<ReturnType<typeof defaultSalonHook>> = {}) {
  return { ...defaultSalonHook(), ...overrides }
}

function defaultSalonHook() {
  return {
    data: undefined as Salon | undefined,
    isLoading: false,
    error: null as unknown,
    refetch: vi.fn(),
  }
}

const mockSalon: Salon = {
  id: "sal_1",
  name: "Rivoo Salon",
  slug: "rivoo-salon",
  email: "hola@rivoo.test",
  phone: "930000000",
  description: "Peluqueria de barrio",
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
  onboardingCompletedAt: null,
}

describe("OnboardingGate", () => {
  beforeEach(() => {
    replace.mockClear()
    listEmployees.mockClear()
    listServices.mockClear()
    useAuthMock.mockReset()
    useSalonMock.mockReset()
  })

  it("renders the children for an owner whose onboardingCompletedAt is a date", () => {
    useAuthMock.mockReturnValue(auth({ isOwner: true }))
    useSalonMock.mockReturnValue(
      salonHook({ data: { ...mockSalon, onboardingCompletedAt: "2026-01-01T00:00:00Z" } })
    )

    renderGate()

    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it("redirects an owner with onboardingCompletedAt null to /welcome", () => {
    useAuthMock.mockReturnValue(auth({ isOwner: true }))
    useSalonMock.mockReturnValue(salonHook({ data: { ...mockSalon, onboardingCompletedAt: null } }))

    renderGate()

    expect(replace).toHaveBeenCalledWith("/welcome")
    expect(screen.queryByText(CHILD_TEXT)).not.toBeInTheDocument()
  })

  it("shows a dedicated, unrecoverable error (not the wizard) when GET /salons/me answers 404", () => {
    // The wizard cannot create a salon (only the anonymous /register form
    // can), so redirecting a 404 to /welcome is a dead end: the owner would
    // reach step 5 and hit a second 404 with no way out but "Salir". A
    // broken X-Tenant-Id propagation produces this same 404 for an owner who
    // already completed onboarding, so it must never be treated as "needs
    // onboarding".
    useAuthMock.mockReturnValue(auth({ isOwner: true }))
    useSalonMock.mockReturnValue(
      salonHook({
        data: undefined,
        error: new ApiError({
          type: "https://rivoo.com/errors/salon-not-found",
          title: "Salon Not Found",
          status: 404,
          detail: "No salon for this owner yet",
          instance: "/api/v1/salons/me",
          timestamp: "2026-08-28T10:00:00Z",
          correlationId: "corr-404",
        }),
      })
    )

    renderGate()

    expect(replace).not.toHaveBeenCalled()
    expect(screen.queryByText(CHILD_TEXT)).not.toBeInTheDocument()
    expect(screen.getByText("No hemos encontrado tu salon")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument()
  })

  it("does NOT render the children when GET /salons/me answers 500", () => {
    useAuthMock.mockReturnValue(auth({ isOwner: true }))
    useSalonMock.mockReturnValue(
      salonHook({
        data: undefined,
        error: new ApiError({
          type: "https://rivoo.com/errors/internal",
          title: "Internal Server Error",
          status: 500,
          detail: "Something broke upstream",
          instance: "/api/v1/salons/me",
          timestamp: "2026-08-28T10:00:00Z",
          correlationId: "corr-500",
        }),
      })
    )

    renderGate()

    expect(screen.queryByText(CHILD_TEXT)).not.toBeInTheDocument()
    // A real failure must not be silently treated as "send to the wizard".
    expect(replace).not.toHaveBeenCalledWith("/welcome")

    // Positive assertion, not just absence: without it, `unavailable` being
    // permanently false and the 500 falling into the infinite spinner branch
    // would still make every assertion above pass.
    expect(
      screen.getByText("No se ha podido cargar tu salon")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument()
  })

  it("keeps rendering the children when a background refetch fails but cached salon data is still valid", () => {
    // React Query keeps serving the last successful payload (and setting
    // `error`) when a background refetch fails -- e.g. a window-focus
    // refetch hitting a transient 5xx. `unavailable` must require the
    // absence of `salon`, not just the presence of `salonError`: otherwise a
    // fully working panel gets torn down and replaced by the error screen
    // on every flaky refetch.
    useAuthMock.mockReturnValue(auth({ isOwner: true }))
    useSalonMock.mockReturnValue(
      salonHook({
        data: { ...mockSalon, onboardingCompletedAt: "2026-01-01T00:00:00Z" },
        error: new ApiError({
          type: "https://rivoo.com/errors/internal",
          title: "Internal Server Error",
          status: 500,
          detail: "Transient refetch failure",
          instance: "/api/v1/salons/me",
          timestamp: "2026-08-28T10:00:00Z",
          correlationId: "corr-transient",
        }),
      })
    )

    renderGate()

    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument()
    expect(
      screen.queryByText("No se ha podido cargar tu salon")
    ).not.toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it("renders the children for an owner with the flag set even with no employees or services", () => {
    useAuthMock.mockReturnValue(auth({ isOwner: true }))
    useSalonMock.mockReturnValue(
      salonHook({ data: { ...mockSalon, onboardingCompletedAt: "2026-02-01T00:00:00Z" } })
    )

    renderGate()

    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
    // The gate must decide from the flag alone, never by counting staff.
    expect(listEmployees).not.toHaveBeenCalled()
    expect(listServices).not.toHaveBeenCalled()
  })

  it("renders the children for an EMPLOYEE with onboardingCompletedAt null instead of sending them to the wizard", () => {
    useAuthMock.mockReturnValue(auth({ isOwner: false }))
    useSalonMock.mockReturnValue(salonHook({ data: { ...mockSalon, onboardingCompletedAt: null } }))

    renderGate()

    expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it("shows only a spinner, no error and no children, while the session is half-alive (authenticated without an access token yet)", () => {
    useAuthMock.mockReturnValue(auth({ isAuthenticated: true, accessToken: null }))
    useSalonMock.mockReturnValue(salonHook({ data: undefined, isLoading: false, error: null }))

    const { container } = renderGate()

    expect(screen.queryByText(CHILD_TEXT)).not.toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(container.querySelector(".animate-spin")).toBeInTheDocument()
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })
})
