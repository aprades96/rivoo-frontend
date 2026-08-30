import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { WizardProgress } from "./wizard-progress"

/** Los cinco tramos comparten padre: es el unico nodo que pinta este componente. */
function segments(container: HTMLElement): Element[] {
  return Array.from(container.firstElementChild?.children ?? [])
}

describe("WizardProgress", () => {
  it("pinta cinco tramos por defecto", () => {
    const { container } = render(<WizardProgress step={1} />)
    expect(segments(container)).toHaveLength(5)
  })

  it("colorea en primario los tramos hasta el paso actual INCLUIDO, y el resto en el tono apagado", () => {
    const { container } = render(<WizardProgress step={3} />)
    const bars = segments(container)

    bars.forEach((bar, index) => {
      if (index < 3) {
        expect(bar).toHaveClass("bg-primary")
      } else {
        expect(bar).toHaveClass("bg-border")
      }
    })
  })

  it("en el paso 1 solo el primer tramo va en primario", () => {
    const { container } = render(<WizardProgress step={1} />)
    const bars = segments(container)

    expect(bars[0]).toHaveClass("bg-primary")
    expect(bars[1]).toHaveClass("bg-border")
    expect(bars[4]).toHaveClass("bg-border")
  })

  it("no pinta ningun texto -- a diferencia del progreso de la reserva publica, no lleva contador N / total", () => {
    const { container } = render(<WizardProgress step={2} />)
    expect(container.textContent).toBe("")
  })

  it("respeta un totalSteps distinto de 5", () => {
    const { container } = render(<WizardProgress step={2} totalSteps={3} />)
    expect(segments(container)).toHaveLength(3)
  })
})
