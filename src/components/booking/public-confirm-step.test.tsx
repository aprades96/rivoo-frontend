import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { PublicConfirmStep } from "./public-confirm-step"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import { appointmentsApi } from "@/lib/api/appointments"
import type { AvailabilityResponse } from "@/types/appointment"
import type { SalonPublic, ServicePublic } from "@/types/salon"

vi.mock("@/lib/api/appointments", () => ({
  appointmentsApi: { bookPublic: vi.fn(), getPublicAvailability: vi.fn() },
}))

const mockBookPublic = vi.mocked(appointmentsApi.bookPublic)
const mockGetPublicAvailability = vi.mocked(appointmentsApi.getPublicAvailability)

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
    mockGetPublicAvailability.mockReset()
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

  it("T10 -- un fallo de la mutacion re-consulta disponibilidad; si el hueco sigue libre, pinta el banner generico", async () => {
    mockBookPublic.mockRejectedValue(new Error("El horario ya no esta disponible"))
    mockGetPublicAvailability.mockResolvedValue({
      date: "2026-08-28",
      employeeId: "emp_1",
      slots: [{ startTime: "11:00:00", endTime: "12:30:00" }], // el hueco elegido sigue presente
    })
    const user = userEvent.setup()
    renderStep()

    await user.click(screen.getByRole("button", { name: "Confirmar reserva" }))

    expect(await screen.findByText("El horario ya no esta disponible")).toBeInTheDocument()
    expect(usePublicBookingStore.getState().conflict).toBeNull()
    expect(usePublicBookingStore.getState().step).toBe(5)
  })

  it("T10 -- si el hueco elegido ya no esta en la re-consulta, marca el conflicto en vez del banner", async () => {
    mockBookPublic.mockRejectedValue(new Error("No se pudo crear la reserva"))
    mockGetPublicAvailability.mockResolvedValue({
      date: "2026-08-28",
      employeeId: "emp_1",
      slots: [{ startTime: "09:00:00", endTime: "09:30:00" }], // el 11:00 ya no esta
    } satisfies AvailabilityResponse)
    const user = userEvent.setup()
    renderStep()

    await user.click(screen.getByRole("button", { name: "Confirmar reserva" }))

    await waitFor(() =>
      expect(usePublicBookingStore.getState().conflict).toEqual({
        slot: "2026-08-28T11:00:00",
        date: "2026-08-28",
      })
    )

    expect(mockGetPublicAvailability).toHaveBeenCalledWith({
      salonSlug: "bella-vista",
      employeeId: "emp_1",
      date: "2026-08-28",
      serviceId: "svc_1",
    })
    // No se pinta el banner generico -- el conflicto tiene su propia pantalla.
    expect(screen.queryByText("No se pudo crear la reserva")).not.toBeInTheDocument()

    // Promesa del artboard ("Guardamos tus datos"): el conflicto no resetea
    // el resto de la reserva -- servicio, profesional y datos del cliente
    // siguen en el store.
    const state = usePublicBookingStore.getState()
    expect(state.selectedService?.id).toBe("svc_1")
    expect(state.selectedEmployeeId).toBe("emp_1")
    expect(state.clientForm).toEqual({
      firstName: "Ana",
      lastName: "Garcia",
      email: "ana@mail.com",
      phone: "612345678",
      gdprConsent: true,
    })
  })
})

/**
 * Regresion del `staleTime: 0` de la re-consulta.
 *
 * `fetchQuery` respeta `staleTime`, y la aplicacion lo fija globalmente en
 * cinco minutos (`src/providers/query-provider.tsx:13`). El paso 3 acaba de
 * leer ESA MISMA clave para pintar el hueco que el visitante elige, asi que
 * sin `staleTime: 0` la "re-consulta" se sirve de esa caché -- justo la
 * respuesta que listaba el hueco como libre. El conflicto no se detecta nunca
 * y la pantalla de error entera queda inalcanzable.
 *
 * Los demas tests de este fichero no pueden verlo: crean su QueryClient sin
 * `staleTime`, o sea con el valor 0 por defecto, que enmascara el fallo. Este
 * reproduce la configuracion real y ademas cuenta las llamadas: si alguien
 * quita el `staleTime: 0`, la caché gana, la API no se vuelve a llamar y el
 * test se pone rojo por las dos razones a la vez.
 */
describe("PublicConfirmStep -- la re-consulta del conflicto no puede salir de la cache", () => {
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
    mockGetPublicAvailability.mockReset()
  })

  it("detecta el conflicto aunque el paso 3 acabe de cachear el hueco como libre", async () => {
    const queryClient = new QueryClient({
      // La configuracion de produccion, no la del resto de tests.
      defaultOptions: {
        queries: { retry: false, staleTime: 5 * 60 * 1000 },
        mutations: { retry: false },
      },
    })

    // Lo que el paso 3 dejo en la cache hace unos segundos: el hueco, libre.
    const fresco: AvailabilityResponse = {
      date: "2026-08-28",
      employeeId: "emp_1",
      slots: [{ startTime: "11:00:00", endTime: "12:30:00" }],
    }
    queryClient.setQueryData(["public-availability", "emp_1", "svc_1", "2026-08-28"], fresco)

    // Lo que el servidor responde AHORA: alguien se lo ha llevado.
    mockBookPublic.mockRejectedValue(new Error("El horario ya no esta disponible"))
    mockGetPublicAvailability.mockResolvedValue({
      date: "2026-08-28",
      employeeId: "emp_1",
      slots: [{ startTime: "09:00:00", endTime: "10:30:00" }],
    })

    const user = userEvent.setup()
    render(
      <QueryClientProvider client={queryClient}>
        <PublicConfirmStep salon={salon} />
      </QueryClientProvider>
    )

    await user.click(screen.getByRole("button", { name: "Confirmar reserva" }))

    // Que se haya llamado a la API es la mitad del asunto: prueba que la cache
    // no gano. La otra mitad es que el conflicto se registre.
    await waitFor(() => expect(mockGetPublicAvailability).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(usePublicBookingStore.getState().conflict).toEqual({
        slot: "2026-08-28T11:00:00",
        date: "2026-08-28",
      })
    )
  })
})
