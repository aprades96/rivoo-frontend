import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Button } from "./button"

describe("Button", () => {
  it('size="action" mide 38px, con el padding y el peso de fuente del artboard', () => {
    render(<Button size="action">Guardar</Button>)

    const button = screen.getByRole("button", { name: "Guardar" })

    expect(button).toHaveClass("h-[38px]")
    expect(button).toHaveClass("px-[18px]")
    expect(button).toHaveClass("text-sm")
    expect(button).toHaveClass("font-semibold")
  })

  it("las tallas existentes no cambian al anadir `action`", () => {
    render(
      <>
        <Button size="sm">Pequeno</Button>
        <Button size="default">Por defecto</Button>
        <Button size="xl">Grande</Button>
        <Button size="2xl">Extra grande</Button>
      </>
    )

    expect(screen.getByRole("button", { name: "Pequeno" })).toHaveClass("h-7")
    expect(screen.getByRole("button", { name: "Por defecto" })).toHaveClass("h-8")
    expect(screen.getByRole("button", { name: "Grande" })).toHaveClass("h-11")
    expect(screen.getByRole("button", { name: "Extra grande" })).toHaveClass(
      "h-[50px]"
    )
  })
})
