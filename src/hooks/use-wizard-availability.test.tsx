import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useWizardAvailability } from "./use-wizard-availability"
import type { AvailabilityResponse } from "@/types/appointment"

const useAuthMock = vi.fn()

vi.mock("@/hooks/use-auth", () => ({
  useAuth: (...args: unknown[]) => useAuthMock(...args),
}))

const getAvailability = vi.fn()

vi.mock("@/lib/api/appointments", () => ({
  appointmentsApi: {
    getAvailability: (...args: unknown[]) => getAvailability(...args),
  },
}))

const DATE = "2026-08-28"

function availability(employeeId: string, ...startTimes: string[]): AvailabilityResponse {
  return {
    date: DATE,
    employeeId,
    slots: startTimes.map((startTime) => ({ startTime, endTime: startTime })),
  }
}

const AVAILABILITY: Record<string, AvailabilityResponse> = {
  emp_1: availability("emp_1", "09:00:00", "11:00:00"),
  emp_2: availability("emp_2", "10:00:00", "11:00:00"),
}

/** Escribe la union de huecos, cada uno con SU `employeeId` -- lo asertable. */
function Probe({ employeeIds }: { employeeIds: string[] }) {
  const { slots, isLoading, isError } = useWizardAvailability({
    employeeIds,
    serviceId: "svc_1",
    date: DATE,
  })

  return (
    <ul>
      {slots.map((slot) => (
        <li key={slot.startTime}>{`${slot.startTime} -> ${slot.employeeId}`}</li>
      ))}
      <li>{`cargando: ${isLoading}`}</li>
      <li>{`error: ${isError}`}</li>
    </ul>
  )
}

function renderProbe(employeeIds: string[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Probe employeeIds={employeeIds} />
    </QueryClientProvider>
  )
}

describe("useWizardAvailability", () => {
  beforeEach(() => {
    useAuthMock.mockReset()
    useAuthMock.mockReturnValue({ accessToken: "token", isAuthenticated: true })
    getAvailability.mockReset()
    getAvailability.mockImplementation(({ employeeId }: { employeeId: string }) =>
      AVAILABILITY[employeeId]
        ? Promise.resolve(AVAILABILITY[employeeId])
        : Promise.reject(new Error("sin disponibilidad"))
    )
  })

  it("une los huecos de varios empleados y los ordena por startTime", async () => {
    renderProbe(["emp_1", "emp_2"])

    // `findBy*`, no una afirmacion sincrona (AGENTS.md: `notifyManager`
    // notifica en un macrotask).
    expect(await screen.findByText("09:00:00 -> emp_1")).toBeInTheDocument()

    const items = screen.getAllByRole("listitem").map((li) => li.textContent)
    expect(items.slice(0, 3)).toEqual(["09:00:00 -> emp_1", "10:00:00 -> emp_2", "11:00:00 -> emp_1"])
  })

  it("en un empate a la misma hora, se queda con el PRIMERO de la lista", async () => {
    // emp_1 y emp_2 comparten el hueco de las 11:00 -- solo debe sobrevivir
    // una entrada, atribuida a emp_1 por ir primero en `employeeIds`.
    renderProbe(["emp_1", "emp_2"])

    await screen.findByText("09:00:00 -> emp_1")

    expect(screen.getByText("11:00:00 -> emp_1")).toBeInTheDocument()
    expect(screen.queryByText("11:00:00 -> emp_2")).not.toBeInTheDocument()
  })

  it("el mismo empate, con el orden de la lista invertido, se lo lleva emp_2", async () => {
    renderProbe(["emp_2", "emp_1"])

    await screen.findByText("09:00:00 -> emp_1")

    expect(screen.getByText("11:00:00 -> emp_2")).toBeInTheDocument()
    expect(screen.queryByText("11:00:00 -> emp_1")).not.toBeInTheDocument()
  })

  it("un empleado cuya peticion falla no tumba la union del resto", async () => {
    renderProbe(["emp_1", "emp_roto"])

    expect(await screen.findByText("error: true")).toBeInTheDocument()
    expect(screen.getByText("09:00:00 -> emp_1")).toBeInTheDocument()
    expect(screen.getByText("11:00:00 -> emp_1")).toBeInTheDocument()
  })

  it("no pide nada sin sesion", () => {
    useAuthMock.mockReturnValue({ accessToken: null, isAuthenticated: false })

    renderProbe(["emp_1"])

    expect(getAvailability).not.toHaveBeenCalled()
  })
})
