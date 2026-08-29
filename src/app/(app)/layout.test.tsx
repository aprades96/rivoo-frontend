import { describe, it, expect, vi, afterEach } from "vitest"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState, type ReactNode } from "react"
import AppLayout from "./layout"

const usePathnameMock = vi.fn()
const routerPushMock = vi.fn()

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({ push: routerPushMock }),
}))

vi.mock("@/components/layout/onboarding-gate", () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => (
    <div data-testid="onboarding-gate">{children}</div>
  ),
}))

vi.mock("@/components/layout/app-sidebar", () => ({
  AppSidebar: () => <nav data-testid="app-sidebar" />,
}))

vi.mock("@/components/layout/bottom-nav", () => ({
  BottomNav: () => <nav data-testid="bottom-nav" />,
}))

vi.mock("@/components/layout/fab-button", () => ({
  FabButton: () => <button data-testid="fab-button">Nueva cita</button>,
}))

/**
 * `matches: desktop` para simular `(min-width: 1024px)`; jsdom no tiene
 * layout real. El polyfill global de `src/test/setup.ts:23-34` siempre
 * devuelve `matches: false`, asi que cada prueba de escritorio lo
 * sobrescribe aqui -- patron de `booking-step-shell.test.tsx:24` y
 * `public-employee-step.test.tsx:71`.
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

/**
 * Variante de `mockMatchMedia` que ademas puede disparar el evento `change`
 * -- necesaria para el test de remount: `useMediaQuery` solo vuelve a
 * renderizar cuando `subscribe` invoca `onChange` (via
 * `addEventListener("change", ...)`), no por el mero hecho de que
 * `matchMedia` devuelva un valor distinto.
 */
function mockToggleableMatchMedia(initialDesktop: boolean) {
  let matches = initialDesktop
  const listeners = new Set<() => void>()
  window.matchMedia = ((query: string) => ({
    get matches() {
      return matches
    },
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_event: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_event: string, cb: () => void) => listeners.delete(cb),
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia

  return {
    setDesktop(next: boolean) {
      matches = next
      listeners.forEach((cb) => cb())
    },
  }
}

function StatefulProbe() {
  const [value, setValue] = useState("")
  return (
    <input
      aria-label="probe"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  )
}

function renderLayout(pathname: string) {
  usePathnameMock.mockReturnValue(pathname)
  return render(
    <AppLayout>
      <p>contenido</p>
    </AppLayout>
  )
}

describe("AppLayout", () => {
  afterEach(() => {
    mockMatchMedia(false)
  })

  it("por debajo de 1024px monta la barra inferior, no la barra lateral, y ya no monta AppHeader", () => {
    mockMatchMedia(false)
    renderLayout("/staff")

    expect(screen.getByTestId("bottom-nav")).toBeInTheDocument()
    expect(screen.queryByTestId("app-sidebar")).not.toBeInTheDocument()
    // AppHeader era un <header> (rol implicito "banner"); su ausencia
    // confirma que el layout ya no lo monta.
    expect(screen.queryByRole("banner")).not.toBeInTheDocument()
  })

  it("a partir de 1024px monta la barra lateral, no la barra inferior -- montaje excluyente", () => {
    mockMatchMedia(true)
    renderLayout("/staff")

    expect(screen.getByTestId("app-sidebar")).toBeInTheDocument()
    expect(screen.queryByTestId("bottom-nav")).not.toBeInTheDocument()
  })

  it("OnboardingGate sigue envolviendo el chasis en movil", () => {
    mockMatchMedia(false)
    renderLayout("/staff")

    expect(screen.getByTestId("onboarding-gate")).toContainElement(
      screen.getByTestId("bottom-nav")
    )
  })

  it("OnboardingGate sigue envolviendo el chasis en escritorio", () => {
    mockMatchMedia(true)
    renderLayout("/staff")

    expect(screen.getByTestId("onboarding-gate")).toContainElement(
      screen.getByTestId("app-sidebar")
    )
  })

  it.each(["/today", "/calendar"])(
    "pinta el boton flotante en %s en movil",
    (route) => {
      mockMatchMedia(false)
      renderLayout(route)

      expect(screen.getByTestId("fab-button")).toBeInTheDocument()
    }
  )

  it.each(["/today", "/calendar"])(
    "NO pinta el boton flotante en %s en escritorio -- ningun artboard de escritorio lo dibuja",
    (route) => {
      mockMatchMedia(true)
      renderLayout(route)

      expect(screen.queryByTestId("fab-button")).not.toBeInTheDocument()
    }
  )

  it("no pinta el boton flotante fuera de /today y /calendar, en ningun ancho", () => {
    mockMatchMedia(false)
    renderLayout("/staff")
    expect(screen.queryByTestId("fab-button")).not.toBeInTheDocument()

    mockMatchMedia(true)
    renderLayout("/staff")
    expect(screen.queryByTestId("fab-button")).not.toBeInTheDocument()
  })

  it("cruzar 1024px no remonta children -- conserva el estado de un formulario abierto", async () => {
    const mm = mockToggleableMatchMedia(false)
    usePathnameMock.mockReturnValue("/staff")
    const user = userEvent.setup()

    render(
      <AppLayout>
        <StatefulProbe />
      </AppLayout>
    )

    const input = screen.getByLabelText("probe")
    await user.type(input, "hola")
    expect(input).toHaveValue("hola")

    act(() => mm.setDesktop(true))

    // Si `children` se hubiera remontado, el input seria uno nuevo (vacio).
    expect(screen.getByLabelText("probe")).toHaveValue("hola")
    expect(screen.getByTestId("app-sidebar")).toBeInTheDocument()
  })
})
