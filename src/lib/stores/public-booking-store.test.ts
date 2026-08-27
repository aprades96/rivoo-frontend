import { describe, it, expect, beforeEach } from "vitest"
import { usePublicBookingStore } from "./public-booking-store"
import type { ServicePublic } from "@/types/salon"

const mockService: ServicePublic = {
  id: "svc_1",
  name: "Corte hombre",
  description: null,
  durationMinutes: 30,
  price: 15,
  currency: "EUR",
}

describe("public-booking-store", () => {
  beforeEach(() => {
    usePublicBookingStore.getState().reset()
  })

  it("starts at step 1 with empty state", () => {
    const state = usePublicBookingStore.getState()
    expect(state.step).toBe(1)
    expect(state.selectedService).toBeNull()
    expect(state.selectedDate).toBeNull()
    expect(state.clientForm.firstName).toBe("")
    expect(state.honeypot).toBe("")
  })

  it("step navigation works", () => {
    const store = usePublicBookingStore
    store.getState().nextStep()
    expect(store.getState().step).toBe(2)
    store.getState().nextStep()
    expect(store.getState().step).toBe(3)
    store.getState().prevStep()
    expect(store.getState().step).toBe(2)
  })

  it("nextStep increments and caps at step 6", () => {
    const store = usePublicBookingStore
    store.getState().setStep(5)
    store.getState().nextStep()
    expect(store.getState().step).toBe(6)

    store.getState().nextStep()
    expect(store.getState().step).toBe(6)
  })

  it("prevStep decrements and caps at step 1", () => {
    const store = usePublicBookingStore
    store.getState().setStep(2)
    store.getState().prevStep()
    expect(store.getState().step).toBe(1)

    store.getState().prevStep()
    expect(store.getState().step).toBe(1)
  })

  it("selectService resets date and slot", () => {
    const store = usePublicBookingStore
    store.getState().selectDateTime("2026-04-01", "10:00")
    expect(store.getState().selectedDate).toBe("2026-04-01")

    store.getState().selectService(mockService)
    expect(store.getState().selectedService?.id).toBe("svc_1")
    expect(store.getState().selectedDate).toBeNull()
    expect(store.getState().selectedSlot).toBeNull()
  })

  it("selectEmployee resets date and slot", () => {
    const store = usePublicBookingStore
    store.getState().selectDateTime("2026-04-01", "10:00")

    store.getState().selectEmployee("emp_1", false)
    expect(store.getState().selectedEmployeeId).toBe("emp_1")
    expect(store.getState().anyEmployee).toBe(false)
    expect(store.getState().selectedDate).toBeNull()
  })

  it("setClientForm merges partial data", () => {
    const store = usePublicBookingStore
    store.getState().setClientForm({ firstName: "Ana" })
    store.getState().setClientForm({ lastName: "Lopez" })

    const form = store.getState().clientForm
    expect(form.firstName).toBe("Ana")
    expect(form.lastName).toBe("Lopez")
    expect(form.email).toBe("") // unchanged
  })

  it("honeypot field works", () => {
    const store = usePublicBookingStore
    store.getState().setHoneypot("bot-value")
    expect(store.getState().honeypot).toBe("bot-value")
  })

  it("reset clears step, service, employee, date, and client form", () => {
    const store = usePublicBookingStore
    store.getState().setStep(4)
    store.getState().selectService(mockService)
    store.getState().selectEmployee("emp_123", false)
    store.getState().selectDateTime("2026-04-01", "10:00")
    store.getState().setClientForm({ firstName: "Test" })
    store.getState().setHoneypot("spam")

    store.getState().reset()
    const state = store.getState()
    expect(state.step).toBe(1)
    expect(state.selectedService).toBeNull()
    expect(state.selectedEmployeeId).toBeNull()
    expect(state.anyEmployee).toBe(true)
    expect(state.selectedDate).toBeNull()
    expect(state.selectedSlot).toBeNull()
    expect(state.clientForm.firstName).toBe("")
    expect(state.honeypot).toBe("")
  })
})
