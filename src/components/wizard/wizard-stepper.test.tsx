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
})
