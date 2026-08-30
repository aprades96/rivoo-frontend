import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ServiceAssignment } from "./service-assignment"
import type { EmployeeServiceResponse } from "@/types/employee"

const catalog = {
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
}

const useServicesMock = vi.fn()

vi.mock("@/hooks/use-staff", () => ({
  useServices: (...args: unknown[]) => useServicesMock(...args),
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

// M8: the row now uses the `ui/checkbox` primitive (`role="checkbox"`, an
// accessible span, plus a visually-hidden native input for form purposes
// that a plain `getByLabelText` would also match -- same class of trap as
// the Switch primitive in working-hours-editor.test.tsx). Assert against the
// actual interactive/accessible node instead.
const checkbox = (name: RegExp) =>
  screen.getByRole("checkbox", { name })

describe("ServiceAssignment", () => {
  beforeEach(() => {
    useServicesMock.mockReset()
    useServicesMock.mockReturnValue({
      data: catalog,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
  })

  it("adopts the assigned services when they arrive after mount", () => {
    const { rerenderWith } = renderAssignment(undefined)
    expect(checkbox(/Corte/)).toHaveAttribute("aria-checked", "false")

    rerenderWith(assigned)

    expect(checkbox(/Corte/)).toHaveAttribute("aria-checked", "true")
    expect(checkbox(/Tinte/)).toHaveAttribute("aria-checked", "false")
  })

  it("keeps the in-progress selection when a background refetch returns a new array", () => {
    const { rerenderWith } = renderAssignment(assigned)

    fireEvent.click(checkbox(/Tinte/))
    expect(checkbox(/Tinte/)).toHaveAttribute("aria-checked", "true")

    // Same assignment, brand new array/objects: exactly what a refetch produces.
    rerenderWith(assigned.map((a) => ({ ...a })))

    expect(checkbox(/Tinte/)).toHaveAttribute("aria-checked", "true")
    expect(checkbox(/Corte/)).toHaveAttribute("aria-checked", "true")
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

  // F2: the assigned-services guard at the call site does not cover this
  // component's OWN catalogue GET. 1 service is already assigned; the
  // catalogue fetch fails independently.
  describe("F2: the catalogue GET is unguarded", () => {
    it("does not claim an empty catalogue while the catalogue GET has actually failed", () => {
      useServicesMock.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        refetch: vi.fn(),
      })

      render(<ServiceAssignment assignedServices={assigned} onSave={vi.fn().mockResolvedValue(undefined)} />)

      // Not "1 de 0" (which would assert a confirmed-empty catalogue) and not
      // the "crea uno primero" empty-state, both false: the catalogue was
      // never actually read.
      expect(screen.queryByText(/de 0/)).not.toBeInTheDocument()
      expect(screen.queryByText(/crea uno primero/i)).not.toBeInTheDocument()
      expect(screen.getByText(/no se ha podido cargar el catálogo/i)).toBeInTheDocument()
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    })

    it("retries the catalogue GET and renders the real list once it lands", async () => {
      const refetchCatalog = vi.fn()
      useServicesMock.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        refetch: refetchCatalog,
      })
      const user = userEvent.setup()

      const { rerender } = render(
        <ServiceAssignment assignedServices={assigned} onSave={vi.fn().mockResolvedValue(undefined)} />
      )

      await user.click(screen.getByRole("button", { name: /reintentar/i }))
      expect(refetchCatalog).toHaveBeenCalledTimes(1)

      useServicesMock.mockReturnValue({
        data: catalog,
        isLoading: false,
        isError: false,
        refetch: refetchCatalog,
      })
      rerender(<ServiceAssignment assignedServices={assigned} onSave={vi.fn().mockResolvedValue(undefined)} />)

      expect(await screen.findByText("1 de 2")).toBeInTheDocument()
      expect(checkbox(/Corte/)).toHaveAttribute("aria-checked", "true")
    })

    it("does not claim an empty catalogue while the catalogue GET is still in flight", () => {
      useServicesMock.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        refetch: vi.fn(),
      })

      render(<ServiceAssignment assignedServices={assigned} onSave={vi.fn().mockResolvedValue(undefined)} />)

      expect(screen.queryByText(/de 0/)).not.toBeInTheDocument()
      expect(screen.queryByText(/crea uno primero/i)).not.toBeInTheDocument()
      expect(screen.getByText(/cargando catálogo/i)).toBeInTheDocument()
    })
  })
})
