import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { PublicEmployeeStep } from "./public-employee-step"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import type { SalonPublic, EmployeePublic, ServicePublic } from "@/types/salon"

const employee: EmployeePublic = {
  id: "emp_1",
  firstName: "Ana",
  lastName: "Lopez",
  jobTitle: "Estilista",
  serviceIds: ["svc_1"],
}

const haircut: ServicePublic = {
  id: "svc_1",
  name: "Corte hombre",
  description: null,
  durationMinutes: 30,
  price: 15,
  currency: "EUR",
}

// Servicio que el salon ofrece pero no ha asignado a nadie: el caso 3.
const beard: ServicePublic = {
  id: "svc_2",
  name: "Barba",
  description: null,
  durationMinutes: 15,
  price: 8,
  currency: "EUR",
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

const LOAD_FAILURE_TITLE = "No hemos podido cargar los profesionales"

/**
 * Pulsa todo lo que el paso dibuja como tarjeta. Tailwind no se aplica en jsdom,
 * asi que `pointer-events-none` no bloquea nada aqui: el click llega al onClick
 * de verdad y lo que se comprueba es el guardado del handler, no una clase CSS.
 */
function clickEverything(container: HTMLElement) {
  container.querySelectorAll('[data-slot="card"]').forEach((card) => {
    fireEvent.click(card)
  })
}

/**
 * `window.matchMedia` no existe en jsdom; `src/test/setup.ts` ya pone un
 * fallback global que no coincide con nada (mobile). Este helper lo
 * sobrescribe puntualmente para simular escritorio, igual que
 * `booking-step-shell.test.tsx` -- y `afterEach` lo repone a mobile para no
 * filtrar el mock a otras pruebas del fichero.
 */
function mockMatchMedia(desktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: desktop,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

describe("PublicEmployeeStep", () => {
  beforeEach(() => {
    usePublicBookingStore.getState().reset()
    // El paso de profesional es el 2; avanzar significa llegar al 3.
    usePublicBookingStore.getState().setStep(2)
  })

  afterEach(() => {
    mockMatchMedia(false)
  })

  it("avisa de que los profesionales no se han podido cargar cuando employeesUnavailable esta activo", () => {
    render(<PublicEmployeeStep salon={{ ...baseSalon, employeesUnavailable: true }} />)

    expect(screen.getByText(LOAD_FAILURE_TITLE)).toBeInTheDocument()
    expect(screen.getByText("Vuelve a intentarlo en unos minutos.")).toBeInTheDocument()
  })

  it("no deja avanzar con la lista caida: no ofrece 'Sin preferencia'", () => {
    const { container } = render(
      <PublicEmployeeStep salon={{ ...baseSalon, employeesUnavailable: true }} />
    )

    expect(screen.queryByText("Sin preferencia")).not.toBeInTheDocument()
    expect(screen.queryByText("O elige profesional")).not.toBeInTheDocument()

    clickEverything(container)
    expect(usePublicBookingStore.getState().step).toBe(2)
  })

  it("mantiene el paso normal cuando hay quien haga el servicio", () => {
    usePublicBookingStore.getState().selectService(haircut)
    render(<PublicEmployeeStep salon={{ ...baseSalon, employees: [employee] }} />)

    expect(screen.getByText("Sin preferencia")).toBeInTheDocument()
    expect(screen.getByText("O elige profesional")).toBeInTheDocument()
    expect(screen.queryByText(LOAD_FAILURE_TITLE)).not.toBeInTheDocument()
  })

  it("no oculta profesionales reales aunque el flag venga activo", () => {
    render(
      <PublicEmployeeStep
        salon={{ ...baseSalon, employees: [employee], employeesUnavailable: true }}
      />
    )

    expect(screen.getByText("Ana Lopez")).toBeInTheDocument()
    expect(screen.queryByText(LOAD_FAILURE_TITLE)).not.toBeInTheDocument()
  })

  it("'Sin preferencia' sigue llevando al paso 3 cuando hay quien haga el servicio", () => {
    usePublicBookingStore.getState().selectService(haircut)
    render(<PublicEmployeeStep salon={{ ...baseSalon, employees: [employee] }} />)

    fireEvent.click(screen.getByText("Sin preferencia"))

    expect(usePublicBookingStore.getState().step).toBe(3)
  })

  // Caso 2: el salon no tiene ningun profesional. No es un fallo de carga.
  it("con el salon sin profesionales lo dice sin hablar de fallos de carga", () => {
    usePublicBookingStore.getState().selectService(haircut)
    render(<PublicEmployeeStep salon={{ ...baseSalon, employees: [] }} />)

    expect(
      screen.getByText("Este salon no tiene profesionales disponibles para reserva online.")
    ).toBeInTheDocument()
    expect(screen.queryByText(LOAD_FAILURE_TITLE)).not.toBeInTheDocument()
  })

  it("con el salon sin profesionales no deja avanzar", () => {
    usePublicBookingStore.getState().selectService(haircut)
    const { container } = render(<PublicEmployeeStep salon={{ ...baseSalon, employees: [] }} />)

    expect(screen.queryByText("Sin preferencia")).not.toBeInTheDocument()
    expect(screen.queryByText("O elige profesional")).not.toBeInTheDocument()

    clickEverything(container)
    expect(usePublicBookingStore.getState().step).toBe(2)
  })

  // Caso 3: hay profesionales, pero ninguno tiene asignado el servicio elegido.
  it("cuando nadie ofrece el servicio lo dice y manda a cambiar de servicio", () => {
    usePublicBookingStore.getState().selectService(beard)
    render(<PublicEmployeeStep salon={{ ...baseSalon, employees: [employee] }} />)

    expect(screen.getByText("Ninguno de estos profesionales ofrece Barba.")).toBeInTheDocument()
    expect(
      screen.getByText("Toca la flecha de arriba para elegir otro servicio.")
    ).toBeInTheDocument()
    expect(screen.queryByText(LOAD_FAILURE_TITLE)).not.toBeInTheDocument()
    expect(
      screen.queryByText("Este salon no tiene profesionales disponibles para reserva online.")
    ).not.toBeInTheDocument()
  })

  it("cuando nadie ofrece el servicio no deja avanzar por ninguna tarjeta", () => {
    usePublicBookingStore.getState().selectService(beard)
    const { container } = render(<PublicEmployeeStep salon={{ ...baseSalon, employees: [employee] }} />)

    expect(screen.queryByText("Sin preferencia")).not.toBeInTheDocument()
    expect(screen.queryByText("O elige profesional")).not.toBeInTheDocument()

    clickEverything(container)
    expect(usePublicBookingStore.getState().step).toBe(2)
    expect(usePublicBookingStore.getState().selectedEmployeeId).toBeNull()
  })

  it("cuando nadie ofrece el servicio sigue enseñando a los profesionales del salon", () => {
    usePublicBookingStore.getState().selectService(beard)
    render(<PublicEmployeeStep salon={{ ...baseSalon, employees: [employee] }} />)

    expect(screen.getByText("Ana Lopez")).toBeInTheDocument()
    expect(screen.getByText("No ofrece Barba")).toBeInTheDocument()
  })

  it("con la lista incompleta y nadie que ofrezca el servicio no dice que fallara la carga", () => {
    usePublicBookingStore.getState().selectService(beard)
    render(
      <PublicEmployeeStep
        salon={{ ...baseSalon, employees: [employee], employeesUnavailable: true }}
      />
    )

    expect(screen.getByText("Ninguno de estos profesionales ofrece Barba.")).toBeInTheDocument()
    expect(screen.queryByText(LOAD_FAILURE_TITLE)).not.toBeInTheDocument()
    expect(screen.queryByText("Sin preferencia")).not.toBeInTheDocument()
  })

  // T5: BookingStepShell ahora pinta el titulo del paso; el componente ya no
  // tiene su propio <h2>. `getByText` ya falla si hay mas de una coincidencia,
  // asi que no encontrar el titulo (cero) o encontrarlo duplicado (2+) rompen
  // esta prueba igual.
  it("no duplica el titulo: BookingStepShell lo pinta una unica vez", () => {
    usePublicBookingStore.getState().selectService(haircut)
    render(<PublicEmployeeStep salon={{ ...baseSalon, employees: [employee] }} />)

    expect(screen.getByText("Con quien la quieres")).toBeInTheDocument()
  })

  it("el CTA del aside sale deshabilitado sin profesional elegido", () => {
    mockMatchMedia(true)
    usePublicBookingStore.getState().selectService(haircut)
    render(<PublicEmployeeStep salon={{ ...baseSalon, employees: [employee] }} />)

    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled()
  })
})
