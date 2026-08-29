import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CancelAppointmentDialog } from "./cancel-appointment-dialog"
import { ApiError, type ProblemDetail } from "@/lib/api/client"

const mutateMock = vi.fn()
let isPending = false

vi.mock("@/hooks/use-appointments", () => ({
  useCancelAppointment: () => ({
    mutate: (...args: unknown[]) => mutateMock(...args),
    isPending,
  }),
}))

describe("CancelAppointmentDialog", () => {
  beforeEach(() => {
    mutateMock.mockReset()
    isPending = false
  })

  it("pinta el titulo y el nombre del cliente", () => {
    render(
      <CancelAppointmentDialog
        appointmentId="apt_1"
        clientName="Ana Garcia"
        open={true}
        onOpenChange={vi.fn()}
      />
    )

    expect(screen.getByRole("heading", { name: "Cancelar cita" })).toBeInTheDocument()
    expect(screen.getByText(/Ana Garcia/)).toBeInTheDocument()
  })

  it("no pinta nada si open=false", () => {
    render(
      <CancelAppointmentDialog
        appointmentId="apt_1"
        clientName="Ana Garcia"
        open={false}
        onOpenChange={vi.fn()}
      />
    )

    expect(screen.queryByRole("heading", { name: "Cancelar cita" })).not.toBeInTheDocument()
  })

  it("manda reason=undefined y cancelledBy=SALON si el motivo se deja vacio", async () => {
    const user = userEvent.setup()
    render(
      <CancelAppointmentDialog
        appointmentId="apt_1"
        clientName="Ana Garcia"
        open={true}
        onOpenChange={vi.fn()}
      />
    )

    await user.click(screen.getByRole("button", { name: "Cancelar cita" }))

    expect(mutateMock).toHaveBeenCalledWith(
      { id: "apt_1", reason: undefined, cancelledBy: "SALON" },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    )
  })

  it("manda el motivo escrito en el Textarea", async () => {
    const user = userEvent.setup()
    render(
      <CancelAppointmentDialog
        appointmentId="apt_1"
        clientName="Ana Garcia"
        open={true}
        onOpenChange={vi.fn()}
      />
    )

    await user.type(
      screen.getByPlaceholderText("Motivo de cancelacion (opcional)"),
      "No localizable"
    )
    await user.click(screen.getByRole("button", { name: "Cancelar cita" }))

    expect(mutateMock).toHaveBeenCalledWith(
      { id: "apt_1", reason: "No localizable", cancelledBy: "SALON" },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    )
  })

  it("al exito cierra el dialogo y avisa a onCancelled", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onCancelled = vi.fn()
    mutateMock.mockImplementation((_vars, options) => {
      options.onSuccess()
    })

    render(
      <CancelAppointmentDialog
        appointmentId="apt_1"
        clientName="Ana Garcia"
        open={true}
        onOpenChange={onOpenChange}
        onCancelled={onCancelled}
      />
    )

    await user.click(screen.getByRole("button", { name: "Cancelar cita" }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onCancelled).toHaveBeenCalledTimes(1)
  })

  it("'Volver' cierra sin mandar la mutacion", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(
      <CancelAppointmentDialog
        appointmentId="apt_1"
        clientName="Ana Garcia"
        open={true}
        onOpenChange={onOpenChange}
      />
    )

    await user.click(screen.getByRole("button", { name: "Volver" }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mutateMock).not.toHaveBeenCalled()
  })

  // NOTA (re-revision, HALLAZGO 1): este componente ya NO se reinicia a si
  // mismo cuando el padre lo re-renderiza con otro `appointmentId` o con
  // `open=false` -- eso viola las reglas de React (`react-hooks/set-state-in-effect`)
  // y, sobre todo, no cierra el canal real: un `onError` en vuelo seguia
  // pudiendo aterrizar sobre la cita siguiente porque la instancia (y su
  // mutacion) sobrevivia. La invariante "el estado muere con la cita" ahora
  // la sostiene el CONSUMIDOR montando este dialogo con `key={appointment.id}`
  // (ver `appointment-detail-sheet.test.tsx`, que reproduce la secuencia
  // completa con fallo en vuelo + cambio de cita). Verificarla aqui, con un
  // `rerender` que simula "sin key", ya no tiene sentido: es exactamente el
  // escenario que el `key` del consumidor existe para evitar.

  it("REGRESION: si la mutacion falla, el dialogo no se cierra y muestra el error (HALLAZGO 2)", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const problem: ProblemDetail = {
      type: "about:blank",
      title: "Bad Request",
      status: 400,
      detail: "La cita no se puede cancelar en su estado actual.",
      instance: "/appointments/apt_1/cancel",
      timestamp: "2026-08-27T10:00:00Z",
      correlationId: "corr-1",
    }
    mutateMock.mockImplementation((_vars, options) => {
      options.onError(new ApiError(problem))
    })

    render(
      <CancelAppointmentDialog
        appointmentId="apt_1"
        clientName="Ana Garcia"
        open={true}
        onOpenChange={onOpenChange}
      />
    )

    await user.click(screen.getByRole("button", { name: "Cancelar cita" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("La cita no se puede cancelar en su estado actual.")
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("isPending deshabilita el boton de cancelar y pinta el spinner", () => {
    isPending = true
    render(
      <CancelAppointmentDialog
        appointmentId="apt_1"
        clientName="Ana Garcia"
        open={true}
        onOpenChange={vi.fn()}
      />
    )

    const button = screen.getByRole("button", { name: /Cancelar cita/ })
    expect(button).toBeDisabled()
    expect(document.querySelector(".animate-spin")).not.toBeNull()
  })
})
