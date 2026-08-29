import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { BookingResultShell } from "./booking-result-shell"
import type { SalonPublic } from "@/types/salon"

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
  services: [],
  employees: [],
  servicesUnavailable: false,
  employeesUnavailable: false,
}

describe("BookingResultShell", () => {
  it("pinta el titulo y el contenido, sin stepper ni barra de progreso", () => {
    render(
      <BookingResultShell
        salon={salon}
        tone="success"
        icon={<svg data-testid="icon" />}
        title="Reserva confirmada"
      >
        <p>detalle de la cita</p>
      </BookingResultShell>
    )

    expect(screen.getByRole("heading", { name: "Reserva confirmada" })).toBeInTheDocument()
    expect(screen.getByText("detalle de la cita")).toBeInTheDocument()
    expect(screen.getByTestId("icon")).toBeInTheDocument()

    // Ninguno de los nodos del stepper de escritorio (etiquetas de paso) ni
    // del contador de la barra de progreso movil deberia existir aqui: el
    // chasis de resultado es una pantalla sin asistente.
    expect(screen.queryByText("Servicio")).not.toBeInTheDocument()
    expect(screen.queryByText("Profesional")).not.toBeInTheDocument()
    expect(screen.queryByText(/^\d \/ \d$/)).not.toBeInTheDocument()
  })

  it("no pinta boton atras ni contador en la cabecera movil", () => {
    render(
      <BookingResultShell salon={salon} tone="success" icon={<svg />} title="Reserva confirmada">
        <p>detalle</p>
      </BookingResultShell>
    )

    expect(screen.queryByRole("button", { name: "Volver" })).not.toBeInTheDocument()
  })

  it("pinta el subtitulo cuando se pasa", () => {
    render(
      <BookingResultShell
        salon={salon}
        tone="error"
        icon={<svg />}
        title="Ese hueco se acaba de ocupar"
        subtitle="Alguien ha reservado esa hora mientras confirmabas."
      >
        <p>detalle</p>
      </BookingResultShell>
    )

    expect(
      screen.getByText("Alguien ha reservado esa hora mientras confirmabas.")
    ).toBeInTheDocument()
  })
})
