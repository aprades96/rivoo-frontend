import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ResponsiveFormModal } from "./responsive-form-modal"

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

function renderModal(onOpenChange: (open: boolean) => void) {
  return render(
    <ResponsiveFormModal
      open
      onOpenChange={onOpenChange}
      title="Nuevo empleado"
      footer={<button type="button">Crear empleado</button>}
      closeButtonVariant="plain"
    >
      <p>form fields</p>
    </ResponsiveFormModal>
  )
}

describe("ResponsiveFormModal", () => {
  afterEach(() => {
    mockMatchMedia(false)
  })

  it("mounts a Sheet with its grabber on mobile (matchMedia false)", () => {
    mockMatchMedia(false)

    renderModal(vi.fn())

    expect(screen.getByTestId("responsive-form-modal-grabber")).toBeInTheDocument()
  })

  it("mounts a centered Dialog with no grabber on desktop (matchMedia true)", () => {
    mockMatchMedia(true)

    renderModal(vi.fn())

    expect(screen.queryByTestId("responsive-form-modal-grabber")).not.toBeInTheDocument()
    expect(screen.getByTestId("responsive-form-modal-dialog")).toBeInTheDocument()
  })

  it("propagates onOpenChange(false) from the close button on mobile", async () => {
    mockMatchMedia(false)
    const onOpenChange = vi.fn()
    const user = userEvent.setup()

    renderModal(onOpenChange)

    await user.click(screen.getByRole("button", { name: "Cerrar" }))

    expect(onOpenChange.mock.calls[0][0]).toBe(false)
  })

  it("propagates onOpenChange(false) from the close button on desktop", async () => {
    mockMatchMedia(true)
    const onOpenChange = vi.fn()
    const user = userEvent.setup()

    renderModal(onOpenChange)

    await user.click(screen.getByRole("button", { name: "Cerrar" }))

    expect(onOpenChange.mock.calls[0][0]).toBe(false)
  })

  it("announces the title as the dialog's accessible name on mobile", () => {
    mockMatchMedia(false)

    renderModal(vi.fn())

    expect(screen.getByRole("dialog", { name: "Nuevo empleado" })).toBeInTheDocument()
  })

  it("announces the title as the dialog's accessible name on desktop", () => {
    mockMatchMedia(true)

    renderModal(vi.fn())

    expect(screen.getByRole("dialog", { name: "Nuevo empleado" })).toBeInTheDocument()
  })
})
