import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PublicBookingError } from "./public-booking-error"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { appointmentsApi } from "@/lib/api/appointments"
import type { AvailabilityResponse } from "@/types/appointment"
import type { SalonPublic, ServicePublic } from "@/types/salon"

vi.mock("@/lib/api/appointments", () => ({
  appointmentsApi: { getPublicAvailability: vi.fn() },
}))

const mockGetPublicAvailability = vi.mocked(appointmentsApi.getPublicAvailability)

// jsdom no implementa `window.matchMedia`; `src/test/setup.ts` ya deja un
// stub que responde `matches: false` para cualquier query -- este helper lo
// sobrescribe para simular escritorio, mismo patron que
// `public-datetime-step.test.tsx`.
function setDesktop(desktop: boolean) {
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
  addressPostalCode: "08001",
  businessHours: [],
  services: [service],
  employees: [
    { id: "emp_1", firstName: "Laura", lastName: "Martinez", jobTitle: null, serviceIds: ["svc_1"] },
  ],
  servicesUnavailable: false,
  employeesUnavailable: false,
}

const availability: AvailabilityResponse = {
  date: "2026-08-28",
  employeeId: "emp_1",
  slots: [
    { startTime: "09:00:00", endTime: "09:30:00" },
    { startTime: "16:00:00", endTime: "16:30:00" },
  ],
}

function renderScreen() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PublicBookingError salon={salon} />
    </QueryClientProvider>
  )
}

describe("PublicBookingError", () => {
  beforeEach(() => {
    setDesktop(false)
    usePublicBookingStore.getState().reset()
    usePublicBookingStore.getState().setStep(5)
    usePublicBookingStore.getState().setSalonSlug("bella-vista")
    usePublicBookingStore.getState().selectService(service)
    usePublicBookingStore.getState().selectEmployee("emp_1", false)
    usePublicBookingStore.getState().selectDateTime("2026-08-28", "2026-08-28T11:00:00")
    usePublicBookingStore.getState().setClientForm({
      firstName: "Ana",
      lastName: "Garcia",
      email: "ana@mail.com",
      phone: "612345678",
      gdprConsent: true,
    })
    usePublicBookingStore.getState().setConflict({ slot: "2026-08-28T11:00:00", date: "2026-08-28" })
    mockGetPublicAvailability.mockReset()
    mockGetPublicAvailability.mockResolvedValue(availability)
  })

  it("pinta el titulo, el hueco perdido tachado y la insignia Ocupada", async () => {
    renderScreen()

    expect(screen.getByText("Ese hueco se acaba de ocupar")).toBeInTheDocument()
    expect(screen.getAllByText("11:00 - 12:30").length).toBeGreaterThan(0)
    expect(screen.getByText("Ocupada")).toBeInTheDocument()

    // Los huecos alternativos son datos reales que llegan por red (via
    // React Query) -- se espera algo que el componente no posee de
    // antemano antes de aseverar sobre ellos (AGENTS.md).
    expect(await screen.findByRole("button", { name: "09:00" })).toBeInTheDocument()
    expect(mockGetPublicAvailability).toHaveBeenCalledWith({
      salonSlug: "bella-vista",
      employeeId: "emp_1",
      date: "2026-08-28",
      serviceId: "svc_1",
    })
  })

  it("elegir un hueco alternativo limpia el conflicto y fija la nueva hora, sin perder el resto de la reserva", async () => {
    const user = userEvent.setup()
    renderScreen()

    const altButton = await screen.findByRole("button", { name: "09:00" })
    await user.click(altButton)

    await waitFor(() => expect(usePublicBookingStore.getState().conflict).toBeNull())

    const state = usePublicBookingStore.getState()
    expect(state.selectedSlot).toBe("2026-08-28T09:00:00")
    expect(state.selectedDate).toBe("2026-08-28")
    // La promesa del artboard ("Guardamos tus datos"): el resto de la
    // reserva sigue intacto tras resolver el conflicto.
    expect(state.selectedService?.id).toBe("svc_1")
    expect(state.selectedEmployeeId).toBe("emp_1")
    expect(state.clientForm.email).toBe("ana@mail.com")
  })

  it("Elegir otro dia limpia el conflicto y vuelve al paso 3, conservando los datos", async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(screen.getByRole("button", { name: "Elegir otro dia" }))

    expect(usePublicBookingStore.getState().conflict).toBeNull()
    expect(usePublicBookingStore.getState().step).toBe(3)
    expect(usePublicBookingStore.getState().clientForm.firstName).toBe("Ana")
  })

  it("en escritorio pinta la columna de horas como principal y el hueco perdido en la barra lateral de 320px", async () => {
    setDesktop(true)
    renderScreen()

    expect(await screen.findByRole("button", { name: "09:00" })).toBeInTheDocument()
    expect(
      screen.getByText("Guardamos tus datos: solo tienes que elegir otra hora. No se ha creado ninguna reserva.")
    ).toBeInTheDocument()
    expect(screen.getByText("Ninguna hora te encaja?")).toBeInTheDocument()
  })
})
