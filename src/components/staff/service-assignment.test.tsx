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
    serviceId: "svc_1",
    serviceName: "Corte",
    effectiveDuration: 30,
    effectivePrice: 20,
    customDuration: null,
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

  // D15: `4 de 6` (here 1 de 2) tracks the LIVE selection, not the server
  // snapshot -- it has to move the instant a box is ticked, before any save.
  it("D15: the counter tracks the live selection against the active catalogue, and updates on every toggle", () => {
    render(<ServiceAssignment assignedServices={assigned} onSave={vi.fn().mockResolvedValue(undefined)} />)

    expect(screen.getByText("1 de 2")).toBeInTheDocument()

    fireEvent.click(checkbox(/Tinte/))

    expect(screen.getByText("2 de 2")).toBeInTheDocument()
  })

  // D12: the desktop card title ("Servicios que realiza") is desktop-only --
  // the mobile panel reuses this same component but the enumeration of
  // "same pieces" it reuses names the counter, not the card title.
  it("D12: renders the card title only when the caller passes it (desktop), and always renders the live counter", () => {
    const { rerender } = render(
      <ServiceAssignment
        assignedServices={assigned}
        onSave={vi.fn().mockResolvedValue(undefined)}
        title="Servicios que realiza"
      />
    )
    expect(screen.getByText("Servicios que realiza")).toBeInTheDocument()
    expect(screen.getByText("1 de 2")).toBeInTheDocument()

    rerender(<ServiceAssignment assignedServices={assigned} onSave={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.queryByText("Servicios que realiza")).not.toBeInTheDocument()
    expect(screen.getByText("1 de 2")).toBeInTheDocument()
  })
})
