import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import FullscreenLayout from "./layout"

vi.mock("@/components/layout/onboarding-gate", () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => (
    <div data-testid="onboarding-gate">{children}</div>
  ),
}))

/**
 * `matches: desktop` para simular `(min-width: 1024px)`; jsdom no tiene
 * layout real. El polyfill global de `src/test/setup.ts` SIEMPRE devuelve
 * `matches: false`, asi que la prueba de escritorio necesita el suyo local.
 * Patron de `src/components/booking/booking-step-shell.test.tsx:24` y
 * `src/components/booking/public-datetime-step.test.tsx:19`.
 */
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

describe("FullscreenLayout", () => {
  afterEach(() => {
    mockMatchMedia(false)
  })

  it("monta OnboardingGate", () => {
    mockMatchMedia(true)
    render(
      <FullscreenLayout>
        <p>contenido</p>
      </FullscreenLayout>
    )

    expect(screen.getByTestId("onboarding-gate")).toBeInTheDocument()
  })

  /**
   * REGRESION, no comportamiento: este layout no depende del ancho -- se le
   * ha quitado todo lo que dependia de `useMediaQuery` (sidebar/bottom nav).
   * Con `mockMatchMedia(true)` (escritorio) ninguna de las dos aserciones de
   * abajo puede fallar por construccion; su valor es detectar el dia que
   * alguien remonte aqui el chasis de `(app)` (`AppSidebar`/`BottomNav`).
   */
  it("no monta barra lateral ni barra inferior, ni siquiera en escritorio", () => {
    mockMatchMedia(true)
    render(
      <FullscreenLayout>
        <p>contenido</p>
      </FullscreenLayout>
    )

    expect(screen.queryByTestId("app-sidebar")).not.toBeInTheDocument()
    expect(screen.queryByTestId("bottom-nav")).not.toBeInTheDocument()
  })
})
