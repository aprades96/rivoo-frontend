export type PlanName = "FREE_TRIAL" | "BASIC" | "PREMIUM" | "ENTERPRISE"
export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED"

export interface Subscription {
  id: string
  tenantId: string
  planName: PlanName
  status: SubscriptionStatus
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  trialStart: string | null
  trialEnd: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  createdAt: string
  updatedAt: string
}

export interface PlanInfo {
  id: string
  name: string
  displayName: string
  monthlyPrice: number
}

export interface CheckoutRequest {
  planName: PlanName
}

export interface CheckoutResponse {
  checkoutUrl: string
  sessionId: string
}

export interface PlanLimitsResponse {
  planName: PlanName
  maxEmployees: number
  maxAppointmentsPerMonth: number
  emailRemindersEnabled: boolean
  smsRemindersEnabled: boolean
  currentEmployeeCount: number
  currentAppointmentCount: number
}
