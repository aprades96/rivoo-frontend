"use client"

import { create } from "zustand"

interface OnboardingState {
  currentStep: number
  totalSteps: number
  salonId: string | null
  setCurrentStep: (step: number) => void
  setSalonId: (id: string) => void
  nextStep: () => void
  prevStep: () => void
  reset: () => void
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  currentStep: 1,
  totalSteps: 6,
  salonId: null,
  setCurrentStep: (step) => set({ currentStep: step }),
  setSalonId: (id) => set({ salonId: id }),
  nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, state.totalSteps) })),
  prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 1) })),
  reset: () => set({ currentStep: 1, salonId: null }),
}))
