import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PublicConfirmStep } from "./public-confirm-step"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { appointmentsApi } from "@/lib/api/appointments"
import type { SalonPublic, ServicePublic } from "@/types/salon"

vi.mock("@/lib/api/appointments", () => ({
  appointmentsApi: { bookPublic: vi.fn() },
}))

const mockBookPublic = vi.mocked(appointmentsApi.bookPublic)

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

function renderStep() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PublicConfirmStep salon={salon} />
    </QueryClientProvider>
  )
}

describe("PublicConfirmStep", () => {
  beforeEach(() => {
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
    mockBookPublic.mockReset()
  })

  it("pinta el titulo una sola vez -- lo pone el chasis, este paso no lleva su propio <h2>", () => {
    mockBookPublic.mockResolvedValue({
      id: "appt_1",
      clientName: "Ana Garcia",
      employeeId: "emp_1",
      serviceId: "svc_1",
      startTime: "2026-08-28T11:00:00",
      endTime: "2026-08-28T12:30:00",
      status: "PENDING",
      confirmationToken: "tok_1",
    })

    renderStep()

    expect(screen.getAllByText("Confirma tu reserva")).toHaveLength(1)
  })

  it("pinta el aviso ambar con su literal exacto", () => {
    renderStep()

    expect(
      screen.getByText("El salon confirmara tu reserva. Recibiras un email en cuanto lo haga.")
    ).toBeInTheDocument()
  })

  it("el CTA dispara la mutacion con el payload que espera POST /api/v1/appointments/book", async () => {
    mockBookPublic.mockResolvedValue({
      id: "appt_1",
      clientName: "Ana Garcia",
      employeeId: "emp_1",
      serviceId: "svc_1",
      startTime: "2026-08-28T11:00:00",
      endTime: "2026-08-28T12:30:00",
      status: "PENDING",
      confirmationToken: "tok_1",
    })
    const user = userEvent.setup()
    renderStep()

    await user.click(screen.getByRole("button", { name: "Confirmar reserva" }))

    expect(mockBookPublic).toHaveBeenCalledWith({
      salonSlug: "bella-vista",
      serviceExternalId: "svc_1",
      employeeExternalId: "emp_1",
      requestedTime: "2026-08-28T11:00:00",
      clientFirstName: "Ana",
      clientLastName: "Garcia",
      clientEmail: "ana@mail.com",
      clientPhone: "612345678",
      honeypot: undefined,
    })

    // El exito avanza el wizard (paso 6, pantalla de confirmacion). Se
    // comprueba en el store -- no hay nada propio del componente que lo
    // demuestre mejor -- y con `waitFor` porque la resolucion de la mutacion
    // es asincrona de verdad, no una promesa ya resuelta antes del click.
    await waitFor(() => expect(usePublicBookingStore.getState().step).toBe(6))
  })

  it("un fallo de la mutacion pinta el banner de error (comportamiento actual, sin discriminar el caso de hueco ocupado -- ver TODO(T10))", async () => {
    mockBookPublic.mockRejectedValue(new Error("El horario ya no esta disponible"))
    const user = userEvent.setup()
    renderStep()

    await user.click(screen.getByRole("button", { name: "Confirmar reserva" }))

    expect(await screen.findByText("El horario ya no esta disponible")).toBeInTheDocument()
    expect(usePublicBookingStore.getState().step).toBe(5)
  })
})
