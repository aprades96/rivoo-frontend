import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ServiceAssignment } from "./service-assignment"
import type { EmployeeServiceResponse } from "@/types/employee"

vi.mock("@/hooks/use-staff", () => ({
  useServices: () => ({
    data: {
      content: [
        {
          id: "svc_1",
          name: "Corte",
          description: null,
          durationMinutes: 30,
          price: 20,
          category: null,
          isActive: true,
        },
        {
          id: "svc_2",
          name: "Tinte",
          description: null,
          durationMinutes: 60,
          price: 45,
          category: null,
          isActive: true,
        },
      ],
    },
  }),
}))

const assigned: EmployeeServiceResponse[] = [
  {
    employeeId: "emp_1",
    serviceId: "svc_1",
    customDurationMinutes: null,
    customPrice: null,
  },
]

function renderAssignment(assignedServices: EmployeeServiceResponse[] | undefined) {
  const ui = (a: EmployeeServiceResponse[] | undefined) => (
    <ServiceAssignment
      assignedServices={a}
      onSave={vi.fn().mockResolvedValue(undefined)}
    />
  )
  const utils = render(ui(assignedServices))
  return {
    ...utils,
    rerenderWith: (next: EmployeeServiceResponse[] | undefined) =>
      utils.rerender(ui(next)),
  }
}

const checkbox = (name: RegExp) =>
  screen.getByLabelText(name) as HTMLInputElement

describe("ServiceAssignment", () => {
  it("adopts the assigned services when they arrive after mount", () => {
    const { rerenderWith } = renderAssignment(undefined)
    expect(checkbox(/Corte/).checked).toBe(false)

    rerenderWith(assigned)

    expect(checkbox(/Corte/).checked).toBe(true)
    expect(checkbox(/Tinte/).checked).toBe(false)
  })

  it("keeps the in-progress selection when a background refetch returns a new array", () => {
    const { rerenderWith } = renderAssignment(assigned)

    fireEvent.click(checkbox(/Tinte/))
    expect(checkbox(/Tinte/).checked).toBe(true)

    // Same assignment, brand new array/objects: exactly what a refetch produces.
    rerenderWith(assigned.map((a) => ({ ...a })))

    expect(checkbox(/Tinte/).checked).toBe(true)
    expect(checkbox(/Corte/).checked).toBe(true)
  })
})
