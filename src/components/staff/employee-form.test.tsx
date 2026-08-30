import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { EmployeeFormSheet } from "./employee-form"
import { staffApi } from "@/lib/api/staff"
import { ApiError } from "@/lib/api/client"
import type { Employee } from "@/types/employee"

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ accessToken: "token" }),
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}))

vi.mock("@/lib/api/staff", () => ({
  staffApi: {
    createEmployee: vi.fn(),
    updateEmployee: vi.fn(),
  },
}))

const createEmployeeMock = vi.mocked(staffApi.createEmployee)
const updateEmployeeMock = vi.mocked(staffApi.updateEmployee)

/** `matches: desktop` para simular `(min-width: 1024px)`; el polyfill de
 * `src/test/setup.ts` devuelve SIEMPRE `matches: false` (movil), asi que la
 * rama de escritorio necesita este mock explicito y su `afterEach` (AGENTS.md). */
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

function renderSheet(employee: Employee | null, onOpenChange: (open: boolean) => void = () => {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const ui = (e: Employee | null) => (
    <QueryClientProvider client={queryClient}>
      <EmployeeFormSheet open onOpenChange={onOpenChange} employee={e} />
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

function fillMinimalValidForm() {
  fireEvent.change(screen.getByPlaceholderText("Nombre"), { target: { value: "Marta" } })
  fireEvent.change(screen.getByPlaceholderText("Apellidos"), { target: { value: "Ruiz" } })
  fireEvent.change(screen.getByPlaceholderText("email@ejemplo.com"), {
    target: { value: "marta@test.com" },
  })
}

describe("EmployeeFormSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    mockMatchMedia(false)
  })

  describe("re-synchronization (state, no mutation involved)", () => {
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

  describe("create mode mutation", () => {
    it("calls createEmployee with the trimmed, mapped body and closes on success", async () => {
      createEmployeeMock.mockResolvedValue({ ...mockEmployee, id: "emp_new" })
      const onOpenChange = vi.fn()

      renderSheet(null, onOpenChange)
      fillMinimalValidForm()

      fireEvent.click(screen.getByRole("button", { name: "Crear empleado" }))

      // Real-timer wait: react-query's notifyManager schedules observer
      // notification on a macrotask, and the mutation's own onSuccess side
      // effect (closing the modal) only runs once the mocked promise settles.
      // A synchronous assertion right after the click would pass even with
      // the mutation never wired up (AGENTS.md).
      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))

      expect(createEmployeeMock).toHaveBeenCalledWith(
        {
          firstName: "Marta",
          lastName: "Ruiz",
          email: "marta@test.com",
          phone: undefined,
          jobTitle: undefined,
          colorHex: undefined,
          createKeycloakAccount: undefined,
          password: undefined,
        },
        "token"
      )
      expect(toastSuccess).toHaveBeenCalledWith("Empleado creado")
    })

    it("does not run the guard past a whitespace-only name (D31)", () => {
      renderSheet(null)

      fireEvent.change(screen.getByPlaceholderText("Nombre"), { target: { value: "   " } })
      fireEvent.change(screen.getByPlaceholderText("Apellidos"), { target: { value: "Ruiz" } })
      fireEvent.change(screen.getByPlaceholderText("email@ejemplo.com"), {
        target: { value: "marta@test.com" },
      })

      const cta = screen.getByRole("button", { name: "Crear empleado" })
      expect(cta).toBeDisabled()

      fireEvent.click(cta)

      expect(createEmployeeMock).not.toHaveBeenCalled()
    })

    it("shows the ProblemDetail's detail in the toast, with the generic message as fallback", async () => {
      createEmployeeMock.mockRejectedValue(
        new ApiError({
          type: "https://rivoo.com/errors/conflict",
          title: "Conflict",
          status: 409,
          detail: "Ya existe un empleado con ese email",
          instance: "/api/v1/staff/employees",
          timestamp: "2026-01-01T00:00:00Z",
          correlationId: "corr-1",
        })
      )
      const onOpenChange = vi.fn()

      renderSheet(null, onOpenChange)
      fillMinimalValidForm()
      fireEvent.click(screen.getByRole("button", { name: "Crear empleado" }))

      await waitFor(() => expect(toastError).toHaveBeenCalledWith("Ya existe un empleado con ese email"))

      // The failure must not be mistaken for success: the modal stays open.
      expect(onOpenChange).not.toHaveBeenCalledWith(false)
    })

    it("falls back to a generic message when the failure is not an ApiError", async () => {
      createEmployeeMock.mockRejectedValue(new TypeError("Failed to fetch"))

      renderSheet(null)
      fillMinimalValidForm()
      fireEvent.click(screen.getByRole("button", { name: "Crear empleado" }))

      await waitFor(() => expect(toastError).toHaveBeenCalledWith("Error de conexion. Intentalo de nuevo."))
    })

    it("only shows the access-account block and temporary password in create mode (D18)", () => {
      renderSheet(null)

      expect(screen.getByText("Crear cuenta de acceso")).toBeInTheDocument()
      expect(
        screen.queryByText("La cuenta de acceso solo se crea al dar de alta al empleado.")
      ).not.toBeInTheDocument()
    })
  })

  describe("edit mode mutation", () => {
    it("calls updateEmployee with the trimmed, mapped body and closes on success", async () => {
      updateEmployeeMock.mockResolvedValue(mockEmployee)
      const onOpenChange = vi.fn()

      renderSheet(mockEmployee, onOpenChange)

      fireEvent.change(firstNameInput(), { target: { value: "  Ana  " } })
      fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

      await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))

      expect(updateEmployeeMock).toHaveBeenCalledWith(
        "emp_1",
        {
          firstName: "Ana",
          lastName: "Lopez",
          email: "ana@test.com",
          phone: "612345678",
          jobTitle: "Estilista",
          colorHex: "#ff0000",
        },
        "token"
      )
      expect(toastSuccess).toHaveBeenCalledWith("Empleado actualizado")
    })

    it("only shows the access-account note in edit mode, not the create block (D18)", () => {
      renderSheet(mockEmployee)

      expect(
        screen.getByText("La cuenta de acceso solo se crea al dar de alta al empleado.")
      ).toBeInTheDocument()
      expect(screen.queryByText("Crear cuenta de acceso")).not.toBeInTheDocument()
    })

    it("shows the ProblemDetail's detail in the toast on update failure too", async () => {
      updateEmployeeMock.mockRejectedValue(
        new ApiError({
          type: "https://rivoo.com/errors/validation",
          title: "Validation",
          status: 400,
          detail: "El telefono no es valido",
          instance: "/api/v1/staff/employees/emp_1",
          timestamp: "2026-01-01T00:00:00Z",
          correlationId: "corr-2",
        })
      )

      renderSheet(mockEmployee)
      fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }))

      await waitFor(() => expect(toastError).toHaveBeenCalledWith("El telefono no es valido"))
    })
  })

  describe("width branches of the container (D17)", () => {
    it("mounts as a bottom sheet with the plain (borderless) close button on mobile", () => {
      mockMatchMedia(false)
      renderSheet(null)

      const closeButton = screen.getByRole("button", { name: "Cerrar" })
      expect(closeButton.className).not.toContain("border-border")
    })

    it("mounts as a centered dialog with the bordered close button on desktop", () => {
      mockMatchMedia(true)
      renderSheet(null)

      const closeButton = screen.getByRole("button", { name: "Cerrar" })
      expect(closeButton.className).toContain("border-border")
    })
  })
})
