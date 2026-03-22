import { describe, it, expect, beforeEach } from "vitest"
import { useWizardStore } from "./wizard-store"
import type { Employee } from "@/types/employee"
import type { ServiceOffering } from "@/types/service"
import type { Client } from "@/types/client"

const mockEmployee: Employee = {
  id: "emp_1",
  firstName: "Carlos",
  lastName: "Garcia",
  email: "carlos@test.com",
  phone: null,
  jobTitle: "Barbero",
  colorHex: "#3B82F6",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
}

const mockService: ServiceOffering = {
  id: "svc_1",
  name: "Corte hombre",
  description: null,
  durationMinutes: 30,
  price: 15,
  category: null,
  isActive: true,
}

const mockClient: Client = {
  id: "cli_1",
  firstName: "Ana",
  lastName: "Lopez",
  email: "ana@test.com",
  phone: "612345678",
  gender: null,
  dateOfBirth: null,
  notes: null,
  source: null,
  totalVisits: 3,
  lastVisitAt: null,
  gdprConsentAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}

describe("wizard-store", () => {
  beforeEach(() => {
    useWizardStore.getState().reset()
  })

  it("starts at step 1 with null selections", () => {
    const state = useWizardStore.getState()
    expect(state.step).toBe(1)
    expect(state.selectedEmployee).toBeNull()
    expect(state.selectedService).toBeNull()
    expect(state.selectedDate).toBeNull()
    expect(state.selectedSlot).toBeNull()
    expect(state.selectedClient).toBeNull()
  })

  it("nextStep increments, prevStep decrements", () => {
    const store = useWizardStore
    store.getState().nextStep()
    expect(store.getState().step).toBe(2)
    store.getState().nextStep()
    expect(store.getState().step).toBe(3)
    store.getState().prevStep()
    expect(store.getState().step).toBe(2)
  })

  it("nextStep caps at 5, prevStep caps at 1", () => {
    const store = useWizardStore
    store.getState().setStep(5)
    store.getState().nextStep()
    expect(store.getState().step).toBe(5)

    store.getState().setStep(1)
    store.getState().prevStep()
    expect(store.getState().step).toBe(1)
  })

  it("selectEmployee resets downstream selections", () => {
    const store = useWizardStore
    // Set up all selections
    store.getState().selectEmployee(mockEmployee)
    store.getState().selectService(mockService)
    store.getState().selectDateTime("2026-03-25", "10:00")

    // Change employee → service, date, slot should reset
    const otherEmployee = { ...mockEmployee, id: "emp_2", firstName: "Maria" }
    store.getState().selectEmployee(otherEmployee)

    const state = store.getState()
    expect(state.selectedEmployee?.id).toBe("emp_2")
    expect(state.selectedService).toBeNull()
    expect(state.selectedDate).toBeNull()
    expect(state.selectedSlot).toBeNull()
  })

  it("selectService resets date and slot but keeps employee", () => {
    const store = useWizardStore
    store.getState().selectEmployee(mockEmployee)
    store.getState().selectService(mockService)
    store.getState().selectDateTime("2026-03-25", "10:00")

    const otherService = { ...mockService, id: "svc_2", name: "Tinte" }
    store.getState().selectService(otherService)

    const state = store.getState()
    expect(state.selectedEmployee?.id).toBe("emp_1")
    expect(state.selectedService?.id).toBe("svc_2")
    expect(state.selectedDate).toBeNull()
    expect(state.selectedSlot).toBeNull()
  })

  it("selectClient clears newClientData", () => {
    const store = useWizardStore
    store.getState().setNewClientData({
      firstName: "Nuevo",
      lastName: "Cliente",
      email: "",
      phone: "",
    })
    expect(store.getState().newClientData).not.toBeNull()

    store.getState().selectClient(mockClient)
    const state = store.getState()
    expect(state.selectedClient?.id).toBe("cli_1")
    expect(state.newClientData).toBeNull()
  })

  it("setNewClientData clears selectedClient", () => {
    const store = useWizardStore
    store.getState().selectClient(mockClient)
    expect(store.getState().selectedClient).not.toBeNull()

    store.getState().setNewClientData({
      firstName: "Nuevo",
      lastName: "Cliente",
      email: "",
      phone: "",
    })
    const state = store.getState()
    expect(state.selectedClient).toBeNull()
    expect(state.newClientData?.firstName).toBe("Nuevo")
  })

  it("reset returns to initial state", () => {
    const store = useWizardStore
    store.getState().selectEmployee(mockEmployee)
    store.getState().selectService(mockService)
    store.getState().setStep(4)
    store.getState().setNotes("test notes")

    store.getState().reset()
    const state = store.getState()
    expect(state.step).toBe(1)
    expect(state.selectedEmployee).toBeNull()
    expect(state.selectedService).toBeNull()
    expect(state.notes).toBe("")
  })

  it("anyEmployee flag works", () => {
    const store = useWizardStore
    store.getState().selectEmployee(null, true)
    const state = store.getState()
    expect(state.selectedEmployee).toBeNull()
    expect(state.anyEmployee).toBe(true)
  })
})
