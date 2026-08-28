import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
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

  it("avisa de que los servicios no se han podido cargar cuando servicesUnavailable esta activo", () => {
    render(<PublicServiceStep salon={{ ...baseSalon, servicesUnavailable: true }} />)

    expect(screen.getByText("No hemos podido cargar los servicios")).toBeInTheDocument()
    expect(screen.getByText("Vuelve a intentarlo en unos minutos.")).toBeInTheDocument()
    expect(
      screen.queryByText("Este salon no tiene servicios disponibles para reserva online.")
    ).not.toBeInTheDocument()
  })

  it("mantiene el vacio normal cuando servicesUnavailable esta desactivado", () => {
    render(<PublicServiceStep salon={baseSalon} />)

    expect(
      screen.getByText("Este salon no tiene servicios disponibles para reserva online.")
    ).toBeInTheDocument()
    expect(screen.queryByText("No hemos podido cargar los servicios")).not.toBeInTheDocument()
  })

  it("no oculta servicios reales aunque el flag venga activo", () => {
    render(
      <PublicServiceStep salon={{ ...baseSalon, services: [service], servicesUnavailable: true }} />
    )

    expect(screen.getByText("Corte hombre")).toBeInTheDocument()
    expect(screen.queryByText("No hemos podido cargar los servicios")).not.toBeInTheDocument()
  })

  it("sin servicios no hay tarjeta que pulsar, asi que no se puede avanzar", () => {
    // Los dos vacios (lista caida y salon sin servicios) tienen que ser igual
    // de inertes. La comprobacion es la ausencia del recurso: ninguna tarjeta
    // de servicio dibujada y, pulsando lo que haya, el paso no se mueve.
    for (const servicesUnavailable of [true, false]) {
      usePublicBookingStore.getState().reset()
      const { container, unmount } = render(
        <PublicServiceStep salon={{ ...baseSalon, servicesUnavailable }} />
      )

      expect(screen.queryByText(service.name)).not.toBeInTheDocument()

      container.querySelectorAll('[data-slot="card"]').forEach((card) => {
        fireEvent.click(card)
      })

      expect(usePublicBookingStore.getState().step).toBe(1)
      expect(usePublicBookingStore.getState().selectedService).toBeNull()
      unmount()
    }
  })
})
