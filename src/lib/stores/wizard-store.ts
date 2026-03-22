"use client"

import { create } from "zustand"
import type { Employee } from "@/types/employee"
import type { ServiceOffering } from "@/types/service"
import type { Client } from "@/types/client"

export interface WizardState {
  step: number
  selectedEmployee: Employee | null
  anyEmployee: boolean
  selectedService: ServiceOffering | null
  selectedDate: string | null
  selectedSlot: string | null
  selectedClient: Client | null
  newClientData: { firstName: string; lastName: string; email: string; phone: string } | null
  notes: string

  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  selectEmployee: (employee: Employee | null, any?: boolean) => void
  selectService: (service: ServiceOffering) => void
  selectDateTime: (date: string, slot: string) => void
  selectClient: (client: Client) => void
  setNewClientData: (data: WizardState["newClientData"]) => void
  setNotes: (notes: string) => void
  reset: () => void
}

const INITIAL_STATE = {
  step: 1,
  selectedEmployee: null,
  anyEmployee: false,
  selectedService: null,
  selectedDate: null,
  selectedSlot: null,
  selectedClient: null,
  newClientData: null,
  notes: "",
}

export const useWizardStore = create<WizardState>((set) => ({
  ...INITIAL_STATE,

  setStep: (step) => set({ step }),
  nextStep: () => set((s) => ({ step: Math.min(s.step + 1, 5) })),
  prevStep: () => set((s) => ({ step: Math.max(s.step - 1, 1) })),

  selectEmployee: (employee, any = false) =>
    set({
      selectedEmployee: employee,
      anyEmployee: any,
      // Reset downstream selections when employee changes
      selectedService: null,
      selectedDate: null,
      selectedSlot: null,
    }),

  selectService: (service) =>
    set({
      selectedService: service,
      // Reset downstream
      selectedDate: null,
      selectedSlot: null,
    }),

  selectDateTime: (date, slot) =>
    set({ selectedDate: date, selectedSlot: slot }),

  selectClient: (client) =>
    set({ selectedClient: client, newClientData: null }),

  setNewClientData: (data) =>
    set({ newClientData: data, selectedClient: null }),

  setNotes: (notes) => set({ notes }),

  reset: () => set(INITIAL_STATE),
}))
