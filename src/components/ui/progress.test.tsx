import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Progress } from "./progress"

describe("Progress", () => {
  it("exposes a deterministic aria-valuetext regardless of the runtime locale", () => {
    render(<Progress value={20} />)

    const bar = screen.getByRole("progressbar")
    // Regresion: el valor por defecto de base-ui pasa por Intl.NumberFormat,
    // que formatea distinto en servidor (Node) y cliente (navegador) segun
    // la configuracion regional ("20%" vs "20 %" con espacio fino) y dispara
    // un error de hidratacion en React. El texto debe ser fijo, sin Intl.
    expect(bar).toHaveAttribute("aria-valuetext", "20%")
  })

  it("keeps aria-valuenow, aria-valuemin and aria-valuemax intact", () => {
    render(<Progress value={60} />)

    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-valuenow", "60")
    expect(bar).toHaveAttribute("aria-valuemin", "0")
    expect(bar).toHaveAttribute("aria-valuemax", "100")
  })

  it("describes an indeterminate progress bar without a numeric value", () => {
    render(<Progress value={null} />)

    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-valuetext", "progreso indeterminado")
    expect(bar).not.toHaveAttribute("aria-valuenow")
  })

  it("rounds fractional values instead of leaking decimals into the announced text", () => {
    render(<Progress value={33.333} />)

    const bar = screen.getByRole("progressbar")
    expect(bar).toHaveAttribute("aria-valuetext", "33%")
  })
})
