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

const otherService: ServicePublic = {
  id: "svc_2",
  name: "Manicura francesa",
  description: null,
  durationMinutes: 60,
  price: 22,
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

  it("no duplica el titulo: BookingStepShell lo pinta una unica vez, el paso ya no tiene su propio <h2>", () => {
    render(<PublicServiceStep salon={{ ...baseSalon, services: [service] }} />)

    expect(screen.getByText("Elige un servicio")).toBeInTheDocument()
  })

  it("no agrupa por categoria: ServicePublic no trae ese campo (a diferencia de ServiceOffering), asi que el catalogo sale en una unica lista/grid plana", () => {
    // Regression net para la decision documentada en public-service-step.tsx:
    // sin dato de categoria en el tipo publico, no se inventan rotulos de
    // seccion. Si esto se pone rojo es porque `ServicePublic` gano un campo de
    // categoria real -- entonces toca revisar esta prueba, no forzarla en verde.
    render(<PublicServiceStep salon={{ ...baseSalon, services: [service, otherService] }} />)

    expect(screen.getByText("Corte hombre")).toBeInTheDocument()
    expect(screen.getByText("Manicura francesa")).toBeInTheDocument()
    expect(screen.queryByText("Cabello")).not.toBeInTheDocument()
    expect(screen.queryByText("Barberia y unas")).not.toBeInTheDocument()
  })

  it("ya no pinta el horario semanal: en escritorio vive en SalonInfoAside, y no esta en el artboard movil", () => {
    render(
      <PublicServiceStep
        salon={{
          ...baseSalon,
          services: [service],
          businessHours: [
            { dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "20:00", breakStartTime: null, breakEndTime: null },
          ],
        }}
      />
    )

    expect(screen.queryByText("Horario")).not.toBeInTheDocument()
    expect(screen.queryByText(/09:00 - 20:00/)).not.toBeInTheDocument()
  })
})
