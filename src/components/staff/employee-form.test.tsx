import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { EmployeeFormSheet } from "./employee-form"
import type { Employee } from "@/types/employee"

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ accessToken: "token" }),
}))

const mockEmployee: Employee = {
  id: "emp_1",
  firstName: "Ana",
  lastName: "Lopez",
  email: "ana@test.com",
  phone: "612345678",
  jobTitle: "Estilista",
  colorHex: "#ff0000",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
}

function renderSheet(employee: Employee | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const ui = (e: Employee | null) => (
    <QueryClientProvider client={queryClient}>
      <EmployeeFormSheet open onOpenChange={() => {}} employee={e} />
    </QueryClientProvider>
  )
  const utils = render(ui(employee))
  return {
    ...utils,
    rerenderWith: (next: Employee | null) => utils.rerender(ui(next)),
  }
}

const firstNameInput = () =>
  screen.getByPlaceholderText("Nombre") as HTMLInputElement

describe("EmployeeFormSheet", () => {
  it("populates the form from the employee when it opens", () => {
    renderSheet(mockEmployee)
    expect(firstNameInput().value).toBe("Ana")
  })

  it("keeps the in-progress edit when a background refetch returns a new object for the same employee", () => {
    const { rerenderWith } = renderSheet(mockEmployee)

    fireEvent.change(firstNameInput(), { target: { value: "Anabel" } })
    expect(firstNameInput().value).toBe("Anabel")

    // The staff list refetches and hands down a brand new object for the same
    // employee (different identity, server-side fields refreshed).
    rerenderWith({ ...mockEmployee, jobTitle: "Estilista senior" })

    expect(firstNameInput().value).toBe("Anabel")
  })

  it("repopulates when the sheet is pointed at a different employee", () => {
    const { rerenderWith } = renderSheet(mockEmployee)

    fireEvent.change(firstNameInput(), { target: { value: "Anabel" } })

    rerenderWith({ ...mockEmployee, id: "emp_2", firstName: "Marta", lastName: "Ruiz" })

    expect(firstNameInput().value).toBe("Marta")
  })

  it("clears the form when pointed at create mode", () => {
    const { rerenderWith } = renderSheet(mockEmployee)

    rerenderWith(null)

    expect(firstNameInput().value).toBe("")
  })
})
