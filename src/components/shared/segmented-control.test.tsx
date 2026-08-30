import { describe, it, expect, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { SegmentedControl } from "./segmented-control"

type Range = "dia" | "semana"

const OPTIONS: { value: Range; label: string }[] = [
  { value: "dia", label: "Dia" },
  { value: "semana", label: "Semana" },
]

/**
 * El polyfill de `src/test/setup.ts` devuelve SIEMPRE `matches: false`, o sea
 * movil. Escritorio hay que simularlo aqui, y devolverlo a movil en
 * `afterEach` para no contaminar al siguiente caso (AGENTS.md:29-42).
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

afterEach(() => {
  mockMatchMedia(false)
})

describe("SegmentedControl · variant='square' (por defecto, sin cambios)", () => {
  it("no monta ningun panel: solo role='tablist' con role='tab', nunca role='tabpanel'", () => {
    render(<SegmentedControl options={OPTIONS} value="dia" onChange={() => {}} />)
    expect(screen.getByRole("tablist")).toBeInTheDocument()
    expect(screen.getAllByRole("tab")).toHaveLength(2)
    expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument()
  })

  it("marca la opcion activa con aria-selected y llama a onChange con la otra", () => {
    const options: string[] = []
    render(
      <SegmentedControl options={OPTIONS} value="dia" onChange={(v) => options.push(v)} />
    )
    expect(screen.getByRole("tab", { name: "Dia" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "Semana" })).toHaveAttribute("aria-selected", "false")

    screen.getByRole("tab", { name: "Semana" }).click()
    expect(options).toEqual(["semana"])
  })

  it("pinta el tamano y peso uniformes del control original (14px/500 sin distincion)", () => {
    render(<SegmentedControl options={OPTIONS} value="dia" onChange={() => {}} />)
    const active = screen.getByRole("tab", { name: "Dia" })
    const inactive = screen.getByRole("tab", { name: "Semana" })
    expect(active).toHaveClass("text-sm", "font-medium", "px-4")
    expect(inactive).toHaveClass("text-sm", "font-medium", "px-4")
    expect(active).not.toHaveClass("text-[13px]")
  })

  it("el carril usa --muted, no --segmented-track", () => {
    render(<SegmentedControl options={OPTIONS} value="dia" onChange={() => {}} />)
    expect(screen.getByRole("tablist")).toHaveClass("bg-muted")
    expect(screen.getByRole("tablist")).not.toHaveClass("bg-segmented-track")
  })
})

describe("SegmentedControl · variant='pill' (D7, Equipo)", () => {
  it("el carril usa --segmented-track", () => {
    render(
      <SegmentedControl options={OPTIONS} value="dia" onChange={() => {}} variant="pill" />
    )
    expect(screen.getByRole("tablist")).toHaveClass("bg-segmented-track")
  })

  it("opcion activa 13px/600, inactiva 13px/500 en --muted-foreground", () => {
    render(
      <SegmentedControl options={OPTIONS} value="dia" onChange={() => {}} variant="pill" />
    )
    const active = screen.getByRole("tab", { name: "Dia" })
    const inactive = screen.getByRole("tab", { name: "Semana" })
    expect(active).toHaveClass("text-[13px]", "font-semibold")
    expect(inactive).toHaveClass("text-[13px]", "font-medium", "text-muted-foreground")
  })

  it("padding horizontal 18px", () => {
    render(
      <SegmentedControl options={OPTIONS} value="dia" onChange={() => {}} variant="pill" />
    )
    expect(screen.getByRole("tab", { name: "Dia" })).toHaveClass("px-[18px]")
  })

  it("alto de opcion 32px en movil", () => {
    mockMatchMedia(false)
    render(
      <SegmentedControl options={OPTIONS} value="dia" onChange={() => {}} variant="pill" />
    )
    expect(screen.getByRole("tab", { name: "Dia" })).toHaveClass("h-8")
  })

  it("alto de opcion 30px en escritorio", () => {
    mockMatchMedia(true)
    render(
      <SegmentedControl options={OPTIONS} value="dia" onChange={() => {}} variant="pill" />
    )
    expect(screen.getByRole("tab", { name: "Dia" })).toHaveClass("h-[30px]")
    expect(screen.getByRole("tab", { name: "Dia" })).not.toHaveClass("h-8")
  })

  it("la pastilla se coloca en la opcion activa (translateX 0 para la primera, 100% para la segunda)", () => {
    const { rerender } = render(
      <SegmentedControl options={OPTIONS} value="dia" onChange={() => {}} variant="pill" />
    )
    const pill = document.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(pill.style.transform).toBe("translateX(0%)")

    rerender(<SegmentedControl options={OPTIONS} value="semana" onChange={() => {}} variant="pill" />)
    const pillAfter = document.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(pillAfter.style.transform).toBe("translateX(100%)")
  })
})
