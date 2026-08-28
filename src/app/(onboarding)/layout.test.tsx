import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import OnboardingLayout from "./layout"

vi.mock("next/navigation", () => ({
  usePathname: () => "/welcome",
}))

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ logout: vi.fn() }),
}))

vi.mock("@/lib/stores/onboarding-store", async () => {
  const actual = await vi.importActual<typeof import("@/lib/stores/onboarding-store")>(
    "@/lib/stores/onboarding-store"
  )
  return {
    ...actual,
    useOnboardingStore: () => ({ currentStep: 1, totalSteps: 5 }),
  }
})

describe("OnboardingLayout", () => {
  /**
   * Regresion: el chasis pintaba `min-h-full` en el contenedor movil, un
   * porcentaje que no resuelve porque `body` (`src/app/layout.tsx`) solo fija
   * `min-height`, nunca `height`. Sin una altura real que ocupar, el
   * `flex-1` de la tarjeta no tenia hueco libre y el `margin-top:auto` del
   * pie (`onboarding-footer.tsx`) no empujaba nada: en los pasos con poco
   * contenido (1 y 5) el boton quedaba pegado justo debajo del texto, con
   * medio movil vacio por debajo.
   *
   * `min-h-dvh` es una unidad de viewport: resuelve siempre, sin depender de
   * que un ancestro tenga `height` explicita. En escritorio se mantiene
   * `md:min-h-full` (el valor original, inerte) para no tocar un layout que
   * ya coincide con el artboard.
   */
  it("gives the mobile container a real full-viewport height so the footer's margin-top:auto has room to push", () => {
    render(
      <OnboardingLayout>
        <div>contenido</div>
      </OnboardingLayout>
    )

    // Es el chasis raiz del asistente: no tiene rol ni texto propio que lo
    // identifique, asi que se localiza subiendo desde el contenido.
    const shell = screen.getByText("contenido").closest("div.flex.min-h-dvh")
    expect(shell).not.toBeNull()
    expect(shell).toHaveClass("min-h-dvh")
    expect(shell).toHaveClass("md:min-h-full")
    expect(shell).not.toHaveClass("min-h-full")
  })
})
