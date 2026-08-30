import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EmployeeTable } from "./employee-table"
import type { Employee } from "@/types/employee"

const laura: Employee = {
  id: "emp_laura",
  firstName: "Laura",
  lastName: "Martinez",
  email: "laura@rivoo.test",
  phone: "612345678",
  jobTitle: "Estilista",
  colorHex: "#B4522F",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
}

const nil: Employee = {
  id: "emp_nil",
  firstName: "Nil",
  lastName: "Bosch",
  email: "nil@rivoo.test",
  phone: null,
  jobTitle: "Recepcion",
  colorHex: null,
  isActive: false,
  createdAt: "2026-01-01T00:00:00Z",
}

describe("EmployeeTable", () => {
  it("renders a role=table with the six columns of §1.3", () => {
    render(<EmployeeTable employees={[laura, nil]} totalElements={2} pageSize={100} />)

    expect(screen.getByRole("table")).toBeInTheDocument()
    const headers = screen.getAllByRole("columnheader")
    expect(headers.map((h) => h.textContent)).toEqual([
      "Empleado",
      "Puesto",
      "Contacto",
      "Color",
      "Estado",
      "",
    ])
  })

  it("each row is a keyboard-reachable link toward the employee's detail page (D5)", async () => {
    const user = userEvent.setup()
    const { container } = render(<EmployeeTable employees={[laura, nil]} totalElements={2} pageSize={100} />)

    // The row keeps role="row" (A1) so the table tree stays valid;
    // getByRole("link") no longer finds it, so the target is asserted via
    // the anchor's href attribute instead.
    const links = container.querySelectorAll("a[href]")
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute("href", "/staff/emp_laura")
    expect(links[1]).toHaveAttribute("href", "/staff/emp_nil")

    await user.tab()
    expect(links[0]).toHaveFocus()
  })

  it("tints only the inactive row's background (D9)", () => {
    const { container } = render(<EmployeeTable employees={[laura, nil]} totalElements={2} pageSize={100} />)

    const links = container.querySelectorAll("a[href]")
    expect(links[0]).not.toHaveClass("bg-muted-subtle")
    expect(links[1]).toHaveClass("bg-muted-subtle")
  })

  it("shows the phone formatted, or 'Sin teléfono' when there isn't one", () => {
    render(<EmployeeTable employees={[laura, nil]} totalElements={2} pageSize={100} />)

    expect(screen.getByText("612 345 678")).toBeInTheDocument()
    expect(screen.getByText("Sin teléfono")).toBeInTheDocument()
  })

  it("shows the color dot with its hex, or 'Por defecto' without any dot when there is none", () => {
    render(<EmployeeTable employees={[laura, nil]} totalElements={2} pageSize={100} />)

    expect(screen.getByText("#B4522F")).toBeInTheDocument()
    expect(screen.getByText("Por defecto")).toBeInTheDocument()
    // "Por defecto" no lleva el punto de color (D14): un solo swatch en toda
    // la tabla, el de Laura.
    expect(screen.getAllByTestId("employee-color-swatch")).toHaveLength(1)
  })

  it("shows the 'Activo'/'Inactivo' status badge", () => {
    render(<EmployeeTable employees={[laura, nil]} totalElements={2} pageSize={100} />)

    expect(screen.getByText("Activo")).toBeInTheDocument()
    expect(screen.getByText("Inactivo")).toBeInTheDocument()
  })

  it("prints the pagination line with real numbers OUTSIDE the table (F2)", () => {
    render(<EmployeeTable employees={[laura, nil]} totalElements={150} pageSize={100} />)

    const table = screen.getByRole("table")
    expect(within(table).queryByText(/Mostrando/)).not.toBeInTheDocument()
    expect(screen.getByText("Mostrando 2 de 150 · la lista pide 100 por página")).toBeInTheDocument()
  })
})
