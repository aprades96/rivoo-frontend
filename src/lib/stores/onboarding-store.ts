"use client"

import { create } from "zustand"

interface OnboardingState {
  currentStep: number
  totalSteps: number
  setCurrentStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  reset: () => void
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  currentStep: 1,
  totalSteps: 5,
  setCurrentStep: (step) => set({ currentStep: step }),
  nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, state.totalSteps) })),
  prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 1) })),
  reset: () => set({ currentStep: 1 }),
}))
