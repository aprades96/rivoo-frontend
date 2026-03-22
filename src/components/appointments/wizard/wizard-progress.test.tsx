import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { WizardProgress } from "./wizard-progress"

describe("WizardProgress", () => {
  it("renders 5 step numbers", () => {
    render(<WizardProgress currentStep={1} />)
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument()
    }
  })

  it("highlights the current step with primary color", () => {
    render(<WizardProgress currentStep={3} />)
    const step3 = screen.getByText("3")
    expect(step3.closest("div")).toHaveClass("bg-primary")
  })

  it("marks completed steps with lighter style", () => {
    render(<WizardProgress currentStep={3} />)
    const step1 = screen.getByText("1")
    expect(step1.closest("div")).toHaveClass("bg-primary/20")
  })

  it("marks future steps with muted style", () => {
    render(<WizardProgress currentStep={2} />)
    const step4 = screen.getByText("4")
    expect(step4.closest("div")).toHaveClass("bg-muted")
  })
})
