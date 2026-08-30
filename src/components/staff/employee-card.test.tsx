import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EmployeeCard } from "./employee-card"
import type { Employee } from "@/types/employee"

const activeEmployee: Employee = {
  id: "emp_1",
  firstName: "Carlos",
  lastName: "Garcia",
  email: "carlos@test.com",
  phone: "612345678",
  jobTitle: "Barbero",
  colorHex: "#3B82F6",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
}

const inactiveEmployee: Employee = {
  ...activeEmployee,
  id: "emp_2",
  firstName: "Maria",
  lastName: "Lopez",
  isActive: false,
}

describe("EmployeeCard", () => {
  it("renders employee name and job title", () => {
    render(<EmployeeCard employee={activeEmployee} />)
    expect(screen.getByText("Carlos Garcia")).toBeInTheDocument()
    expect(screen.getByText("Barbero")).toBeInTheDocument()
  })

  it("shows 'Activo' badge for active employee", () => {
    render(<EmployeeCard employee={activeEmployee} />)
    expect(screen.getByText("Activo")).toBeInTheDocument()
  })

  it("shows 'Inactivo' badge for inactive employee", () => {
    render(<EmployeeCard employee={inactiveEmployee} />)
    expect(screen.getByText("Inactivo")).toBeInTheDocument()
  })

  it("renders initials in avatar", () => {
    render(<EmployeeCard employee={activeEmployee} />)
    expect(screen.getByText("CG")).toBeInTheDocument()
  })

  // D5: la fila es un enlace de verdad, no un `<Card onClick>` sin `role`.
  // Sustituye al viejo test de `onTap` -- la navegacion ahora es
  // responsabilidad del propio `<Link>`, no de un callback del padre.
  it("is a real link toward the employee's detail page, reachable by keyboard", async () => {
    const user = userEvent.setup()
    render(<EmployeeCard employee={activeEmployee} />)

    const link = screen.getByRole("link", { name: /Carlos Garcia/ })
    expect(link).toHaveAttribute("href", "/staff/emp_1")

    await user.tab()
    expect(link).toHaveFocus()
  })

  // D9: en movil la fila inactiva NO tinta el fondo (a diferencia de la
  // tabla de escritorio); solo el nombre y el puesto atenuan su color.
  it("does not tint the background of an inactive row in mobile (D9)", () => {
    render(<EmployeeCard employee={inactiveEmployee} />)

    const link = screen.getByRole("link", { name: /Maria Lopez/ })
    expect(link).not.toHaveClass("bg-muted-subtle")
    expect(screen.getByText("Maria Lopez")).toHaveClass("text-muted-foreground")
  })
})
