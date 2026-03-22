import { apiFetch } from "./client"
import type {
  Subscription,
  PlanInfo,
  CheckoutRequest,
  CheckoutResponse,
} from "@/types/billing"

export const billingApi = {
  getSubscription: (token: string) =>
    apiFetch<Subscription>("/api/v1/billing/subscription", { token }),

  getPlans: () =>
    apiFetch<PlanInfo[]>("/api/v1/billing/plans"),

  createCheckoutSession: (data: CheckoutRequest, token: string) =>
    apiFetch<CheckoutResponse>("/api/v1/billing/checkout-session", {
      method: "POST",
      body: data,
      token,
    }),

  createPortalSession: (token: string) =>
    apiFetch<{ url: string }>("/api/v1/billing/portal", { method: "POST", token }),
}
