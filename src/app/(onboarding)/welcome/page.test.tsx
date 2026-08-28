import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import WelcomePage from "./page"

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}))

const setCurrentStep = vi.fn()

vi.mock("@/lib/stores/onboarding-store", () => ({
  useOnboardingStore: () => ({ setCurrentStep, currentStep: 1, totalSteps: 5, nextStep: vi.fn(), prevStep: vi.fn(), reset: vi.fn() }),
}))

describe("WelcomePage", () => {
  beforeEach(() => {
    push.mockClear()
    setCurrentStep.mockClear()
  })

  it("shows the literal welcome copy and the three-step checklist", () => {
    render(<WelcomePage />)

    expect(screen.getByRole("heading", { name: "Bienvenido a Rivoo" })).toBeInTheDocument()
    expect(
      screen.getByText("Configura tu salon en unos minutos y empieza a gestionar tus citas.")
    ).toBeInTheDocument()
    expect(screen.getByText("Horarios de apertura")).toBeInTheDocument()
    expect(screen.getByText("Tu primer empleado")).toBeInTheDocument()
    expect(screen.getByText("Tu primer servicio")).toBeInTheDocument()
  })

  it("does not render its own 'Cerrar sesion' control anymore (it lives in the layout header)", () => {
    render(<WelcomePage />)

    expect(screen.queryByText(/cerrar sesion/i)).not.toBeInTheDocument()
  })

  it("marks the wizard at step 1 on mount", () => {
    render(<WelcomePage />)

    expect(setCurrentStep).toHaveBeenCalledWith(1)
  })

  it("navigates to /business-hours when 'Comencemos' is clicked", async () => {
    const user = userEvent.setup()
    render(<WelcomePage />)

    await user.click(screen.getByRole("button", { name: /comencemos/i }))

    expect(push).toHaveBeenCalledWith("/business-hours")
  })
})
