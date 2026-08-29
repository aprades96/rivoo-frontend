import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { SalonInfoAside } from "./salon-info-aside"
import type { SalonPublic, BusinessHoursResponse } from "@/types/salon"

function hours(dayOfWeek: number, isOpen: boolean, openTime = "09:00", closeTime = "20:00"): BusinessHoursResponse {
  return { dayOfWeek, isOpen, openTime, closeTime, breakStartTime: null, breakEndTime: null }
}

const baseSalon: SalonPublic = {
  name: "Bella Vista",
  slug: "bella-vista",
  phone: "932145067",
  description: "Peluqueria de barrio en Gracia desde 1998.",
  logoUrl: null,
  primaryColor: null,
  addressStreet: "Carrer de Verdi 42",
  addressCity: "Barcelona",
  addressPostalCode: "08012",
  businessHours: [
    hours(1, true, "09:00", "20:00"),
    hours(2, true, "09:00", "20:00"),
    hours(3, true, "09:00", "20:00"),
    hours(4, true, "09:00", "20:00"),
    hours(5, true, "09:00", "21:00"),
    hours(6, true, "09:00", "14:00"),
    hours(7, false, "09:00", "14:00"),
  ],
  services: [],
  employees: [],
  servicesUnavailable: false,
  employeesUnavailable: false,
}

describe("SalonInfoAside", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("agrupa lunes a jueves (mismo horario) en una sola fila, no cuatro", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 26)) // miercoles

    render(<SalonInfoAside salon={baseSalon} />)

    expect(screen.getByText("Lun - Jue")).toBeInTheDocument()
    expect(screen.queryByText("Lunes")).not.toBeInTheDocument()
    expect(screen.queryByText("Martes")).not.toBeInTheDocument()
    expect(screen.queryByText("Miercoles")).not.toBeInTheDocument()
    expect(screen.queryByText("Jueves")).not.toBeInTheDocument()
    expect(screen.getByText("Viernes")).toBeInTheDocument()
    expect(screen.getByText("Sabado")).toBeInTheDocument()
    expect(screen.getByText("Domingo")).toBeInTheDocument()
  })

  it("un salon cerrado hoy no pinta 'Abierto'", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 30)) // domingo, cerrado en baseSalon

    render(<SalonInfoAside salon={baseSalon} />)

    expect(screen.getByText("Cerrado hoy")).toBeInTheDocument()
    expect(screen.queryByText(/^Abierto/)).not.toBeInTheDocument()
  })

  it("un salon abierto hoy pinta la hora de cierre real, sin inventarla", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 26)) // miercoles, cierra a las 20:00

    render(<SalonInfoAside salon={baseSalon} />)

    expect(screen.getByText("Abierto hoy hasta las 20:00")).toBeInTheDocument()
  })

  it("sin description no deja un separador huerfano", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 26))

    const { container } = render(<SalonInfoAside salon={{ ...baseSalon, description: null }} />)

    // Sin descripcion solo debe quedar el separador antes del telefono: uno,
    // no dos huerfanos donde iria la descripcion.
    expect(container.querySelectorAll(".bg-hairline").length).toBe(1)
  })

  it("con description vacia (string en blanco) tampoco pinta el bloque", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 26))

    render(<SalonInfoAside salon={{ ...baseSalon, description: "   " }} />)

    expect(screen.queryByText(/Peluqueria/)).not.toBeInTheDocument()
  })

  it("pinta el telefono formateado", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 26))

    render(<SalonInfoAside salon={baseSalon} />)

    expect(screen.getByText("932 145 067")).toBeInTheDocument()
  })
})
