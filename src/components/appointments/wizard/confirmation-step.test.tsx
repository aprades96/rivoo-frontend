import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ConfirmationStep } from "./confirmation-step"
import { useWizardStore } from "@/lib/stores/wizard-store"
import { useEmployees } from "@/hooks/use-staff"
import type { Employee } from "@/types/employee"
import type { ServiceOffering } from "@/types/service"
import type { Client } from "@/types/client"
import type { Appointment } from "@/types/appointment"

vi.mock("@/hooks/use-staff", () => ({ useEmployees: vi.fn() }))
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ accessToken: "token" }),
}))

const push = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: (...args: unknown[]) => push(...args) }),
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args), error: (...args: unknown[]) => toastError(...args) },
}))

const createAppointment = vi.fn()
vi.mock("@/lib/api/appointments", () => ({
  appointmentsApi: { create: (...args: unknown[]) => createAppointment(...args) },
}))

const createClient = vi.fn()
vi.mock("@/lib/api/clients", () => ({
  clientsApi: { create: (...args: unknown[]) => createClient(...args) },
}))

const mockUseEmployees = vi.mocked(useEmployees)

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

const employee: Employee = {
  id: "emp_1",
  firstName: "Laura",
  lastName: "Martinez",
  email: "laura@example.com",
  phone: null,
  jobTitle: "Estilista",
  colorHex: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00",
}

const anyEmployeeSlotOwner: Employee = {
  id: "emp_2",
  firstName: "Sofia",
  lastName: "Ruiz",
  email: "sofia@example.com",
  phone: null,
  jobTitle: "Estilista",
  colorHex: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00",
}

const service: ServiceOffering = {
  id: "svc_1",
  name: "Corte + Tinte",
  description: null,
  durationMinutes: 90,
  price: 65,
  category: null,
  isActive: true,
}

const client: Client = {
  id: "cli_1",
  firstName: "Ana",
  lastName: "Garcia",
  email: "ana@example.com",
  phone: "612345678",
  gender: null,
  notes: null,
  source: null,
  totalVisits: 3,
  lastVisitAt: null,
  gdprConsentAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}

const createdAppointment: Appointment = {
  id: "apt_1",
  tenantId: "tenant_1",
  clientId: client.id,
  clientName: "Ana Garcia",
  clientPhone: client.phone,
  clientEmail: client.email,
  employeeId: employee.id,
  employeeName: "Laura Martinez",
  serviceId: service.id,
  serviceName: service.name,
  servicePrice: service.price,
  serviceDurationMinutes: service.durationMinutes,
  startTime: "2026-08-26T11:00:00",
  endTime: "2026-08-26T12:30:00",
  status: "PENDING",
  source: "MANUAL",
  notes: null,
  reminderSent: false,
  createdAt: "2026-08-27T00:00:00",
  updatedAt: "2026-08-27T00:00:00",
}

function renderStep() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ConfirmationStep />
    </QueryClientProvider>
  )
  return { ...view, queryClient, invalidateSpy }
}

function seedStore(overrides: Partial<ReturnType<typeof useWizardStore.getState>> = {}) {
  useWizardStore.getState().reset()
  useWizardStore.setState({
    selectedEmployee: employee,
    anyEmployee: false,
    selectedService: service,
    // 2026-08-26 es MIERCOLES de verdad (no un dato inventado): la prueba de
    // la tilde necesita que `formatDateLong` produzca "Miércoles", y eso solo
    // pasa si la fecha semilla es un miercoles real.
    selectedDate: "2026-08-26",
    selectedSlot: "2026-08-26T11:00:00",
    selectedSlotEmployeeId: employee.id,
    selectedClient: client,
    newClientData: null,
    notes: "",
    ...overrides,
  })
}

describe("ConfirmationStep", () => {
  beforeEach(() => {
    mockMatchMedia(false)
    mockUseEmployees.mockReturnValue({ data: { content: [employee, anyEmployeeSlotOwner] } } as unknown as ReturnType<
      typeof useEmployees
    >)
    createAppointment.mockReset().mockResolvedValue(createdAppointment)
    createClient.mockReset()
    push.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
    seedStore()
  })

  afterEach(() => {
    mockMatchMedia(false)
  })

  it("pinta el rango horario y la fecha larga CON tilde", () => {
    renderStep()

    expect(screen.getByText("11:00 - 12:30")).toBeInTheDocument()
    // `formatDateLong` acentua "Miércoles" -- el artboard lo dibuja sin tilde
    // por convencion de dibujo, copiar ese literal no encontraria nada.
    expect(screen.getByText("Miércoles, 26 de agosto")).toBeInTheDocument()
  })

  it("en movil pinta la pildora 'Pendiente'", () => {
    mockMatchMedia(false)
    renderStep()

    expect(screen.getByText("Pendiente")).toBeInTheDocument()
    expect(screen.queryByText("Se creará como Pendiente")).not.toBeInTheDocument()
  })

  it("en escritorio pinta la pildora 'Se creará como Pendiente'", () => {
    mockMatchMedia(true)
    renderStep()

    expect(screen.getByText("Se creará como Pendiente")).toBeInTheDocument()
    expect(screen.queryByText("Pendiente")).not.toBeInTheDocument()
  })

  it("crear con cliente existente manda su clientId, email, telefono y notas", async () => {
    const user = userEvent.setup()
    seedStore({ notes: "Alergica al amoniaco" })
    renderStep()

    await user.click(screen.getByRole("button", { name: "Crear cita" }))

    await waitFor(() => expect(createAppointment).toHaveBeenCalled())
    expect(createClient).not.toHaveBeenCalled()
    expect(createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: client.id,
        employeeId: employee.id,
        clientEmail: client.email,
        clientPhone: client.phone,
        notes: "Alergica al amoniaco",
      }),
      "token"
    )
  })

  it("crear con cliente nuevo lo crea antes y manda su id, email y telefono", async () => {
    const user = userEvent.setup()
    createClient.mockResolvedValue({ ...client, id: "cli_new", email: "marta@example.com", phone: "699111222" })
    seedStore({
      selectedClient: null,
      newClientData: { firstName: "Marta", lastName: "Ruiz", email: "marta@example.com", phone: "699111222" },
    })
    renderStep()

    await user.click(screen.getByRole("button", { name: "Crear cita" }))

    await waitFor(() => expect(createClient).toHaveBeenCalled())
    await waitFor(() => expect(createAppointment).toHaveBeenCalled())
    expect(createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "cli_new",
        clientEmail: "marta@example.com",
        clientPhone: "699111222",
      }),
      "token"
    )
  })

  it("con cliente ya elegido no crea cliente aunque tambien haya datos de alta pendientes", async () => {
    // Combinacion que el store nunca produce por si solo (`selectClient` y
    // `setNewClientData` se pisan mutuamente), pero que mata la mutacion de
    // quitar el `!clientId` de la guarda: sin el, un `newClientData` presente
    // dispararia el POST de alta aunque ya hubiera un cliente elegido.
    const user = userEvent.setup()
    seedStore({
      selectedClient: client,
      newClientData: { firstName: "Marta", lastName: "Ruiz", email: "", phone: "" },
    })
    renderStep()

    await user.click(screen.getByRole("button", { name: "Crear cita" }))

    await waitFor(() => expect(createAppointment).toHaveBeenCalled())
    expect(createClient).not.toHaveBeenCalled()
  })

  it("un reintento tras fallar la cita no vuelve a crear el cliente nuevo", async () => {
    const user = userEvent.setup()
    createClient.mockResolvedValue({ ...client, id: "cli_new", firstName: "Marta", lastName: "Ruiz" })
    createAppointment.mockReset().mockRejectedValue(new Error("boom"))
    seedStore({
      selectedClient: null,
      newClientData: { firstName: "Marta", lastName: "Ruiz", email: "", phone: "699111222" },
    })
    renderStep()

    await user.click(screen.getByRole("button", { name: "Crear cita" }))
    await screen.findByText("Error al crear la cita. Puede que el hueco ya no esté disponible.")
    expect(createClient).toHaveBeenCalledTimes(1)
    // El cliente creado en el primer intento debe haber quedado persistido en
    // el store -- si no, el reintento lo volveria a crear.
    await waitFor(() => expect(useWizardStore.getState().selectedClient?.id).toBe("cli_new"))

    await user.click(screen.getByRole("button", { name: "Crear cita" }))
    await waitFor(() => expect(createAppointment).toHaveBeenCalledTimes(2))

    expect(createClient).toHaveBeenCalledTimes(1)
    expect(createAppointment).toHaveBeenLastCalledWith(
      expect.objectContaining({ clientId: "cli_new" }),
      "token"
    )
  })

  it("al crear con exito: toast, invalida cache, resetea el store y navega a /today", async () => {
    const user = userEvent.setup()
    const { invalidateSpy } = renderStep()

    await user.click(screen.getByRole("button", { name: "Crear cita" }))

    await waitFor(() => expect(push).toHaveBeenCalledWith("/today"))
    expect(toastSuccess).toHaveBeenCalledWith("Cita creada correctamente")
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["appointments"] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["clients"] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["availability"] })
    // `reset()` debe haber vaciado el store del asistente.
    expect(useWizardStore.getState().selectedService).toBeNull()
    expect(useWizardStore.getState().selectedClient).toBeNull()
  })

  it("mientras la mutacion esta en vuelo el CTA se deshabilita y dice 'Creando cita...'", async () => {
    const user = userEvent.setup()
    let resolveCreate!: (value: typeof createdAppointment) => void
    createAppointment.mockReset().mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve
      })
    )
    renderStep()

    await user.click(screen.getByRole("button", { name: "Crear cita" }))

    const pendingButton = await screen.findByRole("button", { name: "Creando cita..." })
    expect(pendingButton).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Crear cita" })).not.toBeInTheDocument()

    resolveCreate(createdAppointment)
    await waitFor(() => expect(push).toHaveBeenCalled())
  })

  it("en escritorio el aside lleva la cabecera 'Resumen'", () => {
    mockMatchMedia(true)
    renderStep()

    expect(screen.getByText("Resumen")).toBeInTheDocument()
  })

  it("con 'Sin preferencia' el aside nombra al dueno del hueco, no 'Sin preferencia'", async () => {
    mockMatchMedia(true)
    seedStore({
      selectedEmployee: null,
      anyEmployee: true,
      selectedSlotEmployeeId: anyEmployeeSlotOwner.id,
    })
    renderStep()

    const asideRoot = screen.getByText("Resumen").closest("div")
    if (!asideRoot) throw new Error("aside root not found")

    expect(within(asideRoot).getByText("Sofia Ruiz")).toBeInTheDocument()
    expect(within(asideRoot).queryByText("Sin preferencia")).not.toBeInTheDocument()
  })

  it("un fallo deja el paso en pie con el mensaje", async () => {
    const user = userEvent.setup()
    createAppointment.mockReset().mockRejectedValue(new Error("boom"))
    renderStep()

    await user.click(screen.getByRole("button", { name: "Crear cita" }))

    await screen.findByText("Error al crear la cita. Puede que el hueco ya no esté disponible.")
    expect(screen.getByRole("button", { name: "Crear cita" })).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it("el employeeId enviado es el del hueco cuando se eligio 'Sin preferencia'", async () => {
    const user = userEvent.setup()
    seedStore({
      selectedEmployee: null,
      anyEmployee: true,
      selectedSlotEmployeeId: anyEmployeeSlotOwner.id,
    })
    renderStep()

    await user.click(screen.getByRole("button", { name: "Crear cita" }))

    await waitFor(() => expect(createAppointment).toHaveBeenCalled())
    expect(createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: anyEmployeeSlotOwner.id }),
      "token"
    )
  })
})
