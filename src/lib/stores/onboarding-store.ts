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

/**
 * Ancho de la tarjeta del chasis en escritorio, por paso. Son dos plantillas
 * (640px / 760px), no un ancho unico: verificado en los cinco artboards
 * `design/Onboarding{1..5}Desktop.dc.html`.
 */
export function onboardingCardMaxWidthClass(step: number): string {
  return step === 2 || step === 3 || step === 4 ? "md:max-w-[760px]" : "md:max-w-[640px]"
}
