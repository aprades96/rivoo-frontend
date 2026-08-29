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

  it("REGRESION: el motivo no sobrevive a cerrar con 'Volver' ni a cambiar de cita (HALLAZGO 1)", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    const { rerender } = render(
      <CancelAppointmentDialog
        appointmentId="apt_ana"
        clientName="Ana Garcia"
        open={true}
        onOpenChange={onOpenChange}
      />
    )

    await user.type(
      screen.getByPlaceholderText("Motivo de cancelacion (opcional)"),
      "el cliente aviso que no viene"
    )
    expect(screen.getByPlaceholderText("Motivo de cancelacion (opcional)")).toHaveValue(
      "el cliente aviso que no viene"
    )

    // "Volver": el padre cierra el dialogo (D9: el componente NO se desmonta,
    // solo cambia `open`).
    await user.click(screen.getByRole("button", { name: "Volver" }))
    rerender(
      <CancelAppointmentDialog
        appointmentId="apt_ana"
        clientName="Ana Garcia"
        open={false}
        onOpenChange={onOpenChange}
      />
    )

    // El panel de detalle cambia de cita SIN desmontar (no lleva `key`,
    // `appointment-detail-panel.tsx:273`).
    rerender(
      <CancelAppointmentDialog
        appointmentId="apt_carla"
        clientName="Carla Ruiz"
        open={false}
        onOpenChange={onOpenChange}
      />
    )

    // Se reabre el dialogo, ahora para Carla.
    rerender(
      <CancelAppointmentDialog
        appointmentId="apt_carla"
        clientName="Carla Ruiz"
        open={true}
        onOpenChange={onOpenChange}
      />
    )

    expect(screen.getByPlaceholderText("Motivo de cancelacion (opcional)")).toHaveValue("")
  })

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
