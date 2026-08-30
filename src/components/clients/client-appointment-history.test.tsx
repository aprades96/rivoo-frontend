import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ClientAppointmentHistory } from "./client-appointment-history"
import { useClientAppointments } from "@/hooks/use-clients"
import type { ClientAppointment, ClientAppointmentsPage } from "@/types/client"

vi.mock("@/hooks/use-clients", () => ({ useClientAppointments: vi.fn() }))

const useClientAppointmentsMock = vi.mocked(useClientAppointments)

function makeAppointment(overrides: Partial<ClientAppointment> = {}): ClientAppointment {
  return {
    id: "apt_1",
    startTime: "2026-08-05T10:00:00Z",
    serviceName: "Corte + Secado",
    employeeName: "Laura Martinez",
    price: 35,
    status: "COMPLETED",
    ...overrides,
  }
}

function makePage(content: ClientAppointment[], overrides: Partial<ClientAppointmentsPage["summary"]> = {}): ClientAppointmentsPage {
  return {
    content,
    page: 0,
    size: 7,
    totalElements: 14,
    totalPages: 2,
    summary: {
      totalAppointments: 14,
      billedAmount: 612,
      completedCount: 11,
      lastCompletedAt: "2026-08-05T10:00:00Z",
      ...overrides,
    },
  }
}

function mockAppointments(overrides: Partial<ReturnType<typeof useClientAppointments>> = {}) {
  useClientAppointmentsMock.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useClientAppointments>)
}

const SEVEN_APPOINTMENTS = Array.from({ length: 7 }, (_, index) =>
  makeAppointment({ id: `apt_${index + 1}`, serviceName: `Servicio ${index + 1}` })
)

describe("ClientAppointmentHistory", () => {
  beforeEach(() => {
    useClientAppointmentsMock.mockReset()
  })

  it("mientras carga, pinta un esqueleto (no la tabla ni la cabecerilla)", () => {
    mockAppointments({ isLoading: true })

    render(<ClientAppointmentHistory clientId="cli_1" isDesktop />)

    expect(document.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  // D38: el endpoint SI propaga el fallo -- "sin citas" y "no se pudo
  // cargar" no pueden verse iguales.
  it("con un fallo del backend, pinta una rama de error propia con reintentar", async () => {
    const user = userEvent.setup()
    const refetch = vi.fn()
    mockAppointments({ isError: true, refetch })

    render(<ClientAppointmentHistory clientId="cli_1" isDesktop />)

    expect(screen.getByText("No se ha podido cargar el historial")).toBeInTheDocument()
    expect(screen.queryByText(/citas/)).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Reintentar" }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  // D23: sin citas, solo la cabecerilla con "0 citas · 0,00 € facturados" --
  // ni tabla, ni footer, ni copy inventado.
  it("sin citas, pinta solo la cabecerilla con 0 citas y 0,00 euros", () => {
    mockAppointments({
      data: makePage([], { totalAppointments: 0, billedAmount: 0, completedCount: 0, lastCompletedAt: null }),
    })

    render(<ClientAppointmentHistory clientId="cli_1" isDesktop />)

    expect(screen.getByText(/0 citas/)).toBeInTheDocument()
    expect(screen.getByText(/0,00/)).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument()
  })

  describe("escritorio", () => {
    it("pinta las 7 filas en una tabla con las 5 columnas y el footer 'Mostrando 7 de 14 citas'", () => {
      mockAppointments({ data: makePage(SEVEN_APPOINTMENTS) })

      render(<ClientAppointmentHistory clientId="cli_1" isDesktop />)

      const table = screen.getByRole("table", { name: "Historial de citas" })
      expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
        "Fecha",
        "Servicio",
        "Profesional",
        "Importe",
        "Estado",
      ])
      expect(screen.getAllByRole("row")).toHaveLength(8) // cabecera + 7 filas
      expect(screen.getByText("14 citas · 612,00 € facturados")).toBeInTheDocument()

      // D24: "Ver todas" NO se monta -- su destino no existe.
      expect(within(table).queryByText("Ver todas")).not.toBeInTheDocument()
      expect(screen.getByText("Mostrando 7 de 14 citas")).toBeInTheDocument()
    })

    // D25: el importe de una cita NO_SHOW/CANCELLED se atenua, en los DOS
    // anchos -- no es un desliz de un solo artboard.
    it("atenua el importe de las citas NO_SHOW y CANCELLED, pero no el de las COMPLETED", () => {
      mockAppointments({
        data: makePage([
          makeAppointment({ id: "apt_ok", price: 35, status: "COMPLETED" }),
          makeAppointment({ id: "apt_noshow", price: 40, status: "NO_SHOW" }),
          makeAppointment({ id: "apt_cancel", price: 20, status: "CANCELLED" }),
        ]),
      })

      render(<ClientAppointmentHistory clientId="cli_1" isDesktop />)

      // `formatCurrency` (trap #9, AGENTS.md) emite un U+00A0 entre el
      // numero y el simbolo -- se compara por regex para no depender de un
      // caracter de espacio exacto en el fichero fuente.
      const paid = screen.getByText(/^35,00.€$/)
      const noShow = screen.getByText(/^40,00.€$/)
      const cancelled = screen.getByText(/^20,00.€$/)

      expect(paid.className).not.toMatch(/text-muted-foreground-2/)
      expect(noShow.className).toMatch(/text-muted-foreground-2/)
      expect(cancelled.className).toMatch(/text-muted-foreground-2/)
    })
  })

  describe("movil", () => {
    it("solo pinta las 3 primeras citas, aunque el resumen hable de 14", () => {
      mockAppointments({ data: makePage(SEVEN_APPOINTMENTS) })

      render(<ClientAppointmentHistory clientId="cli_1" isDesktop={false} />)

      expect(screen.queryByRole("table")).not.toBeInTheDocument()
      expect(screen.getByText(/Servicio 1$/)).toBeInTheDocument()
      expect(screen.getByText(/Servicio 2$/)).toBeInTheDocument()
      expect(screen.getByText(/Servicio 3$/)).toBeInTheDocument()
      expect(screen.queryByText(/Servicio 4$/)).not.toBeInTheDocument()
    })

    // D24: el movil ensena 3 de 14 citas y su artboard NO dibuja footer --
    // sin el, la pantalla afirmaria por omision que el cliente vino 3 veces.
    // El footer se pinta TAMBIEN aqui, con el mismo texto que el escritorio.
    it("pinta el footer 'Mostrando 3 de 14 citas' aunque su artboard no lo dibuje", () => {
      mockAppointments({ data: makePage(SEVEN_APPOINTMENTS) })

      render(<ClientAppointmentHistory clientId="cli_1" isDesktop={false} />)

      expect(screen.getByText("Mostrando 3 de 14 citas")).toBeInTheDocument()
    })

    it("no monta ningun enlace 'Ver todas'", () => {
      mockAppointments({ data: makePage(SEVEN_APPOINTMENTS) })

      render(<ClientAppointmentHistory clientId="cli_1" isDesktop={false} />)

      expect(screen.queryByText("Ver todas")).not.toBeInTheDocument()
    })
  })
})
