import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { WizardStepper } from "./wizard-stepper"

describe("WizardStepper", () => {
  it("sin `labels` pinta las cinco etiquetas por defecto de la reserva publica", () => {
    render(<WizardStepper step={1} />)

    expect(screen.getByText("Servicio")).toBeInTheDocument()
    expect(screen.getByText("Profesional")).toBeInTheDocument()
    expect(screen.getByText("Fecha y hora")).toBeInTheDocument()
    expect(screen.getByText("Tus datos")).toBeInTheDocument()
    expect(screen.getByText("Confirmar")).toBeInTheDocument()
  })

  it("con `labels` propio sustituye las etiquetas por defecto", () => {
    const labels = ["Uno", "Dos", "Tres"]
    render(<WizardStepper step={1} labels={labels} />)

    expect(screen.getByText("Uno")).toBeInTheDocument()
    expect(screen.getByText("Dos")).toBeInTheDocument()
    expect(screen.getByText("Tres")).toBeInTheDocument()
    expect(screen.queryByText("Servicio")).not.toBeInTheDocument()
  })

  it("sin `visibleFrom` se oculta hasta `md:` (comportamiento por defecto de la reserva publica)", () => {
    const { container } = render(<WizardStepper step={1} />)

    expect(container.firstElementChild).toHaveClass("md:flex")
    expect(container.firstElementChild).not.toHaveClass("lg:flex")
  })

  it("sin `completedTone` un paso superado usa `text-muted-foreground` (color de la reserva publica)", () => {
    render(<WizardStepper step={2} labels={["Uno", "Dos"]} />)

    const completedLabel = screen.getByText("Uno").closest("div")
    expect(completedLabel).toHaveClass("text-muted-foreground")
    expect(completedLabel).not.toHaveClass("text-text-subtle")
  })

  it("con `completedTone='subtle'` un paso superado usa `text-text-subtle` (#B8A99C, artboards de NuevaCita)", () => {
    render(<WizardStepper step={2} labels={["Uno", "Dos"]} completedTone="subtle" />)

    const completedLabel = screen.getByText("Uno").closest("div")
    expect(completedLabel).toHaveClass("text-text-subtle")
    expect(completedLabel).not.toHaveClass("text-muted-foreground")
  })

  it("usa los tokens de color en vez de hexes literales para el conector y el aro pendiente", () => {
    const { container } = render(<WizardStepper step={2} labels={["Uno", "Dos", "Tres"]} />)

    const connector = container.querySelector(".h-px")
    expect(connector).toHaveClass("bg-border-dashed")
    expect(connector?.className).not.toContain("#D8C9B8")

    const pendingRing = screen.getByText("Tres").closest("div")?.querySelector("span")
    expect(pendingRing).toHaveClass("border-border-dashed")
    expect(pendingRing?.className).not.toContain("#D8C9B8")
  })
})
