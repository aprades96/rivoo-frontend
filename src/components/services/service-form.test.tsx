import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ServiceFormSheet } from "./service-form"
import type { ServiceOffering } from "@/types/service"

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ accessToken: "token" }),
}))

const mockService: ServiceOffering = {
  id: "svc_1",
  name: "Corte hombre",
  description: "Corte y peinado",
  durationMinutes: 30,
  price: 20,
  category: "Corte",
  isActive: true,
}

function renderSheet(service: ServiceOffering | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const ui = (s: ServiceOffering | null) => (
    <QueryClientProvider client={queryClient}>
      <ServiceFormSheet open onOpenChange={() => {}} service={s} />
    </QueryClientProvider>
  )
  const utils = render(ui(service))
  return {
    ...utils,
    rerenderWith: (next: ServiceOffering | null) => utils.rerender(ui(next)),
  }
}

const nameInput = () =>
  screen.getByPlaceholderText("Corte hombre, Tinte...") as HTMLInputElement

describe("ServiceFormSheet", () => {
  it("populates the form from the service when it opens", () => {
    renderSheet(mockService)
    expect(nameInput().value).toBe("Corte hombre")
  })

  it("keeps the in-progress edit when a background refetch returns a new object for the same service", () => {
    const { rerenderWith } = renderSheet(mockService)

    fireEvent.change(nameInput(), { target: { value: "Corte hombre premium" } })
    expect(nameInput().value).toBe("Corte hombre premium")

    // The services list refetches and hands down a brand new object for the same
    // service (different identity, server-side fields refreshed).
    rerenderWith({ ...mockService, price: 22 })

    expect(nameInput().value).toBe("Corte hombre premium")
  })

  it("repopulates when the sheet is pointed at a different service", () => {
    const { rerenderWith } = renderSheet(mockService)

    fireEvent.change(nameInput(), { target: { value: "Corte hombre premium" } })

    rerenderWith({ ...mockService, id: "svc_2", name: "Tinte" })

    expect(nameInput().value).toBe("Tinte")
  })

  it("clears the form when pointed at create mode", () => {
    const { rerenderWith } = renderSheet(mockService)

    rerenderWith(null)

    expect(nameInput().value).toBe("")
  })
})
