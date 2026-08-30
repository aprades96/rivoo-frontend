import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { EmployeeColor } from "./employee-color"

describe("EmployeeColor · las cuatro formas de D14", () => {
  it("dot-sm: 10px, punto de circulo", () => {
    render(<EmployeeColor colorHex="#B4522F" shape="dot-sm" />)
    expect(screen.getByTestId("employee-color-swatch")).toHaveClass(
      "size-[10px]",
      "rounded-full"
    )
  })

  it("dot: 12px, punto de circulo", () => {
    render(<EmployeeColor colorHex="#B4522F" shape="dot" />)
    expect(screen.getByTestId("employee-color-swatch")).toHaveClass("size-3", "rounded-full")
  })

  it("square-sm: 28px, cuadrado con borde", () => {
    render(<EmployeeColor colorHex="#B4522F" shape="square-sm" />)
    const swatch = screen.getByTestId("employee-color-swatch")
    expect(swatch).toHaveClass("size-7", "rounded-lg", "border")
  })

  it("square: 32px, cuadrado con borde", () => {
    render(<EmployeeColor colorHex="#B4522F" shape="square" />)
    const swatch = screen.getByTestId("employee-color-swatch")
    expect(swatch).toHaveClass("size-8", "rounded-lg", "border")
  })

  it("pinta el fondo con el colorHex del empleado", () => {
    render(<EmployeeColor colorHex="#5C7A5E" shape="dot" />)
    expect(screen.getByTestId("employee-color-swatch")).toHaveStyle({
      backgroundColor: "#5C7A5E",
    })
  })
})

describe("EmployeeColor · showHex", () => {
  it("por defecto NO pinta el hex", () => {
    render(<EmployeeColor colorHex="#B4522F" shape="dot" />)
    expect(screen.queryByTestId("employee-color-hex")).not.toBeInTheDocument()
  })

  it("con showHex, pinta el hex en mayusculas tal cual llega", () => {
    render(<EmployeeColor colorHex="#B4522F" shape="dot" showHex />)
    expect(screen.getByTestId("employee-color-hex")).toHaveTextContent("#B4522F")
  })

  it("con showHex pero sin colorHex, no hay hex que pintar", () => {
    render(<EmployeeColor colorHex={null} shape="dot" showHex />)
    expect(screen.queryByTestId("employee-color-hex")).not.toBeInTheDocument()
  })
})

describe("EmployeeColor · colorHex === null", () => {
  it("con emptyLabel, pinta SOLO el texto: sin punto y sin hex (EquipoDesktop.dc.html:201)", () => {
    render(<EmployeeColor colorHex={null} shape="dot" showHex emptyLabel="Por defecto" />)
    expect(screen.getByText("Por defecto")).toBeInTheDocument()
    expect(screen.queryByTestId("employee-color-swatch")).not.toBeInTheDocument()
    expect(screen.queryByTestId("employee-color-hex")).not.toBeInTheDocument()
  })

  it("sin emptyLabel, pinta la forma con el fondo de reserva y sin hex", () => {
    render(<EmployeeColor colorHex={null} shape="square" showHex />)
    expect(screen.getByTestId("employee-color-swatch")).toHaveStyle({
      backgroundColor: "var(--muted)",
    })
    expect(screen.queryByTestId("employee-color-hex")).not.toBeInTheDocument()
  })
})
