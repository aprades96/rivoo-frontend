import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PendingOnlineCard } from "./pending-online-card"
import type { Appointment } from "@/types/appointment"

const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, back: vi.fn(), replace: vi.fn() }),
}))

const DAY = "2026-08-30"

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "apt_1",
    tenantId: "tenant_1",
    clientId: "cli_1",
    clientName: "Laia Roca",
    clientPhone: null,
    clientEmail: null,
    employeeId: "emp_1",
    employeeName: "Laura Martinez",
    serviceId: "svc_1",
    serviceName: "Corte",
    servicePrice: 30,
    serviceDurationMinutes: 30,
    startTime: `${DAY}T12:30:00`,
    endTime: `${DAY}T13:00:00`,
    status: "PENDING",
    source: "ONLINE",
    notes: null,
    reminderSent: false,
    createdAt: `${DAY}T09:00:00`,
    updatedAt: `${DAY}T09:00:00`,
    ...overrides,
  }
}

afterEach(() => {
  pushMock.mockClear()
})

describe("PendingOnlineCard", () => {
  it("con cero citas no pinta nada", () => {
    render(<PendingOnlineCard appointments={[]} />)

    expect(screen.queryByTestId("pending-online-card")).not.toBeInTheDocument()
  })

  it("con una cita usa singular y no escribe la 'y'", () => {
    const appointments = [makeAppointment()]

    render(<PendingOnlineCard appointments={appointments} />)

    expect(screen.getByText("1 reserva online sin confirmar")).toBeInTheDocument()
    expect(
      screen.getByText("Laia Roca (12:30) esta esperando respuesta del salon.")
    ).toBeInTheDocument()
  })

  it("titulo con leading-tight, no leading-none (design/HoyDesktop.dc.html:231 no declara line-height)", () => {
    render(<PendingOnlineCard appointments={[makeAppointment()]} />)

    const title = screen.getByText("1 reserva online sin confirmar")
    expect(title).toHaveClass("leading-tight")
    expect(title).not.toHaveClass("leading-none")
  })

  it("con dos citas usa plural y las une con 'y'", () => {
    const appointments = [
      makeAppointment(),
      makeAppointment({
        id: "apt_2",
        clientName: "Jordi Mas",
        startTime: `${DAY}T16:00:00`,
        endTime: `${DAY}T16:30:00`,
      }),
    ]

    render(<PendingOnlineCard appointments={appointments} />)

    expect(screen.getByText("2 reservas online sin confirmar")).toBeInTheDocument()
    expect(
      screen.getByText("Laia Roca (12:30) y Jordi Mas (16:00) estan esperando respuesta del salon.")
    ).toBeInTheDocument()
  })

  it("con tres o mas citas enumera con comas y 'y' antes de la ultima", () => {
    const appointments = [
      makeAppointment(),
      makeAppointment({
        id: "apt_2",
        clientName: "Jordi Mas",
        startTime: `${DAY}T16:00:00`,
        endTime: `${DAY}T16:30:00`,
      }),
      makeAppointment({
        id: "apt_3",
        clientName: "Ana Ruiz",
        startTime: `${DAY}T18:00:00`,
        endTime: `${DAY}T18:30:00`,
      }),
    ]

    render(<PendingOnlineCard appointments={appointments} />)

    expect(screen.getByText("3 reservas online sin confirmar")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Laia Roca (12:30), Jordi Mas (16:00) y Ana Ruiz (18:00) estan esperando respuesta del salon."
      )
    ).toBeInTheDocument()
  })

  it("el CTA navega a /calendar (D24)", async () => {
    const user = userEvent.setup()
    const appointments = [makeAppointment()]

    render(<PendingOnlineCard appointments={appointments} />)

    await user.click(screen.getByRole("button", { name: "Revisar y confirmar" }))

    expect(pushMock).toHaveBeenCalledWith("/calendar")
  })
})
