import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import PublicBookingPage from "./page"
import { salonsApi } from "@/lib/api/salons"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"
import type { SalonPublic, ServicePublic } from "@/types/salon"

vi.mock("@/lib/api/salons", () => ({
  salonsApi: {
    getPublic: vi.fn(),
  },
}))

const service: ServicePublic = {
  id: "svc_1",
  name: "Corte hombre",
  description: "Corte clasico",
  durationMinutes: 30,
  price: 15,
  currency: "EUR",
}

// `servicesUnavailable` es el nombre de cable exacto que emite
// SalonPublicResponse (salon-service). Ver src/types/salon.ts.
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

// `use()` sobre una Promise nativa nunca resuelve de forma sincrona en un
// render de test: React solo puede leer el estado 'fulfilled' llamando a
// `.then()` sobre el propio thenable, y una Promise real siempre entrega ese
// callback en un microtask, así que la primera pasada de render SIEMPRE
// suspende (ver investigacion con sondas: ni `await act(async () => {})` ni
// `await screen.findBy*` consiguen que el reintento del Suspense boundary
// llegue a comprometerse en jsdom). Un thenable sincrono devuelve el valor ya
// disponible dentro de la misma llamada a `.then()`, así que `use()` jamás
// necesita suspender: el render queda determinista y sin Suspense boundary.
function resolvedParams<T>(value: T): Promise<T> {
  return { then: (onFulfilled: (v: T) => void) => onFulfilled(value) } as unknown as Promise<T>
}

function renderPage(slug: string, salon: SalonPublic) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  queryClient.setQueryData(["salon-public", slug], salon)

  return render(
    <QueryClientProvider client={queryClient}>
      <PublicBookingPage params={resolvedParams({ slug })} />
    </QueryClientProvider>
  )
}

describe("PublicBookingPage", () => {
  beforeEach(() => {
    usePublicBookingStore.getState().reset()
    vi.mocked(salonsApi.getPublic).mockReset()
  })

  it("dice que el salon aun no acepta reservas online cuando no tiene servicios y no hay fallo de carga", () => {
    renderPage("salon-demo", { ...baseSalon, services: [], servicesUnavailable: false })

    expect(screen.getByText("Este salon aun no acepta reservas online")).toBeInTheDocument()

    // No debe confundirse con un fallo de carga: nada de aviso de reintento
    // ni del asistente de pasos que ya no tiene sentido ofrecer.
    expect(screen.queryByText("No hemos podido cargar el catalogo")).not.toBeInTheDocument()
    expect(screen.queryByText("Elige un servicio")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument()
  })

  it("avisa de que no se ha podido cargar el catalogo, sin decir que el salon no acepta reservas, cuando servicesUnavailable esta activo", () => {
    vi.mocked(salonsApi.getPublic).mockResolvedValue({
      ...baseSalon,
      services: [],
      servicesUnavailable: true,
    })

    renderPage("salon-demo", { ...baseSalon, services: [], servicesUnavailable: true })

    expect(screen.getByText("No hemos podido cargar el catalogo")).toBeInTheDocument()
    // Decirle al visitante que el salon no acepta reservas por una caida de
    // red le costaria una reserva real al salon: la frase de "aun no acepta"
    // pertenece solo al vacio real (flag en false).
    expect(
      screen.queryByText("Este salon aun no acepta reservas online")
    ).not.toBeInTheDocument()

    const retryButton = screen.getByRole("button", { name: "Reintentar" })
    fireEvent.click(retryButton)

    expect(salonsApi.getPublic).toHaveBeenCalledWith("salon-demo")
  })

  it("sigue el flujo normal del asistente cuando el salon si tiene servicios", () => {
    renderPage("salon-demo", { ...baseSalon, services: [service] })

    // page.tsx ya no pinta un titulo propio (STEP_META se elimino): el unico
    // titulo en pantalla es el que monta PublicServiceStep a traves de su
    // propio BookingStepShell. getByText falla si el duplicado reaparece.
    expect(screen.getByText("Elige un servicio")).toBeInTheDocument()
    expect(screen.getByText("Corte hombre")).toBeInTheDocument()
    expect(
      screen.queryByText("Este salon aun no acepta reservas online")
    ).not.toBeInTheDocument()
    expect(screen.queryByText("No hemos podido cargar el catalogo")).not.toBeInTheDocument()
  })
})
