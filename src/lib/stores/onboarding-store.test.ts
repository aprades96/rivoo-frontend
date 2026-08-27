import { describe, it, expect, beforeEach } from "vitest"
import { useOnboardingStore } from "./onboarding-store"

describe("onboarding-store", () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset()
  })

  it("starts at step 1 with 5 total steps", () => {
    const state = useOnboardingStore.getState()
    expect(state.currentStep).toBe(1)
    expect(state.totalSteps).toBe(5)
  })

  it("nextStep increments, caps at totalSteps", () => {
    const store = useOnboardingStore
    store.getState().nextStep()
    expect(store.getState().currentStep).toBe(2)

    store.getState().setCurrentStep(5)
    store.getState().nextStep()
    expect(store.getState().currentStep).toBe(5)
  })

  it("prevStep decrements, caps at 1", () => {
    const store = useOnboardingStore
    store.getState().setCurrentStep(3)
    store.getState().prevStep()
    expect(store.getState().currentStep).toBe(2)

    store.getState().setCurrentStep(1)
    store.getState().prevStep()
    expect(store.getState().currentStep).toBe(1)
  })

  it("reset returns to step 1", () => {
    const store = useOnboardingStore
    store.getState().setCurrentStep(4)
    store.getState().reset()
    expect(store.getState().currentStep).toBe(1)
  })
})
