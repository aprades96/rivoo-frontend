import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PublicDateTimeStep } from "./public-datetime-step"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { appointmentsApi } from "@/lib/api/appointments"
import type { AvailabilityResponse } from "@/types/appointment"
import type { SalonPublic, ServicePublic } from "@/types/salon"

vi.mock("@/lib/api/appointments", () => ({
  appointmentsApi: { getPublicAvailability: vi.fn() },
}))

const mockGetPublicAvailability = vi.mocked(appointmentsApi.getPublicAvailability)

/**
 * Forma real del cuerpo que devuelve
 * GET /api/v1/appointments/public/availability. Verificada serializando el
 * record AvailabilityResponse/AvailableSlot con el mismo Jackson 3
 * (tools.jackson 3.0.4) que usa Spring Boot 4.0.3.
 */
const availability: AvailabilityResponse = {
  date: "2026-08-28",
  employeeId: "emp_1",
  slots: [
    { startTime: "09:00:00", endTime: "09:30:00" },
    { startTime: "13:15:00", endTime: "13:45:00" },
  ],
}

const service: ServicePublic = {
  id: "svc_1",
  name: "Corte",
  description: null,
  durationMinutes: 30,
  price: 20,
  currency: "EUR",
}

const salon: SalonPublic = {
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
  services: [service],
  employees: [
    { id: "emp_1", firstName: "Ana", lastName: "Lopez", jobTitle: null, serviceIds: ["svc_1"] },
  ],
  servicesUnavailable: false,
  employeesUnavailable: false,
}

function renderStep() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PublicDateTimeStep salon={salon} />
    </QueryClientProvider>
  )
}

describe("PublicDateTimeStep", () => {
  beforeEach(() => {
    usePublicBookingStore.getState().reset()
    usePublicBookingStore.getState().setSalonSlug("salon-demo")
    usePublicBookingStore.getState().selectService(service)
    usePublicBookingStore.getState().selectEmployee("emp_1", false)
    mockGetPublicAvailability.mockReset()
    mockGetPublicAvailability.mockResolvedValue(availability)
  })

  it("pinta las horas que llegan en el campo 'slots' del backend", async () => {
    renderStep()

    expect(await screen.findByRole("button", { name: "09:00" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "13:15" })).toBeInTheDocument()
    expect(screen.queryByText("No hay huecos disponibles este dia.")).not.toBeInTheDocument()
  })

  it("guarda el hueco elegido como fecha+hora que acepta POST /api/v1/appointments/book", async () => {
    const user = userEvent.setup()
    renderStep()

    await user.click(await screen.findByRole("button", { name: "09:00" }))

    const state = usePublicBookingStore.getState()
    expect(state.selectedDate).toBe("2026-08-28")
    // PublicBookingRequest.requestedTime es LocalDateTime: Jackson rechaza
    // ("09:00:00") con 400, necesita fecha+hora ISO.
    expect(state.selectedSlot).toBe("2026-08-28T09:00:00")
    expect(state.step).toBe(2)
  })

  it("sigue mostrando el vacio cuando el backend devuelve slots: []", async () => {
    mockGetPublicAvailability.mockResolvedValue({ ...availability, slots: [] })

    renderStep()

    expect(await screen.findByText("No hay huecos disponibles este dia.")).toBeInTheDocument()
  })
})
