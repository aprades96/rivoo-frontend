import { describe, it, expect, beforeEach } from "vitest"
import { useOnboardingStore } from "./onboarding-store"

describe("onboarding-store", () => {
  beforeEach(() => {
    useOnboardingStore.getState().reset()
  })

  it("starts at step 1 with 6 total steps", () => {
    const state = useOnboardingStore.getState()
    expect(state.currentStep).toBe(1)
    expect(state.totalSteps).toBe(6)
    expect(state.salonId).toBeNull()
  })

  it("nextStep increments, caps at totalSteps", () => {
    const store = useOnboardingStore
    store.getState().nextStep()
    expect(store.getState().currentStep).toBe(2)

    store.getState().setCurrentStep(6)
    store.getState().nextStep()
    expect(store.getState().currentStep).toBe(6)
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

  it("setSalonId persists the ID", () => {
    useOnboardingStore.getState().setSalonId("sal_abc123")
    expect(useOnboardingStore.getState().salonId).toBe("sal_abc123")
  })

  it("reset clears everything", () => {
    const store = useOnboardingStore
    store.getState().setCurrentStep(4)
    store.getState().setSalonId("sal_xyz")
    store.getState().reset()

    const state = store.getState()
    expect(state.currentStep).toBe(1)
    expect(state.salonId).toBeNull()
  })
})
