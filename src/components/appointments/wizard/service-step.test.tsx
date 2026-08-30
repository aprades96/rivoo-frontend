import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ServiceStep, groupServicesByCategory } from "./service-step"
import { useWizardStore } from "@/lib/stores/wizard-store"
import { useServices, useEmployeeServices, useEmployees } from "@/hooks/use-staff"
import type { Employee } from "@/types/employee"
import type { ServiceOffering } from "@/types/service"
import type { EmployeeServiceResponse } from "@/types/employee"

vi.mock("@/hooks/use-staff", () => ({
  useServices: vi.fn(),
  useEmployeeServices: vi.fn(),
  useEmployees: vi.fn(),
}))

// `useWizardNavigation` llama a `useRouter()`: sin `AppRouterContext` montado
// (no hay `<AppRouterInstance>` en un render de RTL) lanza "invariant expected
// app router to be mounted" -- mismo mock que `appointment-detail-panel.test.tsx:22-24`.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}))

const useServicesMock = vi.mocked(useServices)
const useEmployeeServicesMock = vi.mocked(useEmployeeServices)
const useEmployeesMock = vi.mocked(useEmployees)

/**
 * `Intl.NumberFormat("es-ES", { currency: "EUR" })` separa la cifra del
 * simbolo con un espacio DURO (U+00A0), no con el espacio normal del
 * artboard. Sin normalizar, `screen.getByText("28,00 €")` no encuentra nada
 * y un test asi se quedaria verde en falso -- misma trampa documentada en
 * `appointment-block.test.tsx:43-51`.
 */
function normalize(value: string): string {
  return value.replace(/ /g, " ")
}

function exact(expected: string) {
  return (content: string) => normalize(content) === expected
}

/** `matches: desktop` para simular `(min-width: 1024px)`; jsdom no tiene layout real. */
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

const laura: Employee = {
  id: "emp_1",
  firstName: "Laura",
  lastName: "Martinez",
  email: "laura@example.com",
  phone: null,
  jobTitle: "Estilista",
  colorHex: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00",
}

function makeService(overrides: Partial<ServiceOffering> = {}): ServiceOffering {
  return {
    id: "svc_1",
    name: "Corte mujer",
    description: null,
    durationMinutes: 45,
    price: 28,
    category: "Cabello",
    isActive: true,
    ...overrides,
  }
}

function servicesPage(content: ServiceOffering[]) {
  return { content, totalElements: content.length } as unknown as ReturnType<typeof useServices>["data"]
}

function mockServices(content: ServiceOffering[], isLoading = false) {
  useServicesMock.mockReturnValue({
    data: servicesPage(content),
    isLoading,
  } as unknown as ReturnType<typeof useServices>)
}

function mockEmployeeServices(assigned: EmployeeServiceResponse[] | undefined, isError = false) {
  useEmployeeServicesMock.mockReturnValue({ data: assigned, isError } as unknown as ReturnType<
    typeof useEmployeeServices
  >)
}

function assignedTo(serviceId: string): EmployeeServiceResponse {
  return {
    serviceId,
    serviceName: serviceId,
    effectiveDuration: 30,
    effectivePrice: 20,
    customDuration: null,
    customPrice: null,
  }
}

describe("ServiceStep", () => {
  beforeEach(() => {
    useWizardStore.getState().reset()
    mockMatchMedia(false)
    useEmployeesMock.mockReturnValue({ data: { content: [laura] } } as unknown as ReturnType<
      typeof useEmployees
    >)
  })

  afterEach(() => {
    mockMatchMedia(false)
  })

  describe("groupServicesByCategory", () => {
    it("agrupa en el orden de aparicion, con cabecera para cada categoria", () => {
      const corte = makeService({ id: "s1", category: "Cabello" })
      const barba = makeService({ id: "s2", category: "Barberia" })
      const balayage = makeService({ id: "s3", category: "Cabello" })

      const groups = groupServicesByCategory([corte, barba, balayage])

      expect(groups).toEqual([
        { category: "Cabello", services: [corte, balayage] },
        { category: "Barberia", services: [barba] },
      ])
    })

    it("manda los de categoria null a un grupo final sin cabecera", () => {
      const conCategoria = makeService({ id: "s1", category: "Cabello" })
      const sinCategoria = makeService({ id: "s2", category: null })

      const groups = groupServicesByCategory([sinCategoria, conCategoria])

      expect(groups).toEqual([
        { category: "Cabello", services: [conCategoria] },
        { category: null, services: [sinCategoria] },
      ])
    })

    it("colapsa '' y null en el MISMO grupo final -- category:'' es el caso real de produccion", () => {
      const vacia = makeService({ id: "s1", category: "" })
      const nula = makeService({ id: "s2", category: null })
      const conCategoria = makeService({ id: "s3", category: "Cabello" })

      const groups = groupServicesByCategory([vacia, conCategoria, nula])

      expect(groups).toEqual([
        { category: "Cabello", services: [conCategoria] },
        { category: null, services: [vacia, nula] },
      ])
    })

    it("normaliza una categoria de solo espacios como sin categoria", () => {
      const espacios = makeService({ id: "s1", category: "   " })

      const groups = groupServicesByCategory([espacios])

      expect(groups).toEqual([{ category: null, services: [espacios] }])
    })
  })

  it("pinta las cabeceras de categoria y, en la segunda en adelante, con margin-top", () => {
    mockServices([
      makeService({ id: "s1", name: "Corte mujer", category: "Cabello" }),
      makeService({ id: "s2", name: "Corte hombre", category: "Barberia" }),
    ])
    mockEmployeeServices([assignedTo("s1"), assignedTo("s2")])
    useWizardStore.setState({ selectedEmployee: laura })

    render(<ServiceStep />)

    const barberia = screen.getByText("Barberia")
    expect(screen.getByText("Cabello")).toBeInTheDocument()
    expect(barberia).toBeInTheDocument()
    expect(barberia.className).toContain("mt-1")
  })

  it("el precio se lee con el helper normalize/exact: el espacio del artboard es U+00A0", () => {
    mockServices([makeService({ id: "s1", name: "Corte + Tinte", price: 65, category: "Cabello" })])
    mockEmployeeServices([assignedTo("s1")])
    useWizardStore.setState({ selectedEmployee: laura })

    render(<ServiceStep />)

    expect(screen.getByText(exact("65,00 €"))).toBeInTheDocument()
    expect(screen.getByText(exact("45min"))).toBeInTheDocument()
  })

  it("el servicio no ofrecido aparece en la lista, atenuado, y no avanza al pulsarlo", async () => {
    const user = userEvent.setup()
    mockServices([
      makeService({ id: "s1", name: "Corte mujer", category: "Cabello" }),
      makeService({ id: "s2", name: "Afeitado clasico", category: "Barberia", price: 18 }),
    ])
    mockEmployeeServices([assignedTo("s1")])
    useWizardStore.setState({ selectedEmployee: laura })

    render(<ServiceStep />)

    expect(screen.getByText("Afeitado clasico")).toBeInTheDocument()
    expect(screen.getByText("Laura no ofrece este servicio")).toBeInTheDocument()

    const notOfferedCard = screen.getByRole("button", { name: /Afeitado clasico/ })
    expect(notOfferedCard).toBeDisabled()

    await user.click(notOfferedCard)

    expect(useWizardStore.getState().selectedService).toBeNull()
    expect(useWizardStore.getState().step).toBe(1)
  })

  it("un servicio ofrecido si avanza al paso 3 al pulsarlo", async () => {
    const user = userEvent.setup()
    const service = makeService({ id: "s1", name: "Corte mujer", category: "Cabello" })
    mockServices([service])
    mockEmployeeServices([assignedTo("s1")])
    useWizardStore.setState({ selectedEmployee: laura })

    render(<ServiceStep />)

    await user.click(screen.getByRole("button", { name: /Corte mujer/ }))

    expect(useWizardStore.getState().selectedService?.id).toBe("s1")
    expect(useWizardStore.getState().step).toBe(2)
  })

  it("con anyEmployee no atenua ninguno y omite el subtitulo de escritorio", () => {
    mockMatchMedia(true)
    mockServices([
      makeService({ id: "s1", name: "Corte mujer", category: "Cabello" }),
      makeService({ id: "s2", name: "Afeitado clasico", category: "Barberia" }),
    ])
    mockEmployeeServices(undefined)
    useWizardStore.setState({ anyEmployee: true, selectedEmployee: null })

    render(<ServiceStep />)

    const cards = screen.getAllByRole("button").filter((btn) => btn.textContent?.includes("min"))
    expect(cards.every((card) => !card.hasAttribute("disabled"))).toBe(true)
    expect(screen.queryByText(/Solo los que ofrece/)).not.toBeInTheDocument()
  })

  it("en escritorio pinta el subtitulo con el nombre del profesional elegido", () => {
    mockMatchMedia(true)
    mockServices([makeService({ id: "s1", category: "Cabello" })])
    mockEmployeeServices([assignedTo("s1")])
    useWizardStore.setState({ selectedEmployee: laura })

    render(<ServiceStep />)

    expect(screen.getByText("Solo los que ofrece Laura Martinez.")).toBeInTheDocument()
  })

  it("en escritorio, el no ofrecido usa el texto corto 'no lo ofrece'", () => {
    mockMatchMedia(true)
    mockServices([makeService({ id: "s1", name: "Afeitado clasico", category: "Barberia" })])
    mockEmployeeServices([])
    useWizardStore.setState({ selectedEmployee: laura })

    render(<ServiceStep />)

    expect(screen.getByText("Laura no lo ofrece")).toBeInTheDocument()
    expect(screen.queryByText("Laura no ofrece este servicio")).not.toBeInTheDocument()
  })

  // Con un `selectedEmployee` CONCRETO: la peticion "en vuelo" (sin fallar
  // todavia) sigue sin atenuar nada -- distinto del caso de fallo de abajo.
  // `anyEmployee: true` (usado en el test de arriba) cortocircuita
  // `isOffered` ANTES de llegar a `assignedIds`, asi que no ejerce esta rama.
  it("con un profesional concreto y la peticion de sus servicios EN VUELO, no atenua nada", () => {
    mockServices([makeService({ id: "s1", name: "Corte mujer", category: "Cabello" })])
    mockEmployeeServices(undefined, false)
    useWizardStore.setState({ selectedEmployee: laura })

    render(<ServiceStep />)

    const card = screen.getByRole("button", { name: /Corte mujer/ })
    expect(card).not.toBeDisabled()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  // El backend no valida la asignacion empleado-servicio
  // (`AppointmentService.java:86`): este filtro es la UNICA barrera, asi que
  // un FALLO de `useEmployeeServices` (no solo la peticion en vuelo) tiene
  // que atenuar TODO -- fallar cerrado, no abierto -- y avisar en pantalla.
  it("con un profesional concreto y la peticion de sus servicios en ERROR, atenua todo y avisa en pantalla", () => {
    mockServices([makeService({ id: "s1", name: "Corte mujer", category: "Cabello" })])
    mockEmployeeServices(undefined, true)
    useWizardStore.setState({ selectedEmployee: laura })

    render(<ServiceStep />)

    const card = screen.getByRole("button", { name: /Corte mujer/ })
    expect(card).toBeDisabled()
    expect(screen.getByRole("alert")).toHaveTextContent(/no se ha podido comprobar/i)
  })

  // "Sin preferencia" no tiene empleado concreto que consultar: el aviso de
  // fallo de asignacion no aplica ahi.
  it("con anyEmployee, un fallo de useEmployeeServices no pinta el aviso de asignacion", () => {
    mockMatchMedia(true)
    mockServices([makeService({ id: "s1", name: "Corte mujer", category: "Cabello" })])
    mockEmployeeServices(undefined, true)
    useWizardStore.setState({ anyEmployee: true, selectedEmployee: null })

    render(<ServiceStep />)

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  // `WizardSummaryAside` por defecto pinta el encabezado y la nota de
  // confianza de la reserva PUBLICA ("Tu reserva" + "Sin registro..."),
  // incorrectos aqui: esta cita la crea el propio salon.
  // `NuevaCitaDesktopPaso2.dc.html:130` dice "Resumen" y ningun artboard del
  // asistente dibuja esa nota.
  it("en escritorio, el aside dice 'Resumen' y no pinta la nota de la reserva publica", () => {
    mockMatchMedia(true)
    mockServices([makeService({ id: "s1", category: "Cabello" })])
    mockEmployeeServices([assignedTo("s1")])
    useWizardStore.setState({ selectedEmployee: laura })

    render(<ServiceStep />)

    expect(screen.getByText("Resumen")).toBeInTheDocument()
    expect(screen.queryByText("Tu reserva")).not.toBeInTheDocument()
    expect(screen.queryByText(/Sin registro/)).not.toBeInTheDocument()
  })

  // `isStepComplete` caso 2 gobierna el `disabled` del CTA del aside: sin
  // servicio elegido tiene que estar deshabilitado. Nada mas en este fichero
  // comprobaba el `disabled` del CTA -- solo el de las tarjetas de servicio.
  it("en escritorio, el CTA del aside esta deshabilitado sin servicio elegido", () => {
    mockMatchMedia(true)
    mockServices([makeService({ id: "s1", category: "Cabello" })])
    mockEmployeeServices([assignedTo("s1")])
    useWizardStore.setState({ selectedEmployee: laura })

    render(<ServiceStep />)

    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled()
  })
})
