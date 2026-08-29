import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
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

/**
 * El cable que hace alcanzable la pantalla de "ese hueco se acaba de ocupar".
 *
 * Se escribieron 359 lineas de componente y 160 de test para esa pantalla, y la
 * unica linea que la conecta con la aplicacion — el `if (conflict)` de
 * `page.tsx` — no la cubria nada: un revisor la borro entera y la suite siguio
 * en verde. Este test la fija.
 *
 * Comprueba ademas el ORDEN: `conflict` se mira antes que `step`. El store se
 * deja en el paso 5, asi que si la comprobacion se moviera detras del despacho
 * de pasos, aqui saldria la pantalla de confirmar y no la de error.
 */
describe("PublicBookingPage -- la rama de conflicto", () => {
  beforeEach(() => {
    usePublicBookingStore.getState().reset()
    vi.mocked(salonsApi.getPublic).mockReset()
  })

  it("pinta la pantalla de hueco ocupado cuando hay conflicto, por delante del paso actual", () => {
    const salon: SalonPublic = {
      ...baseSalon,
      services: [service],
      employees: [
        { id: "emp_1", firstName: "Laura", lastName: "Martinez", jobTitle: null, serviceIds: ["svc_1"] },
      ],
    }

    renderPage("salon-demo", salon)

    // Despues del render, no antes: `page.tsx` llama a `reset()` en un efecto
    // de montaje, asi que cualquier estado preparado antes se borra. En la
    // aplicacion real el conflicto se fija con la pagina ya montada, que es lo
    // que esto reproduce.
    act(() => {
      usePublicBookingStore.getState().selectService(service)
      usePublicBookingStore.getState().selectEmployee("emp_1", false)
      usePublicBookingStore.getState().selectDateTime("2026-08-28", "2026-08-28T11:00:00")
      usePublicBookingStore.getState().setStep(5)
      usePublicBookingStore.getState().setConflict({ slot: "2026-08-28T11:00:00", date: "2026-08-28" })
    })

    expect(screen.getByText("Ese hueco se acaba de ocupar")).toBeInTheDocument()
    expect(screen.queryByText("Confirma tu reserva")).not.toBeInTheDocument()
  })
})
