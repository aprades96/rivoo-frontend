import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { PublicEmployeeStep } from "./public-employee-step"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import type { SalonPublic, EmployeePublic } from "@/types/salon"

const employee: EmployeePublic = {
  id: "emp_1",
  firstName: "Ana",
  lastName: "Lopez",
  jobTitle: "Estilista",
  serviceIds: ["svc_1"],
}

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

describe("PublicEmployeeStep", () => {
  beforeEach(() => {
    usePublicBookingStore.getState().reset()
  })

  it("avisa de que los profesionales no se han podido cargar cuando employeesUnavailable esta activo", () => {
    render(<PublicEmployeeStep salon={{ ...baseSalon, employeesUnavailable: true }} />)

    expect(screen.getByText("No hemos podido cargar los profesionales")).toBeInTheDocument()
    expect(screen.getByText("Vuelve a intentarlo en unos minutos.")).toBeInTheDocument()
  })

  it("no deja avanzar con la lista caida: no ofrece 'Sin preferencia'", () => {
    render(<PublicEmployeeStep salon={{ ...baseSalon, employeesUnavailable: true }} />)

    expect(screen.queryByText("Sin preferencia")).not.toBeInTheDocument()
    expect(screen.queryByText("O elige profesional")).not.toBeInTheDocument()
    expect(usePublicBookingStore.getState().step).toBe(1)
  })

  it("mantiene el paso normal cuando employeesUnavailable esta desactivado", () => {
    render(<PublicEmployeeStep salon={baseSalon} />)

    expect(screen.getByText("Sin preferencia")).toBeInTheDocument()
    expect(screen.getByText("O elige profesional")).toBeInTheDocument()
    expect(screen.queryByText("No hemos podido cargar los profesionales")).not.toBeInTheDocument()
  })

  it("no oculta profesionales reales aunque el flag venga activo", () => {
    render(
      <PublicEmployeeStep
        salon={{ ...baseSalon, employees: [employee], employeesUnavailable: true }}
      />
    )

    expect(screen.getByText("Ana Lopez")).toBeInTheDocument()
    expect(screen.queryByText("No hemos podido cargar los profesionales")).not.toBeInTheDocument()
  })
})
