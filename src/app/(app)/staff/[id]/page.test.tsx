import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import EmployeeDetailPage from "./page"
import type { Employee, EmployeeServiceResponse } from "@/types/employee"

// `push`/`back` estables via `vi.hoisted`: un `useRouter: () => ({ push: vi.fn(), ... })`
// inline crea un espia NUEVO en cada llamada al hook, y aqui hace falta aseverar
// sobre el mismo espia entre el render y el click (mismo patron que page-shell.test.tsx).
const { pushMock, backMock } = vi.hoisted(() => ({ pushMock: vi.fn(), backMock: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: backMock }),
}))

/** `matches: desktop` para simular `(min-width: 1024px)`; jsdom no tiene layout real. */
function mockMatchMedia(desktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: desktop,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

const useAuthMock = vi.fn()

vi.mock("@/hooks/use-auth", () => ({
  useAuth: (...args: unknown[]) => useAuthMock(...args),
}))

const useEmployeeServicesMock = vi.fn()
// ServiceAssignment (mounted once the guard below clears) calls this for the
// catalogue -- unrelated to the employee's own assignment, but it lives in
// the same module, and this file mocks that module wholesale.
const useServicesMock = vi.fn()

vi.mock("@/hooks/use-staff", () => ({
  useEmployeeServices: (...args: unknown[]) => useEmployeeServicesMock(...args),
  useServices: (...args: unknown[]) => useServicesMock(...args),
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

const assignedServices: EmployeeServiceResponse[] = [
  {
    serviceId: "svc_1",
    serviceName: "Corte",
    effectiveDuration: 30,
    effectivePrice: 18,
    customDuration: null,
    customPrice: null,
  },
]

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
    useEmployeeServicesMock.mockReturnValue({ data: undefined, isError: false, refetch: vi.fn() })
    useServicesMock.mockReset()
    useServicesMock.mockReturnValue({
      data: {
        content: [
          { id: "svc_1", name: "Corte", description: null, durationMinutes: 30, price: 18, category: null, isActive: true },
        ],
      },
    })
    pushMock.mockClear()
    backMock.mockClear()
  })

  afterEach(() => {
    mockMatchMedia(false)
  })

  // F1: `isLoading || !employee` used to collapse "the employee GET is still
  // in flight" and "the employee GET actually failed" into the same branch,
  // painting the skeleton forever on a 404/500 (e.g. staff-service down, or
  // GET /api/v1/staff/employees/no-existe). Exactly the defect this same
  // block already fixed on the twin screen (clients/[id]/page.tsx) and left
  // standing here. This test goes FIRST on purpose.
  it("F1: shows an error with a retry action instead of an infinite skeleton when the employee fails to load, and recovers once the retry succeeds", async () => {
    getEmployee.mockRejectedValueOnce(new Error("not found"))
    getEmployee.mockResolvedValueOnce(employee)
    getWorkingHours.mockResolvedValue([])
    const user = userEvent.setup()

    const { container } = renderPage()

    expect(await screen.findByText(/no se ha podido cargar el empleado/i)).toBeInTheDocument()
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument()
    expect(screen.queryByText("Ana Garcia")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /reintentar/i }))

    // Proves the retry's data actually landed (react-query's notifyManager
    // macrotask, per AGENTS.md), not just that the error text disappeared.
    expect(await screen.findByText("Ana Garcia")).toBeInTheDocument()
    expect(screen.queryByText(/no se ha podido cargar el empleado/i)).not.toBeInTheDocument()
  })

  // F1: while `accessToken` is still `null` (session cold start), the
  // employee query is disabled and React Query v5 reports `isError: false`
  // for a disabled query -- same as `isLoading: false`. The error branch
  // above must never fire during that window, only the skeleton.
  it("F1: shows the skeleton, not the error card, while waiting for the access token on a cold load", () => {
    useAuthMock.mockReturnValue({ accessToken: null, isOwner: true })
    getEmployee.mockReturnValue(new Promise(() => {}))
    getWorkingHours.mockReturnValue(new Promise(() => {}))

    const { container } = renderPage()

    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
    expect(screen.queryByText(/no se ha podido cargar el empleado/i)).not.toBeInTheDocument()
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

  it("the mobile back control calls router.push('/staff') and not router.back()", async () => {
    // This screen is reachable without having passed through /staff (e.g. a
    // direct link to /staff/emp_1), so the fixed destination is that list,
    // not "whatever is in the history stack". `router.back()` here would
    // leave the arrow going nowhere for that entry path.
    mockMatchMedia(false)
    getEmployee.mockResolvedValue(employee)
    getWorkingHours.mockResolvedValue([])
    const user = userEvent.setup()

    renderPage()

    expect(await screen.findByText("Ana Garcia")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Volver" }))

    expect(pushMock).toHaveBeenCalledWith("/staff")
    expect(backMock).not.toHaveBeenCalled()
  })

  it("the desktop back control (desktopBack) calls router.push('/staff') and not router.back()", async () => {
    mockMatchMedia(true)
    getEmployee.mockResolvedValue(employee)
    getWorkingHours.mockResolvedValue([])
    const user = userEvent.setup()

    renderPage()

    // M14 added the employee's name to the desktop profile card too, so
    // plain text now matches twice (the PageShell `<h1>` title and the
    // card) -- assert against the heading specifically.
    expect(await screen.findByRole("heading", { name: "Ana Garcia" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Volver" }))

    expect(pushMock).toHaveBeenCalledWith("/staff")
    expect(backMock).not.toHaveBeenCalled()
  })

  // D16/§1.11.2: same class of bug as the working-hours guard above, made
  // reachable once T4 fixed the assign-services contract (the 400 of
  // §1.11.1 used to mask it entirely). This test goes FIRST in the plan's
  // step order on purpose.
  it("does not mount the service editor for the 'Servicios' section while the assignment is still loading, even though the employee record has already arrived", async () => {
    mockMatchMedia(false)
    getEmployee.mockResolvedValue(employee)
    getWorkingHours.mockResolvedValue([])
    useEmployeeServicesMock.mockReturnValue({ data: undefined, isError: false, refetch: vi.fn() })
    const user = userEvent.setup()

    const { container } = renderPage()

    expect(await screen.findByText("Ana Garcia")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Servicios" }))

    expect(screen.queryByRole("button", { name: /guardar servicios/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
  })

  it("mounts the service editor with the assigned services once they have actually arrived", async () => {
    mockMatchMedia(false)
    getEmployee.mockResolvedValue(employee)
    getWorkingHours.mockResolvedValue([])
    useEmployeeServicesMock.mockReturnValue({ data: assignedServices, isError: false, refetch: vi.fn() })
    const user = userEvent.setup()

    renderPage()

    expect(await screen.findByText("Ana Garcia")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Servicios" }))

    expect(await screen.findByRole("button", { name: /guardar servicios \(1\)/i })).toBeEnabled()
  })

  it("shows an error with a retry action instead of an infinite skeleton for services when the assignment fails to load", async () => {
    mockMatchMedia(false)
    getEmployee.mockResolvedValue(employee)
    getWorkingHours.mockResolvedValue([])
    const refetchEmployeeServices = vi.fn()
    useEmployeeServicesMock.mockReturnValue({
      data: undefined,
      isError: true,
      refetch: refetchEmployeeServices,
    })
    const user = userEvent.setup()

    renderPage()

    expect(await screen.findByText("Ana Garcia")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Servicios" }))

    expect(await screen.findByText(/no se han podido cargar los servicios/i)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /reintentar/i }))

    expect(refetchEmployeeServices).toHaveBeenCalledTimes(1)
  })

  it("mobile: switches between the 'Horarios' and 'Servicios' sections through a single JS-mounted panel, never both at once", async () => {
    mockMatchMedia(false)
    getEmployee.mockResolvedValue(employee)
    getWorkingHours.mockResolvedValue([
      { dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "20:00", breakStartTime: null, breakEndTime: null },
    ])
    const user = userEvent.setup()

    renderPage()

    expect(await screen.findByRole("button", { name: /guardar horarios/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /guardar servicios/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: "Servicios" }))

    expect(screen.queryByRole("button", { name: /guardar horarios/i })).not.toBeInTheDocument()
  })

  it("desktop: lays out three fixed-width cards (profile, hours, services) with no segmented control", async () => {
    mockMatchMedia(true)
    getEmployee.mockResolvedValue(employee)
    getWorkingHours.mockResolvedValue([
      { dayOfWeek: 1, isOpen: true, openTime: "09:00", closeTime: "20:00", breakStartTime: null, breakEndTime: null },
    ])
    useEmployeeServicesMock.mockReturnValue({ data: assignedServices, isError: false, refetch: vi.fn() })

    renderPage()

    expect(await screen.findByText("Horario semanal")).toBeInTheDocument()
    expect(screen.getByText("Horas propias de Ana")).toBeInTheDocument()
    expect(await screen.findByText("Servicios que realiza")).toBeInTheDocument()
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
  })

  it("D14/D29: shows the employee's colour swatch and the formatted phone number instead of the raw digits", async () => {
    mockMatchMedia(false)
    getEmployee.mockResolvedValue({ ...employee, colorHex: "#B4522F" })
    getWorkingHours.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText("Ana Garcia")).toBeInTheDocument()
    expect(screen.getByTestId("employee-color-swatch")).toBeInTheDocument()
    expect(screen.getByText("600 000 000")).toBeInTheDocument()
    expect(screen.queryByText("600000000")).not.toBeInTheDocument()
  })

  it("deactivating an employee invalidates all four caches it can have populated, not just 'employees'", async () => {
    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries")
    mockMatchMedia(false)
    getEmployee.mockResolvedValue(employee)
    getWorkingHours.mockResolvedValue([])
    deleteEmployee.mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderPage()

    expect(await screen.findByText("Ana Garcia")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Desactivar" }))

    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Desactivar" }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/staff"))

    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => (call[0] as { queryKey: unknown[] }).queryKey[0])
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining(["employees", "employee", "employee-working-hours", "employee-services"])
    )

    invalidateSpy.mockRestore()
  })
})
