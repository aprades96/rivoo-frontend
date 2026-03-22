"use client"

import { create } from "zustand"
import type { ServiceOffering } from "@/types/service"

export interface PublicBookingState {
  step: number
  salonSlug: string
  selectedService: ServiceOffering | null
  selectedEmployeeId: string | null
  anyEmployee: boolean
  selectedDate: string | null
  selectedSlot: string | null
  clientForm: {
    firstName: string
    lastName: string
    email: string
    phone: string
    gdprConsent: boolean
  }
  honeypot: string

  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  setSalonSlug: (slug: string) => void
  selectService: (service: ServiceOffering) => void
  selectEmployee: (id: string | null, any: boolean) => void
  selectDateTime: (date: string, slot: string) => void
  setClientForm: (data: Partial<PublicBookingState["clientForm"]>) => void
  setHoneypot: (value: string) => void
  reset: () => void
}

const INITIAL_CLIENT = { firstName: "", lastName: "", email: "", phone: "", gdprConsent: false }

const INITIAL_STATE = {
  step: 1,
  salonSlug: "",
  selectedService: null,
  selectedEmployeeId: null,
  anyEmployee: true,
  selectedDate: null,
  selectedSlot: null,
  clientForm: INITIAL_CLIENT,
  honeypot: "",
}

export const usePublicBookingStore = create<PublicBookingState>((set) => ({
  ...INITIAL_STATE,

  setStep: (step) => set({ step }),
  nextStep: () => set((s) => ({ step: Math.min(s.step + 1, 5) })),
  prevStep: () => set((s) => ({ step: Math.max(s.step - 1, 1) })),
  setSalonSlug: (slug) => set({ salonSlug: slug }),

  selectService: (service) =>
    set({ selectedService: service, selectedDate: null, selectedSlot: null }),

  selectEmployee: (id, any) =>
    set({ selectedEmployeeId: id, anyEmployee: any, selectedDate: null, selectedSlot: null }),

  selectDateTime: (date, slot) => set({ selectedDate: date, selectedSlot: slot }),

  setClientForm: (data) =>
    set((s) => ({ clientForm: { ...s.clientForm, ...data } })),

  setHoneypot: (value) => set({ honeypot: value }),

  reset: () => set(INITIAL_STATE),
}))
