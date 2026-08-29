import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PublicSuccessStep, buildIcsContent } from "./public-success-step"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import type { SalonPublic, ServicePublic, EmployeePublic } from "@/types/salon"

const service: ServicePublic = {
  id: "svc_1",
  name: "Corte + Tinte",
  description: null,
  durationMinutes: 90,
  price: 65,
  currency: "EUR",
}

const employee: EmployeePublic = {
  id: "emp_1",
  firstName: "Laura",
  lastName: "Martinez",
  jobTitle: "Estilista",
  serviceIds: ["svc_1"],
}

// La coma es deliberada: prueba el escapado de RFC 5545, no solo el
// contenido feliz.
const salon: SalonPublic = {
  name: "Bella Vista",
  slug: "bella-vista",
  phone: "+34932145067",
  description: null,
  logoUrl: null,
  primaryColor: null,
  addressStreet: "Carrer de Verdi 42, Gracia",
  addressCity: "Barcelona",
  addressPostalCode: "08012",
  businessHours: [],
  services: [service],
  employees: [employee],
  servicesUnavailable: false,
  employeesUnavailable: false,
}

function seedConfirmedBooking() {
  const store = usePublicBookingStore.getState()
  store.reset()
  store.setSalonSlug(salon.slug)
  store.selectService(service)
  store.selectEmployee(employee.id, false)
  store.selectDateTime("2026-08-28", "2026-08-28T11:00:00")
  store.setClientForm({
    firstName: "Ana",
    lastName: "Garcia",
    email: "ana@mail.com",
    phone: "+34600111222",
  })
}

describe("PublicSuccessStep", () => {
  beforeEach(() => {
    seedConfirmedBooking()
  })

  it("usa BookingResultShell: titulo centrado, sin stepper ni barra de progreso", () => {
    render(<PublicSuccessStep salon={salon} />)

    expect(screen.getByRole("heading", { name: "Reserva confirmada" })).toBeInTheDocument()
    expect(screen.queryByText(/^\d \/ \d$/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Volver" })).not.toBeInTheDocument()
  })

  it("pinta los datos de la cita y del cliente", () => {
    render(<PublicSuccessStep salon={salon} />)

    expect(screen.getByText("11:00 - 12:30")).toBeInTheDocument()
    expect(screen.getAllByText("Corte + Tinte").length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Ana Garcia/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Laura Martinez/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/ana@mail\.com/).length).toBeGreaterThan(0)
  })

  it("el telefono del salon es un enlace tel: accionable", () => {
    render(<PublicSuccessStep salon={salon} />)

    const phoneLink = screen.getByRole("link", { name: /932 145 067/ })
    expect(phoneLink).toHaveAttribute("href", "tel:+34932145067")
  })

  it("genera el .ics con los datos de la reserva al pulsar 'Anadir al calendario' y escapa las comas", async () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:mock-url")
    const revokeObjectURL = vi.fn()
    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    render(<PublicSuccessStep salon={salon} />)
    fireEvent.click(screen.getByRole("button", { name: "Anadir al calendario" }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0][0] as Blob
    const content = await blob.text()

    expect(content).toContain("DTSTART:20260828T110000")
    expect(content).toContain("DTEND:20260828T123000")
    expect(content).toContain("SUMMARY:Corte + Tinte - Bella Vista")
    // La direccion trae una coma real ("Carrer de Verdi 42, Gracia") -- debe
    // salir escapada como "\," dentro de LOCATION, nunca como coma suelta.
    expect(content).toContain("LOCATION:Carrer de Verdi 42\\, Gracia\\, 08012 Barcelona")
    expect(content).toContain("DESCRIPTION:Con Laura Martinez\\nA nombre de Ana Garcia")
    expect(clickSpy).toHaveBeenCalledTimes(1)

    clickSpy.mockRestore()
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })
})

describe("buildIcsContent", () => {
  it("escapa comas, punto y coma y saltos de linea en los campos de texto", () => {
    const content = buildIcsContent({
      uid: "uid-1",
      now: new Date("2026-08-27T10:00:00Z"),
      start: new Date("2026-08-28T11:00:00"),
      end: new Date("2026-08-28T12:30:00"),
      serviceName: "Corte; Peinado",
      salonName: "Bella Vista",
      address: "Carrer de Verdi 42, Gracia, 08012 Barcelona",
      employeeName: "Laura Martinez",
      clientName: "Ana Garcia",
    })

    expect(content).toContain("BEGIN:VCALENDAR")
    expect(content).toContain("BEGIN:VEVENT")
    expect(content).toContain("UID:uid-1")
    expect(content).toContain("DTSTAMP:20260827T100000Z")
    expect(content).toContain("SUMMARY:Corte\\; Peinado - Bella Vista")
    expect(content).toContain("LOCATION:Carrer de Verdi 42\\, Gracia\\, 08012 Barcelona")
    expect(content).toContain("DESCRIPTION:Con Laura Martinez\\nA nombre de Ana Garcia")
    expect(content).toMatch(/\r\n/)
  })

  it("omite la linea 'Con <profesional>' cuando no hay nombre de profesional", () => {
    const content = buildIcsContent({
      uid: "uid-2",
      now: new Date("2026-08-27T10:00:00Z"),
      start: new Date("2026-08-28T11:00:00"),
      end: new Date("2026-08-28T12:30:00"),
      serviceName: "Corte",
      salonName: "Bella Vista",
      address: "Carrer Demo 1, Barcelona",
      employeeName: "",
      clientName: "Ana Garcia",
    })

    expect(content).toContain("DESCRIPTION:A nombre de Ana Garcia")
    expect(content).not.toContain("Con ")
  })
})
