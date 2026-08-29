import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PublicClientStep } from "./public-client-step"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import type { SalonPublic, ServicePublic } from "@/types/salon"

const service: ServicePublic = {
  id: "svc_1",
  name: "Corte + Tinte",
  description: null,
  durationMinutes: 90,
  price: 65,
  currency: "EUR",
}

const salon: SalonPublic = {
  name: "Bella Vista",
  slug: "bella-vista",
  phone: "+34600000000",
  description: null,
  logoUrl: null,
  primaryColor: null,
  addressStreet: "Carrer de Verdi 42",
  addressCity: "Barcelona",
  addressPostalCode: "08012",
  businessHours: [],
  services: [service],
  employees: [
    { id: "emp_1", firstName: "Laura", lastName: "Martinez", jobTitle: null, serviceIds: ["svc_1"] },
  ],
  servicesUnavailable: false,
  employeesUnavailable: false,
}

function renderStep() {
  return render(<PublicClientStep salon={salon} />)
}

describe("PublicClientStep", () => {
  beforeEach(() => {
    usePublicBookingStore.getState().reset()
    usePublicBookingStore.getState().setSalonSlug("bella-vista")
    usePublicBookingStore.getState().selectService(service)
    usePublicBookingStore.getState().selectEmployee("emp_1", false)
    usePublicBookingStore.getState().selectDateTime("2026-08-28", "2026-08-28T11:00:00")
  })

  it("pinta el titulo del chasis una sola vez", () => {
    renderStep()

    // getByRole revienta si hay mas de una coincidencia -- prueba que
    // PublicClientStep ya no pinta su propio <h2>/subtitulo por encima
    // del <h1> del chasis (BookingStepShell).
    expect(screen.getByRole("heading", { name: "Tus datos" })).toBeInTheDocument()
  })

  it("deshabilita el CTA cuando faltan campos obligatorios, aunque haya consentimiento", async () => {
    const user = userEvent.setup()
    renderStep()

    const consent = screen.getByRole("checkbox")
    await user.click(consent)

    // Nombre, apellidos, email y telefono siguen vacios.
    for (const cta of screen.getAllByRole("button", { name: "Revisar reserva" })) {
      expect(cta).toBeDisabled()
    }
  })

  it("deshabilita el CTA cuando los campos estan completos pero falta el consentimiento", async () => {
    const user = userEvent.setup()
    renderStep()

    await user.type(screen.getByLabelText("Nombre *"), "Ana")
    await user.type(screen.getByLabelText("Apellidos *"), "Garcia")
    await user.type(screen.getByLabelText("Email *"), "ana@example.com")
    await user.type(screen.getByLabelText("Telefono *"), "612345678")

    for (const cta of screen.getAllByRole("button", { name: "Revisar reserva" })) {
      expect(cta).toBeDisabled()
    }
  })

  it("habilita el CTA solo cuando los campos obligatorios y el consentimiento estan completos", async () => {
    const user = userEvent.setup()
    renderStep()

    await user.type(screen.getByLabelText("Nombre *"), "Ana")
    await user.type(screen.getByLabelText("Apellidos *"), "Garcia")
    await user.type(screen.getByLabelText("Email *"), "ana@example.com")
    await user.type(screen.getByLabelText("Telefono *"), "612345678")
    await user.click(screen.getByRole("checkbox"))

    for (const cta of screen.getAllByRole("button", { name: "Revisar reserva" })) {
      expect(cta).toBeEnabled()
    }
  })

  it("usa la primitiva Checkbox (@base-ui/react/checkbox), no un <input type=checkbox> nativo", () => {
    renderStep()

    const consent = screen.getByRole("checkbox")
    // La primitiva renderiza el elemento accesible role="checkbox" como
    // <span>; el <input> nativo que mantiene por debajo va oculto
    // (aria-hidden, tabIndex -1) y no es el que expone el role.
    expect(consent.tagName).toBe("SPAN")
  })

  it("marca el consentimiento al clicar su texto, asociado por htmlFor/id", async () => {
    const user = userEvent.setup()
    renderStep()

    const consent = screen.getByRole("checkbox")
    expect(consent).toHaveAttribute("aria-checked", "false")

    await user.click(screen.getByText(/Acepto que mis datos/))

    expect(consent).toHaveAttribute("aria-checked", "true")
  })
})
