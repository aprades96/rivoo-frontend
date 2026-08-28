import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import TodayPage from "./page"
import type { Appointment } from "@/types/appointment"
import type { ServiceOffering } from "@/types/service"

// Driving the page through mocked hooks (never a live QueryClient) keeps every
// case below a plain, synchronous render: no react-query notifyManager
// macrotask involved anywhere in this file (see AGENTS.md).
const useTodayAppointmentsMock = vi.fn()
const useServicesMock = vi.fn()
const useAuthMock = vi.fn()

vi.mock("@/hooks/use-appointments", () => ({
  useTodayAppointments: (...args: unknown[]) => useTodayAppointmentsMock(...args),
  useUpdateAppointmentStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useCancelAppointment: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock("@/hooks/use-staff", () => ({
  useServices: (...args: unknown[]) => useServicesMock(...args),
}))

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => useAuthMock(),
}))

function appointmentsResult(overrides: Partial<ReturnType<typeof defaultAppointments>> = {}) {
  return { ...defaultAppointments(), ...overrides }
}

function defaultAppointments() {
  return {
    data: { content: [] as Appointment[] },
    isLoading: false,
    isRefetching: false,
    refetch: vi.fn(),
  }
}

function servicesResult(overrides: Partial<ReturnType<typeof defaultServices>> = {}) {
  return { ...defaultServices(), ...overrides }
}

function defaultServices() {
  return {
    data: { content: [] as ServiceOffering[] },
    isLoading: false,
  }
}

const oneService: ServiceOffering = {
  id: "svc_1",
  name: "Corte hombre",
  description: null,
  durationMinutes: 30,
  price: 15,
  category: null,
  isActive: true,
}

describe("TodayPage", () => {
  beforeEach(() => {
    useTodayAppointmentsMock.mockReset()
    useServicesMock.mockReset()
    useAuthMock.mockReset()
    useAuthMock.mockReturnValue({ user: { name: "Ana Garcia" } })
  })

  it("muestra el aviso de servicios cuando el salon no tiene ninguno, en vez del vacio de citas", () => {
    useTodayAppointmentsMock.mockReturnValue(appointmentsResult())
    useServicesMock.mockReturnValue(servicesResult({ data: { content: [] } }))

    render(<TodayPage />)

    expect(screen.getByText("Aun no tienes servicios")).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "Crear servicio" })
    expect(link).toHaveAttribute("href", "/staff")

    // El vacio generico de citas no debe convivir con este aviso: serian dos
    // mensajes contradictorios (uno dice "sin servicios", el otro "crea una
    // cita") para el mismo motivo real.
    expect(screen.queryByText("No hay citas para hoy")).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Crear cita" })).not.toBeInTheDocument()
  })

  it("no muestra el aviso de servicios mientras la lista de servicios todavia esta cargando", () => {
    useTodayAppointmentsMock.mockReturnValue(appointmentsResult({ isLoading: true }))
    useServicesMock.mockReturnValue(servicesResult({ data: undefined, isLoading: true }))

    render(<TodayPage />)

    expect(screen.queryByText("Aun no tienes servicios")).not.toBeInTheDocument()
  })

  it("muestra el flujo normal de citas cuando el salon ya tiene al menos un servicio", () => {
    useTodayAppointmentsMock.mockReturnValue(appointmentsResult({ data: { content: [] } }))
    useServicesMock.mockReturnValue(servicesResult({ data: { content: [oneService] } }))

    render(<TodayPage />)

    expect(screen.queryByText("Aun no tienes servicios")).not.toBeInTheDocument()
    expect(screen.getByText("No hay citas para hoy")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Crear cita" })).toHaveAttribute(
      "href",
      "/appointments/new"
    )
  })
})
