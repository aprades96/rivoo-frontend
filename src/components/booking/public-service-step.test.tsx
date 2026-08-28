import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { PublicServiceStep } from "./public-service-step"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import type { SalonPublic, ServicePublic } from "@/types/salon"

const service: ServicePublic = {
  id: "svc_1",
  name: "Corte hombre",
  description: "Corte clasico",
  durationMinutes: 30,
  price: 15,
  currency: "EUR",
}

// `servicesUnavailable` / `employeesUnavailable` son los nombres de cable que
// emite SalonPublicResponse (salon-service). Ver salon.ts.
const baseSalon: SalonPublic = {
  name: "Salon Demo",
  slug: "salon-demo",
  phone: "+34600000000",
  description: null,
  logoUrl: null,
  primaryColor: null,
  addressStreet: "Carrer Demo 1",
  addressCity: "Barcelona",
  addressPostalCode: "08001",
  businessHours: [],
  services: [],
  employees: [],
  servicesUnavailable: false,
  employeesUnavailable: false,
}

describe("PublicServiceStep", () => {
  beforeEach(() => {
    usePublicBookingStore.getState().reset()
  })

  it("renders real services regardless of servicesUnavailable -- this component no longer reads that flag", () => {
    // The empty-catalogue split (`servicesUnavailable` messaging) lives in
    // book/[slug]/page.tsx, the only caller, which never reaches this
    // component with an empty catalogue in the first place (see the comment
    // in public-service-step.tsx). This step ignores the flag entirely now.
    render(
      <PublicServiceStep salon={{ ...baseSalon, services: [service], servicesUnavailable: true }} />
    )

    expect(screen.getByText("Corte hombre")).toBeInTheDocument()
  })

  it("defensively renders no cards when services is empty, and does not let the user advance", () => {
    // Unreachable in production (the caller short-circuits first), kept as a
    // defensive regression net for this component in isolation: no service
    // list should ever render a clickable card out of nothing.
    const { container } = render(<PublicServiceStep salon={baseSalon} />)

    expect(screen.queryByText(service.name)).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(0)
    expect(usePublicBookingStore.getState().step).toBe(1)
    expect(usePublicBookingStore.getState().selectedService).toBeNull()
  })
})
