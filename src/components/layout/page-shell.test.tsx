import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { PageShell } from "./page-shell"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn() }),
}))

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

describe("PageShell", () => {
  afterEach(() => {
    mockMatchMedia(false)
  })

  it("pinta el mismo titulo en movil y en escritorio", () => {
    mockMatchMedia(false)
    const { rerender } = render(
      <PageShell title="Equipo">
        <p>contenido</p>
      </PageShell>
    )
    expect(screen.getByText("Equipo")).toBeInTheDocument()

    mockMatchMedia(true)
    rerender(
      <PageShell title="Equipo">
        <p>contenido</p>
      </PageShell>
    )
    expect(screen.getByText("Equipo")).toBeInTheDocument()
  })

  it("con `back` y sin `desktopBack` hay control de volver en movil pero no en escritorio", () => {
    mockMatchMedia(false)
    const { rerender } = render(
      <PageShell title="Ajustes de reserva" back>
        <p>contenido</p>
      </PageShell>
    )
    expect(screen.getByRole("button", { name: /volver/i })).toBeInTheDocument()

    mockMatchMedia(true)
    rerender(
      <PageShell title="Ajustes de reserva" back>
        <p>contenido</p>
      </PageShell>
    )
    expect(screen.queryByRole("button", { name: /volver/i })).not.toBeInTheDocument()
  })

  it("con `desktopBack` hay control de volver en escritorio aunque no haya `back`", () => {
    mockMatchMedia(true)
    render(
      <PageShell title="Detalle empleado" desktopBack="bordered">
        <p>contenido</p>
      </PageShell>
    )
    expect(screen.getByRole("button", { name: /volver/i })).toBeInTheDocument()
  })

  it("el control de volver lleva aria-label Volver en movil", () => {
    mockMatchMedia(false)
    render(
      <PageShell title="Detalle empleado" back>
        <p>contenido</p>
      </PageShell>
    )
    expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument()
  })

  it("el control de volver lleva aria-label Volver en escritorio", () => {
    mockMatchMedia(true)
    render(
      <PageShell title="Detalle empleado" desktopBack="plain">
        <p>contenido</p>
      </PageShell>
    )
    expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument()
  })

  it("`mobileActions={null}` deja la cabecera movil sin acciones aunque `actions` tenga contenido", () => {
    mockMatchMedia(false)
    render(
      <PageShell title="Staff" actions={<button>Anadir empleado</button>} mobileActions={null}>
        <p>contenido</p>
      </PageShell>
    )
    expect(screen.queryByRole("button", { name: "Anadir empleado" })).not.toBeInTheDocument()
  })

  it("sin `mobileActions`, `actions` se pinta tambien en movil", () => {
    mockMatchMedia(false)
    render(
      <PageShell title="Staff" actions={<button>Anadir empleado</button>}>
        <p>contenido</p>
      </PageShell>
    )
    expect(screen.getByRole("button", { name: "Anadir empleado" })).toBeInTheDocument()
  })

  it("`mobileActions` sustituye a `actions` por debajo de 1024, no se suma", () => {
    mockMatchMedia(false)
    render(
      <PageShell
        title="Staff"
        actions={<button>Anadir empleado</button>}
        mobileActions={<button>Accion movil</button>}
      >
        <p>contenido</p>
      </PageShell>
    )
    expect(screen.queryByRole("button", { name: "Anadir empleado" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Accion movil" })).toBeInTheDocument()
  })

  it("en escritorio siempre se pinta `actions`, `mobileActions` no lo afecta", () => {
    mockMatchMedia(true)
    render(
      <PageShell
        title="Staff"
        actions={<button>Anadir empleado</button>}
        mobileActions={null}
      >
        <p>contenido</p>
      </PageShell>
    )
    expect(screen.getByRole("button", { name: "Anadir empleado" })).toBeInTheDocument()
  })

  it("`titleAdjacent` se monta junto al titulo y `subtitle` en columna debajo", () => {
    mockMatchMedia(true)
    render(
      <PageShell
        title="Ana Garcia"
        titleAdjacent={<span>Cliente desde 12/03/2023</span>}
        subtitle={<span>Ultima visita hace 3 dias</span>}
      >
        <p>contenido</p>
      </PageShell>
    )
    expect(screen.getByText("Cliente desde 12/03/2023")).toBeInTheDocument()
    expect(screen.getByText("Ultima visita hace 3 dias")).toBeInTheDocument()
  })

  it("el arbol no se duplica: hay un unico contenedor de contenido por breakpoint", () => {
    mockMatchMedia(false)
    const { container, rerender } = render(
      <PageShell title="Equipo">
        <p>contenido</p>
      </PageShell>
    )
    expect(container.querySelectorAll('[data-slot="page-shell-content"]')).toHaveLength(1)

    mockMatchMedia(true)
    rerender(
      <PageShell title="Equipo">
        <p>contenido</p>
      </PageShell>
    )
    expect(container.querySelectorAll('[data-slot="page-shell-content"]')).toHaveLength(1)
  })
})
