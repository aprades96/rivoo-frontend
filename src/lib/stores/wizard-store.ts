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
  /** Empleado DUENO del hueco elegido en `selectDateTime`. `POST /appointments`
   * exige `employeeId`; con "Sin preferencia" ese id no sale de
   * `selectedEmployee` (sigue `null`) sino del hueco concreto que resolvio la
   * disponibilidad agregada de varios empleados. */
  selectedSlotEmployeeId: string | null
  selectedClient: Client | null
  newClientData: { firstName: string; lastName: string; email: string; phone: string } | null
  notes: string

  /** Id del empleado a preseleccionar cuando el asistente arranca con un
   * prefill. Vive aparte de `selectedEmployee` (que guarda el `Employee`
   * ENTERO) porque la lista de empleados llega de forma asincrona: el id
   * espera aqui hasta que la query resuelve y puede completarse el objeto. */
  preferredEmployeeId: string | null
  preferredDate: string | null
  preferredSlot: string | null
  /** Id del cliente a preseleccionar cuando el asistente arranca desde su
   * ficha (D26, `/clients/{id}` -> "Nueva cita"). Vive aparte de
   * `selectedClient` (que guarda el `Client` COMPLETO) por el mismo motivo
   * que `preferredEmployeeId`: `client-step.tsx` resuelve el objeto de forma
   * asincrona con `clientsApi.getById`, compartiendo cache con la ficha
   * (`["client", id]`). */
  preferredClientId: string | null

  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  selectEmployee: (employee: Employee | null, any?: boolean) => void
  selectService: (service: ServiceOffering) => void
  selectDateTime: (date: string, slot: string, employeeId: string) => void
  selectClient: (client: Client) => void
  setNewClientData: (data: WizardState["newClientData"]) => void
  setNotes: (notes: string) => void
  reset: (seed?: Partial<WizardState>) => void
}

const INITIAL_STATE = {
  step: 1,
  selectedEmployee: null,
  anyEmployee: false,
  selectedService: null,
  selectedDate: null,
  selectedSlot: null,
  selectedSlotEmployeeId: null,
  selectedClient: null,
  newClientData: null,
  notes: "",
  preferredEmployeeId: null,
  preferredDate: null,
  preferredSlot: null,
  preferredClientId: null,
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
      // La preferencia de prefill ya se ha consumido en cuanto el usuario
      // elige explicitamente un profesional (igual que `selectDateTime` con
      // fecha/hora): si no se limpia aqui, volver al paso 1 remonta
      // `EmployeeStep`, su efecto de prefill vuelve a leer
      // `preferredEmployeeId` y rebota otra vez al paso 2, atrapando al
      // usuario.
      preferredEmployeeId: null,
    }),

  selectService: (service) =>
    set({
      selectedService: service,
      // Reset downstream
      selectedDate: null,
      selectedSlot: null,
    }),

  selectDateTime: (date, slot, employeeId) =>
    set({
      selectedDate: date,
      selectedSlot: slot,
      selectedSlotEmployeeId: employeeId,
      // La preferencia de prefill ya se ha consumido en cuanto el usuario
      // elige explicitamente una fecha/hora.
      preferredEmployeeId: null,
      preferredDate: null,
      preferredSlot: null,
    }),

  selectClient: (client) =>
    set({
      selectedClient: client,
      newClientData: null,
      // La preferencia de prefill ya se ha consumido en cuanto hay un
      // cliente elegido -- mismo patron que `selectEmployee`/`selectDateTime`.
      // Sin limpiarla, volver al paso 4 desde el 5 (`onBack`) reengancharia el
      // efecto de resolucion de `client-step.tsx` y forzaria otra vez el
      // salto al paso 5, atrapando al usuario.
      preferredClientId: null,
    }),

  setNewClientData: (data) =>
    set({ newClientData: data, selectedClient: null }),

  setNotes: (notes) => set({ notes }),

  reset: (seed) => set({ ...INITIAL_STATE, ...seed }),
}))
