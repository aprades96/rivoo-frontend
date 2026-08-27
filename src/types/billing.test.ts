import { describe, it, expect } from "vitest"
import type { PlanName, SubscriptionStatus, Subscription, PlanInfo } from "./billing"

describe("billing types", () => {
  it("PlanName enum values are correct", () => {
    const plans: PlanName[] = ["FREE_TRIAL", "BASIC", "PREMIUM", "ENTERPRISE"]
    expect(plans).toHaveLength(4)
  })

  it("SubscriptionStatus enum values are correct", () => {
    const statuses: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED", "EXPIRED"]
    expect(statuses).toHaveLength(5)
  })

  it("Subscription shape is valid", () => {
    const sub: Subscription = {
      id: "sub_1",
      tenantId: "tenant_1",
      planName: "BASIC",
      status: "ACTIVE",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_stripe_123",
      trialStart: null,
      trialEnd: null,
      currentPeriodStart: "2026-03-01T00:00:00Z",
      currentPeriodEnd: "2026-04-01T00:00:00Z",
      createdAt: "2026-01-01T00:00:00Z",
    }
    expect(sub.planName).toBe("BASIC")
    expect(sub.status).toBe("ACTIVE")
    expect(sub.stripeCustomerId).toBe("cus_123")
  })

  it("PlanInfo shape is valid", () => {
    const plan: PlanInfo = {
      id: "pln_1",
      name: "BASIC",
      displayName: "Rivoo Basic",
      monthlyPrice: 29,
    }
    expect(plan.monthlyPrice).toBe(29)
  })
})
