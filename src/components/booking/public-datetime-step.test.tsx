import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { addDays } from "date-fns"
import { PublicDateTimeStep } from "./public-datetime-step"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { appointmentsApi } from "@/lib/api/appointments"
import type { AvailabilityResponse } from "@/types/appointment"
import type { SalonPublic, ServicePublic } from "@/types/salon"

vi.mock("@/lib/api/appointments", () => ({
  appointmentsApi: { getPublicAvailability: vi.fn() },
}))

const mockGetPublicAvailability = vi.mocked(appointmentsApi.getPublicAvailability)

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
    { startTime: "16:00:00", endTime: "16:30:00" },
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
    { id: "emp_1", firstName: "Ana", lastName: "Lopez", jobTitle: "Estilista", serviceIds: ["svc_1"] },
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
    mockMatchMedia(false)
    usePublicBookingStore.getState().reset()
    usePublicBookingStore.getState().setSalonSlug("salon-demo")
    usePublicBookingStore.getState().selectService(service)
    usePublicBookingStore.getState().selectEmployee("emp_1", false)
    mockGetPublicAvailability.mockReset()
    mockGetPublicAvailability.mockResolvedValue(availability)
  })

  it("reparte los huecos entre Manana y Tarde", async () => {
    renderStep()

    expect(await screen.findByRole("button", { name: "09:00" })).toBeInTheDocument()
    expect(screen.getByText("Mañana")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "16:00" })).toBeInTheDocument()
    expect(screen.getByText("Tarde")).toBeInTheDocument()
  })

  it("tocar un hueco solo lo selecciona: no avanza de paso ni pierde la seleccion previa", async () => {
    const user = userEvent.setup()
    renderStep()

    await user.click(await screen.findByRole("button", { name: "09:00" }))

    const state = usePublicBookingStore.getState()
    expect(state.selectedDate).toBe("2026-08-28")
    // PublicBookingRequest.requestedTime es LocalDateTime: Jackson rechaza
    // ("09:00:00") con 400, necesita fecha+hora ISO.
    expect(state.selectedSlot).toBe("2026-08-28T09:00:00")
    // Cambio de interaccion: el toque solo selecciona, ya no avanza el
    // asistente por su cuenta (antes saltaba de 1 a 2 aqui mismo).
    expect(state.step).toBe(1)
  })

  it("sin hueco elegido el CTA 'Continuar' del footer esta deshabilitado", async () => {
    renderStep()

    await screen.findByRole("button", { name: "09:00" })

    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled()
  })

  it("tras elegir hueco el CTA se habilita y pulsarlo si avanza de paso", async () => {
    const user = userEvent.setup()
    renderStep()

    await user.click(await screen.findByRole("button", { name: "09:00" }))

    const continueButton = screen.getByRole("button", { name: "Continuar" })
    expect(continueButton).not.toBeDisabled()

    await user.click(continueButton)

    expect(usePublicBookingStore.getState().step).toBe(2)
  })

  it("en escritorio el CTA vive en el aside (no en el footer) y avanza igual", async () => {
    mockMatchMedia(true)
    const user = userEvent.setup()
    renderStep()

    await user.click(await screen.findByRole("button", { name: "09:00" }))

    // Solo debe existir un boton "Continuar": si el footer montara a la vez
    // que el aside, getByRole lanzaria por ambiguo (mismo caso que
    // booking-step-shell.test.tsx).
    const continueButton = screen.getByRole("button", { name: "Continuar" })
    expect(continueButton).not.toBeDisabled()

    await user.click(continueButton)

    expect(usePublicBookingStore.getState().step).toBe(2)
  })

  it("sigue mostrando el vacio cuando el backend devuelve slots: []", async () => {
    mockGetPublicAvailability.mockResolvedValue({ ...availability, slots: [] })

    renderStep()

    expect(await screen.findByText("No hay huecos disponibles este dia.")).toBeInTheDocument()
  })

  it("un dia cerrado segun salon.businessHours no es pulsable", async () => {
    const realToday = new Date()
    const tomorrow = addDays(realToday, 1)
    const jsDay = tomorrow.getDay()
    const closedDayOfWeek = jsDay === 0 ? 7 : jsDay // convenio BusinessHoursResponse: Lunes=1..Domingo=7

    const salonWithClosedTomorrow: SalonPublic = {
      ...salon,
      businessHours: [
        {
          dayOfWeek: closedDayOfWeek,
          isOpen: false,
          openTime: "09:00",
          closeTime: "20:00",
          breakStartTime: null,
          breakEndTime: null,
        },
      ],
    }

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <PublicDateTimeStep salon={salonWithClosedTomorrow} />
      </QueryClientProvider>
    )

    // Espera cortesia a que resuelva la consulta de hoy, para no dejar un
    // `act()` pendiente al terminar el test.
    await screen.findByRole("button", { name: "09:00" })

    // `data-testid` en vez del texto del dia: dos meses distintos dentro de
    // los 30 dias de la tira movil pueden compartir numero de dia (p.ej. 2 de
    // enero y 2 de febrero), lo que haria `getByText` ambiguo justo esas
    // fechas del año.
    expect(screen.getByTestId("mobile-day-1")).toBeDisabled()
  })

  it("escritorio: el navegador de semana pagina de 7 en 7 y la primera pagina no retrocede", async () => {
    mockMatchMedia(true)
    const user = userEvent.setup()

    renderStep()
    await screen.findByRole("button", { name: "09:00" })

    expect(screen.getByRole("button", { name: "Semana anterior" })).toBeDisabled()
    expect(screen.queryByTestId("desktop-day-7")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Semana siguiente" }))

    expect(screen.getByTestId("desktop-day-7")).toBeInTheDocument()
  })
})
