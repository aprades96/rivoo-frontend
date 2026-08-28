import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ClientFormSheet } from "./client-form"
import type { Client } from "@/types/client"

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ accessToken: "token" }),
}))

const mockClient: Client = {
  id: "cli_1",
  firstName: "Ana",
  lastName: "Lopez",
  email: "ana@test.com",
  phone: "612345678",
  gender: null,
  dateOfBirth: null,
  notes: null,
  source: null,
  totalVisits: 5,
  lastVisitAt: null,
  gdprConsentAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}

function renderSheet(client: Client | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const ui = (c: Client | null) => (
    <QueryClientProvider client={queryClient}>
      <ClientFormSheet open onOpenChange={() => {}} client={c} />
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

describe("ClientFormSheet", () => {
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
})
