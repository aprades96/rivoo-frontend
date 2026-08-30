import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AppointmentActions } from "./appointment-actions"
import type { AppointmentStatus } from "@/types/appointment"

/** Icono lucide renderiza `stroke-width` como atributo SVG en minusculas y con guion. */
function strokeWidthOf(button: HTMLElement): string | null {
  return button.querySelector("svg")?.getAttribute("stroke-width") ?? null
}

const TERMINAL_STATUSES: AppointmentStatus[] = ["COMPLETED", "CANCELLED", "NO_SHOW"]
const VARIANTS = ["sheet", "panel"] as const

function renderActions(
  status: AppointmentStatus,
  variant: "sheet" | "panel",
  overrides: Partial<{
    onStatusChange: (status: AppointmentStatus) => void
    onCancelRequest: () => void
    onReschedule: () => void
    isPending: boolean
  }> = {}
) {
  const onStatusChange = overrides.onStatusChange ?? vi.fn()
  const onCancelRequest = overrides.onCancelRequest ?? vi.fn()
  const onReschedule = overrides.onReschedule ?? vi.fn()
  const isPending = overrides.isPending ?? false

  const utils = render(
    <AppointmentActions
      status={status}
      variant={variant}
      onStatusChange={onStatusChange}
      onCancelRequest={onCancelRequest}
      onReschedule={onReschedule}
      isPending={isPending}
    />
  )

  return { ...utils, onStatusChange, onCancelRequest, onReschedule }
}

describe("AppointmentActions", () => {
  describe.each(TERMINAL_STATUSES)("estado terminal %s", (status) => {
    it.each(VARIANTS)("no pinta nada en variant=%s", (variant) => {
      const { container } = renderActions(status, variant)
      expect(container).toBeEmptyDOMElement()
    })
  })

  describe("PENDING", () => {
    it("variant=sheet: CTA Confirmar cita + secundarias No asistió y Cancelar, medidas de movil", () => {
      renderActions("PENDING", "sheet")

      const cta = screen.getByTestId("appointment-cta")
      expect(cta).toHaveTextContent("Confirmar cita")
      expect(cta.className).toContain("h-12")

      const secondaryRow = screen.getByTestId("appointment-actions-secondary")
      expect(secondaryRow.className).toContain("flex")
      expect(secondaryRow.className).not.toContain("grid")

      const secondaryButtons = within(secondaryRow).getAllByTestId("appointment-secondary-action")
      expect(secondaryButtons).toHaveLength(2)
      expect(secondaryButtons[0]).toHaveTextContent("No asistió")
      expect(secondaryButtons[1]).toHaveTextContent("Cancelar")
      for (const button of secondaryButtons) {
        expect(button.className).toContain("h-[46px]")
        expect(button.className).toContain("flex-1")
      }
      expect(secondaryButtons[1].className).toContain("text-destructive")
    })

    it("variant=panel: CTA Confirmar cita + secundarias Reprogramar y Cancelar, medidas de escritorio", () => {
      renderActions("PENDING", "panel")

      const cta = screen.getByTestId("appointment-cta")
      expect(cta).toHaveTextContent("Confirmar cita")
      expect(cta.className).toContain("h-[46px]")

      const secondaryRow = screen.getByTestId("appointment-actions-secondary")
      expect(secondaryRow.className).toContain("grid-cols-2")

      const secondaryButtons = within(secondaryRow).getAllByTestId("appointment-secondary-action")
      expect(secondaryButtons).toHaveLength(2)
      expect(secondaryButtons[0]).toHaveTextContent("Reprogramar")
      expect(secondaryButtons[1]).toHaveTextContent("Cancelar")
      for (const button of secondaryButtons) {
        expect(button.className).toContain("h-10")
      }
      expect(secondaryButtons[1].className).toContain("text-destructive")
    })

    it("dispara onStatusChange(CONFIRMED) al pulsar el CTA", async () => {
      const user = userEvent.setup()
      const { onStatusChange } = renderActions("PENDING", "sheet")
      await user.click(screen.getByTestId("appointment-cta"))
      expect(onStatusChange).toHaveBeenCalledWith("CONFIRMED")
    })

    it("sheet: 'No asistió' dispara onStatusChange(NO_SHOW) -- la transicion que T0 abre", async () => {
      const user = userEvent.setup()
      const { onStatusChange } = renderActions("PENDING", "sheet")
      await user.click(screen.getByText("No asistió"))
      expect(onStatusChange).toHaveBeenCalledWith("NO_SHOW")
    })

    it("panel: 'Reprogramar' dispara onReschedule, no onStatusChange", async () => {
      const user = userEvent.setup()
      const { onReschedule, onStatusChange } = renderActions("PENDING", "panel")
      await user.click(screen.getByText("Reprogramar"))
      expect(onReschedule).toHaveBeenCalledTimes(1)
      expect(onStatusChange).not.toHaveBeenCalled()
    })

    it("'Cancelar' dispara onCancelRequest, no una mutacion directa", async () => {
      const user = userEvent.setup()
      const { onCancelRequest, onStatusChange } = renderActions("PENDING", "panel")
      await user.click(screen.getByText("Cancelar"))
      expect(onCancelRequest).toHaveBeenCalledTimes(1)
      expect(onStatusChange).not.toHaveBeenCalled()
    })
  })

  describe("CONFIRMED", () => {
    it.each(VARIANTS)("variant=%s: CTA Iniciar + secundarias No asistió y Cancelar", (variant) => {
      renderActions("CONFIRMED", variant)

      expect(screen.getByTestId("appointment-cta")).toHaveTextContent("Iniciar")

      const secondaryButtons = screen.getAllByTestId("appointment-secondary-action")
      expect(secondaryButtons).toHaveLength(2)
      expect(secondaryButtons[0]).toHaveTextContent("No asistió")
      expect(secondaryButtons[1]).toHaveTextContent("Cancelar")
    })

    it("dispara onStatusChange(IN_PROGRESS) al pulsar el CTA", async () => {
      const user = userEvent.setup()
      const { onStatusChange } = renderActions("CONFIRMED", "sheet")
      await user.click(screen.getByTestId("appointment-cta"))
      expect(onStatusChange).toHaveBeenCalledWith("IN_PROGRESS")
    })

    it.each(VARIANTS)(
      "variant=%s: los iconos secundarios llevan stroke-width 1.75 (DetalleCita.dc.html:104,108 / DetalleCitaDesktop.dc.html:321,325)",
      (variant) => {
        renderActions("CONFIRMED", variant)

        const secondaryButtons = screen.getAllByTestId("appointment-secondary-action")
        for (const button of secondaryButtons) {
          expect(strokeWidthOf(button)).toBe("1.75")
        }
      }
    )
  })

  describe("IN_PROGRESS", () => {
    /**
     * El dominio solo permite `IN_PROGRESS -> COMPLETED`
     * (`appointment-service/.../domain/model/AppointmentStatus.java:25`).
     * Ningun artboard dibuja este estado, asi que aqui manda el servidor:
     * no se ofrece "Cancelar" en ninguna variante (antes producia un 4xx
     * silencioso).
     */
    it.each(VARIANTS)("variant=%s: CTA Completar, sin ninguna accion secundaria", (variant) => {
      renderActions("IN_PROGRESS", variant)

      expect(screen.getByTestId("appointment-cta")).toHaveTextContent("Completar")
      expect(screen.queryByText("Cancelar")).not.toBeInTheDocument()
      expect(screen.queryByTestId("appointment-secondary-action")).not.toBeInTheDocument()
      expect(screen.queryByTestId("appointment-actions-secondary")).not.toBeInTheDocument()
    })

    it("dispara onStatusChange(COMPLETED) al pulsar el CTA", async () => {
      const user = userEvent.setup()
      const { onStatusChange } = renderActions("IN_PROGRESS", "panel")
      await user.click(screen.getByTestId("appointment-cta"))
      expect(onStatusChange).toHaveBeenCalledWith("COMPLETED")
    })
  })

  describe("isPending", () => {
    it("deshabilita el CTA y las secundarias, y pinta el spinner", () => {
      renderActions("PENDING", "sheet", { isPending: true })

      const cta = screen.getByTestId("appointment-cta")
      expect(cta).toBeDisabled()

      const secondaryButtons = screen.getAllByTestId("appointment-secondary-action")
      for (const button of secondaryButtons) {
        expect(button).toBeDisabled()
      }

      const spinners = document.querySelectorAll(".animate-spin")
      expect(spinners.length).toBeGreaterThan(0)
    })

    /**
     * El spinner es GLOBAL (todos los botones a la vez), no "solo en el
     * boton pulsado": `useUpdateAppointmentStatus` es OPTIMISTA
     * (`src/hooks/use-appointments.ts:93-114`), la cache cambia de estado
     * antes de que conteste la peticion, y `actionsFor` puede devolver otros
     * rotulos a mitad de vuelo (p.ej. CONFIRMED -> "Iniciar" tras pulsar
     * "Confirmar cita" en PENDING). No hay ningun boton estable sobre el que
     * "recordar" cual se pulso, asi que todos deben mostrar el spinner y
     * quedar deshabilitados mientras `isPending` sea true, sin importar cual
     * se pulso.
     */
    it("con isPending=true, TODOS los botones (CTA y secundarias) muestran el spinner y quedan deshabilitados", () => {
      renderActions("CONFIRMED", "sheet", { isPending: true })

      const ctaButton = screen.getByTestId("appointment-cta")
      const secondaryButtons = screen.getAllByTestId("appointment-secondary-action")

      expect(ctaButton.querySelector(".animate-spin")).not.toBeNull()
      expect(ctaButton).toBeDisabled()

      for (const button of secondaryButtons) {
        expect(button.querySelector(".animate-spin")).not.toBeNull()
        expect(button).toBeDisabled()
      }
    })
  })
})
