import type { ComponentProps } from "react"
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

function renderModal(
  onOpenChange: (open: boolean) => void,
  overrides: Partial<ComponentProps<typeof ResponsiveFormModal>> = {}
) {
  return render(
    <ResponsiveFormModal
      open
      onOpenChange={onOpenChange}
      title="Nuevo empleado"
      footer={<button type="button">Crear empleado</button>}
      closeButtonVariant="plain"
      {...overrides}
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

  // D17/T3: SCRIM_CLASS unifies the twelve artboards' overlay to
  // `bg-foreground/42` (`rgba(42,35,32,0.42)`) -- the one discrepant artboard
  // (`FormularioEmpleadoDesktop.dc.html:297` gives 0.34) is exactly the value
  // someone "corrects toward" when reverting against raw data. Neither branch
  // had a single assertion on it. Same pattern as
  // `appointment-detail-sheet.test.tsx`.
  describe("D17/T3: unified scrim (bg-foreground/42)", () => {
    it("applies the scrim to the mobile sheet's overlay via overlayClassName", () => {
      mockMatchMedia(false)

      const { baseElement } = renderModal(vi.fn())

      const overlay = baseElement.querySelector('[data-slot="sheet-overlay"]')
      expect(overlay).toHaveClass("bg-foreground/42")
    })

    it("applies the scrim to the desktop dialog's overlay via className", () => {
      mockMatchMedia(true)

      const { baseElement } = renderModal(vi.fn())

      const overlay = baseElement.querySelector('[data-slot="dialog-overlay"]')
      expect(overlay).toHaveClass("bg-foreground/42")
    })
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

  // M12: el contenedor unificaba gap y sombra que los cuatro artboards NO
  // unifican; ahora vienen del consumidor via `dialogClassName`/`sheetClassName`.
  describe("consumer-supplied gap and shadow overrides (M12)", () => {
    it("merges sheetClassName into the mobile sheet, without the shared border-t (mobile branch)", () => {
      mockMatchMedia(false)

      renderModal(vi.fn(), { sheetClassName: "gap-3" })

      const dialog = screen.getByRole("dialog", { name: "Nuevo empleado" })
      expect(dialog.className).toContain("gap-3")
      // tailwind-merge collapses the conflicting `data-[side=bottom]:border-t`
      // from `ui/sheet.tsx` into this override -- only the `-0` variant
      // should remain in the final class list.
      expect(dialog.className).toContain("data-[side=bottom]:border-t-0")
      expect(dialog.className).not.toMatch(/(?:^|\s)data-\[side=bottom\]:border-t(?!-0)/)
    })

    it("keeps the default gap-4 on the mobile sheet when no override is supplied (mobile branch)", () => {
      mockMatchMedia(false)

      renderModal(vi.fn())

      const dialog = screen.getByRole("dialog", { name: "Nuevo empleado" })
      expect(dialog.className).toContain("gap-4")
    })

    it("merges dialogClassName into the desktop dialog container (desktop branch)", () => {
      mockMatchMedia(true)

      renderModal(vi.fn(), {
        dialogClassName: "gap-3.5 shadow-[0_24px_60px_rgba(42,35,32,0.26)]",
      })

      const dialog = screen.getByTestId("responsive-form-modal-dialog")
      expect(dialog.className).toContain("gap-3.5")
      expect(dialog.className).toContain("shadow-[0_24px_60px_rgba(42,35,32,0.26)]")
    })

    it("has no shadow on the desktop dialog when no override is supplied (desktop branch)", () => {
      mockMatchMedia(true)

      renderModal(vi.fn())

      const dialog = screen.getByTestId("responsive-form-modal-dialog")
      expect(dialog.className).not.toMatch(/shadow-/)
    })
  })
})
