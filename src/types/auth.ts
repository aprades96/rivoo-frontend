export type UserRole = "ROLE_PLATFORM_ADMIN" | "ROLE_SALON_OWNER" | "ROLE_EMPLOYEE"

export interface UserSession {
  id: string
  name: string
  email: string
  tenantId: string
  role: UserRole
  subscriptionPlan: string
}
