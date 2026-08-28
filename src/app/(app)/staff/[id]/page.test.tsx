import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import EmployeeDetailPage from "./page"
import type { Employee } from "@/types/employee"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}))

const useAuthMock = vi.fn()

vi.mock("@/hooks/use-auth", () => ({
  useAuth: (...args: unknown[]) => useAuthMock(...args),
}))

const useEmployeeServicesMock = vi.fn()

vi.mock("@/hooks/use-staff", () => ({
  useEmployeeServices: (...args: unknown[]) => useEmployeeServicesMock(...args),
}))

const getEmployee = vi.fn()
const getWorkingHours = vi.fn()
const updateWorkingHours = vi.fn()
const assignServices = vi.fn()
const deleteEmployee = vi.fn()

vi.mock("@/lib/api/staff", () => ({
  staffApi: {
    getEmployee: (...args: unknown[]) => getEmployee(...args),
    getWorkingHours: (...args: unknown[]) => getWorkingHours(...args),
    updateWorkingHours: (...args: unknown[]) => updateWorkingHours(...args),
    assignServices: (...args: unknown[]) => assignServices(...args),
    deleteEmployee: (...args: unknown[]) => deleteEmployee(...args),
  },
}))

// `use()` over a native Promise never resolves synchronously in a test
// render, and neither `await act(async () => {})` nor `await screen.findBy*`
// gets a Suspense retry to commit in jsdom. A synchronous thenable hands back
// the already-available value inside the same `.then()` call, so `use()`
// never needs to suspend. Same pattern as book/[slug]/page.test.tsx.
function resolvedParams<T>(value: T): Promise<T> {
  return { then: (onFulfilled: (v: T) => void) => onFulfilled(value) } as unknown as Promise<T>
}

const employee: Employee = {
  id: "emp_1",
  firstName: "Ana",
  lastName: "Garcia",
  email: "ana@rivoo.test",
  phone: "600000000",
  jobTitle: "Estilista",
  colorHex: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EmployeeDetailPage params={resolvedParams({ id: "emp_1" })} />
    </QueryClientProvider>
  )
}

describe("EmployeeDetailPage", () => {
  beforeEach(() => {
    getEmployee.mockReset()
    getWorkingHours.mockReset()
    updateWorkingHours.mockReset()
    assignServices.mockReset()
    deleteEmployee.mockReset()
    useAuthMock.mockReset()
    useAuthMock.mockReturnValue({ accessToken: "token", isOwner: true })
    useEmployeeServicesMock.mockReset()
    useEmployeeServicesMock.mockReturnValue({ data: undefined })
  })

  it("does not mount the working-hours editor for the 'Horarios' tab while the schedule is still loading, even though the employee record has already arrived", async () => {
    // The outer `isLoading || !employee` guard only covers the employee
    // query; it clears as soon as `employee` arrives even if the separate
    // employee-working-hours query is still in flight. Without a dedicated
    // guard, WorkingHoursEditor mounts on DEFAULT_HOURS with its internal
    // "Guardar horarios" button enabled (isSaving only reflects the mutation,
    // not this GET) -- a click there would overwrite the employee's stored
    // schedule with Mon-Fri 09:00-20:00.
    getEmployee.mockResolvedValue(employee)
    getWorkingHours.mockReturnValue(new Promise(() => {})) // never resolves in this test

    const { container } = renderPage()

    expect(await screen.findByText("Ana Garcia")).toBeInTheDocument()
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /guardar horarios/i })).not.toBeInTheDocument()
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
  })

  it("mounts the working-hours editor with the stored schedule once it has actually arrived", async () => {
    getEmployee.mockResolvedValue(employee)
    getWorkingHours.mockResolvedValue([
      { dayOfWeek: 1, isOpen: true, openTime: "10:30", closeTime: "18:00", breakStartTime: null, breakEndTime: null },
    ])

    renderPage()

    expect(await screen.findByDisplayValue("10:30")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /guardar horarios/i })).toBeEnabled()
  })

  it("shows an error with a retry action instead of an infinite skeleton in the 'Horarios' tab when the schedule fails to load, and recovers once the retry succeeds", async () => {
    getEmployee.mockResolvedValue(employee)
    getWorkingHours.mockRejectedValueOnce(new Error("network down"))
    getWorkingHours.mockResolvedValueOnce([
      { dayOfWeek: 1, isOpen: true, openTime: "10:30", closeTime: "18:00", breakStartTime: null, breakEndTime: null },
    ])
    const user = userEvent.setup()
    const { container } = renderPage()

    expect(await screen.findByText("Ana Garcia")).toBeInTheDocument()
    expect(await screen.findByText(/no se ha podido cargar el horario/i)).toBeInTheDocument()
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument()
    expect(screen.queryByRole("switch")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /reintentar/i }))

    // Proves the retry's data actually landed (react-query's notifyManager
    // macrotask, per AGENTS.md), not just that the error text disappeared.
    expect(await screen.findByDisplayValue("10:30")).toBeInTheDocument()
    expect(screen.queryByText(/no se ha podido cargar el horario/i)).not.toBeInTheDocument()
  })
})
