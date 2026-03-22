import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
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

  it("calls onTap when clicked", () => {
    const onTap = vi.fn()
    render(<EmployeeCard employee={activeEmployee} onTap={onTap} />)
    fireEvent.click(screen.getByText("Carlos Garcia"))
    expect(onTap).toHaveBeenCalledWith(activeEmployee)
  })
})
