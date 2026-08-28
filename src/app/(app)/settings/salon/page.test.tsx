import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import SalonSettingsPage from "./page"
import type { Salon } from "@/types/salon"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}))

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ accessToken: "token", isAuthenticated: true }),
}))

vi.mock("@/lib/api/salons", () => ({
  salonsApi: {
    getMine: vi.fn(),
    update: vi.fn(),
  },
}))

const mockSalon: Salon = {
  id: "sal_1",
  name: "Rivoo Salon",
  slug: "rivoo-salon",
  ownerUserId: "usr_1",
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
  status: "ACTIVE" as Salon["status"],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}

// The key useSalon() reads; seeding it is what a resolved fetch does.
const SALON_KEY = ["salon", "me"]

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(SALON_KEY, mockSalon)

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <SalonSettingsPage />
    </QueryClientProvider>
  )

  return {
    ...utils,
    // The form renders name first, then phone, then a description textarea.
    nameInput: () =>
      utils.container.querySelectorAll<HTMLInputElement>("input")[0],
    pushRefetch: (next: Salon) => queryClient.setQueryData(SALON_KEY, next),
  }
}

describe("SalonSettingsPage", () => {
  it("populates the form from the loaded salon", () => {
    const { nameInput } = renderPage()
    expect(nameInput().value).toBe("Rivoo Salon")
  })

  it("keeps the in-progress edit when a background refetch returns a new object for the same salon", async () => {
    const { nameInput, pushRefetch } = renderPage()

    fireEvent.change(nameInput(), { target: { value: "Rivoo Salon Gracia" } })
    expect(nameInput().value).toBe("Rivoo Salon Gracia")

    // A refetch resolves with a genuinely different payload for the same salon,
    // so structural sharing hands the component a brand new object.
    pushRefetch({
      ...mockSalon,
      slug: "rivoo-gracia",
      updatedAt: "2026-02-01T00:00:00Z",
    })

    // React Query notifies its observers asynchronously, so first wait for a
    // field the form does NOT own to prove the new data really reached the
    // component. Without this the assertion below would pass on a component
    // that simply never re-rendered.
    await screen.findByText(/rivoo-gracia/)

    expect(nameInput().value).toBe("Rivoo Salon Gracia")
  })
})
