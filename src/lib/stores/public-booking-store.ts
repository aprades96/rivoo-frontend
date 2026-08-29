"use client"

import { create } from "zustand"
import type { ServicePublic } from "@/types/salon"

export interface PublicBookingState {
  step: number
  salonSlug: string
  selectedService: ServicePublic | null
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
  /**
   * Hueco que se acaba de ocupar mientras el visitante confirmaba (409 del
   * backend). No es un septimo `step`: la barra de progreso movil tiene 6
   * tramos fijos y el stepper de escritorio 5 nodos, ninguno de los dos
   * artboards deja hueco para un paso extra. Un campo aparte deja intacto el
   * `step` con el que se dibujan ambos, y `page.tsx` decide con
   * `conflict != null` si pinta el asistente o la pantalla de error.
   */
  conflict: { slot: string; date: string } | null

  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  setSalonSlug: (slug: string) => void
  selectService: (service: ServicePublic) => void
  selectEmployee: (id: string | null, any: boolean) => void
  selectDateTime: (date: string, slot: string) => void
  setClientForm: (data: Partial<PublicBookingState["clientForm"]>) => void
  setHoneypot: (value: string) => void
  setConflict: (conflict: { slot: string; date: string }) => void
  clearConflict: () => void
  /** Descarta la fecha y hora elegidas sin tocar el resto de la reserva. */
  clearDateTime: () => void
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
  conflict: null,
}

export const usePublicBookingStore = create<PublicBookingState>((set) => ({
  ...INITIAL_STATE,

  setStep: (step) => set({ step }),
  nextStep: () => set((s) => ({ step: Math.min(s.step + 1, 6) })),
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

  setConflict: (conflict) => set({ conflict }),
  clearDateTime: () => set({ selectedDate: null, selectedSlot: null }),

  /**
   * Limpia SOLO el conflicto. Que hacer con el hueco muerto lo decide quien
   * sale de la pantalla, porque las dos salidas quieren cosas contrarias:
   * elegir una hora alternativa ya fija una valida y borrarsela despues seria
   * un error de orden; "elegir otro dia" tiene que descartarla con
   * `clearDateTime` (ver `public-booking-error.tsx`).
   */
  clearConflict: () => set({ conflict: null }),

  reset: () => set(INITIAL_STATE),
}))
