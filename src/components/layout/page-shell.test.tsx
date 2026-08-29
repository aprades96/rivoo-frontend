import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { PageShell } from "./page-shell"

const { routerBackMock } = vi.hoisted(() => ({ routerBackMock: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: routerBackMock }),
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
    routerBackMock.mockClear()
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

  it("`back={true}` en movil llama a router.back() al pulsar la flecha", async () => {
    mockMatchMedia(false)
    const user = userEvent.setup()
    render(
      <PageShell title="Ajustes de reserva" back>
        <p>contenido</p>
      </PageShell>
    )

    await user.click(screen.getByRole("button", { name: /volver/i }))

    expect(routerBackMock).toHaveBeenCalledTimes(1)
  })

  it("`back` con funcion en movil llama al callback y NO a router.back()", async () => {
    mockMatchMedia(false)
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(
      <PageShell title="Detalle empleado" back={onBack}>
        <p>contenido</p>
      </PageShell>
    )

    await user.click(screen.getByRole("button", { name: /volver/i }))

    expect(onBack).toHaveBeenCalledTimes(1)
    expect(routerBackMock).not.toHaveBeenCalled()
  })

  it("`desktopBack=\"bordered\"` (a secas) llama a router.back() al pulsar la flecha", async () => {
    mockMatchMedia(true)
    const user = userEvent.setup()
    render(
      <PageShell title="Detalle empleado" desktopBack="bordered">
        <p>contenido</p>
      </PageShell>
    )

    await user.click(screen.getByRole("button", { name: /volver/i }))

    expect(routerBackMock).toHaveBeenCalledTimes(1)
  })

  it("`desktopBack` con `{ variant, onBack }` llama al callback y NO a router.back()", async () => {
    mockMatchMedia(true)
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(
      <PageShell title="Staff" desktopBack={{ variant: "plain", onBack }}>
        <p>contenido</p>
      </PageShell>
    )

    await user.click(screen.getByRole("button", { name: /volver/i }))

    expect(onBack).toHaveBeenCalledTimes(1)
    expect(routerBackMock).not.toHaveBeenCalled()
  })

  it("en escritorio sin `contentClassName` el contenido lleva el gap por defecto de 18px", () => {
    mockMatchMedia(true)
    const { container } = render(
      <PageShell title="Equipo">
        <p>contenido</p>
      </PageShell>
    )

    const content = container.querySelector('[data-slot="page-shell-content"]')
    expect(content).toHaveClass("gap-[18px]")
  })

  it("`contentClassName` SUSTITUYE el gap por defecto en escritorio, no se le suma", () => {
    mockMatchMedia(true)
    const { container } = render(
      <PageShell title="Ajustes" contentClassName="space-y-4">
        <p>contenido</p>
      </PageShell>
    )

    const content = container.querySelector('[data-slot="page-shell-content"]')
    expect(content).toHaveClass("space-y-4")
    expect(content).not.toHaveClass("gap-[18px]")
  })

  it("la cabecera movil es sticky con fondo opaco", () => {
    mockMatchMedia(false)
    render(
      <PageShell title="Ajustes de reserva">
        <p>contenido</p>
      </PageShell>
    )

    const header = screen.getByText("Ajustes de reserva").closest('[class*="sticky"]')
    expect(header).toHaveClass("sticky")
    expect(header).toHaveClass("top-0")
    expect(header).toHaveClass("bg-background")
  })

  it("en movil el contenido (no la cabecera) es quien lleva `max-w-3xl`, para que la cabecera pueda ocupar el ancho completo de `<main>`", () => {
    mockMatchMedia(false)
    const { container } = render(
      <PageShell title="Ajustes de reserva">
        <p>contenido</p>
      </PageShell>
    )

    const header = screen.getByText("Ajustes de reserva").closest('[class*="sticky"]')
    expect(header).not.toHaveClass("max-w-3xl")

    const contentWrapper = container.querySelector(
      '[data-slot="page-shell-content"]'
    )?.parentElement
    expect(contentWrapper).toHaveClass("max-w-3xl")
  })

  it("en movil `contentClassName` no cuela su ancho de escritorio (regresion: dejaba el contenido pegado a la izquierda de los 736px de `max-w-3xl`, con hueco muerto a la derecha)", () => {
    mockMatchMedia(false)
    const { container } = render(
      <PageShell title="Facturacion y plan" contentClassName="max-w-[554px] space-y-4">
        <p>contenido</p>
      </PageShell>
    )

    const content = container.querySelector('[data-slot="page-shell-content"]')
    expect(content).not.toHaveClass("max-w-[554px]")
    expect(content).toHaveClass("space-y-4")

    const contentWrapper = content?.parentElement
    expect(contentWrapper).toHaveClass("max-w-3xl")
  })
})
