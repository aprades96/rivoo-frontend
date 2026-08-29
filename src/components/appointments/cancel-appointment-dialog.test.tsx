import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CancelAppointmentDialog } from "./cancel-appointment-dialog"

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
