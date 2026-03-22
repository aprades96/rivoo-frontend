"use client"

import { useSession, signIn, signOut } from "next-auth/react"
import type { UserRole } from "@/types/auth"

export interface AuthUser {
  id: string
  name: string
  email: string
  tenantId: string
  role: UserRole
  subscriptionPlan: string
}

export function useAuth() {
  const { data: session, status } = useSession()

  const isAuthenticated = status === "authenticated"
  const isLoading = status === "loading"

  const user: AuthUser | null = isAuthenticated && session?.user
    ? {
        id: session.user.id,
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        tenantId: session.user.tenantId,
        role: session.user.role as UserRole,
        subscriptionPlan: session.user.subscriptionPlan,
      }
    : null

  const accessToken: string | null = isAuthenticated
    ? session?.accessToken ?? null
    : null

  const isOwner = user?.role === "ROLE_SALON_OWNER"
  const isEmployee = user?.role === "ROLE_EMPLOYEE"
  const isAdmin = user?.role === "ROLE_PLATFORM_ADMIN"

  const login = () => signIn("keycloak", { callbackUrl: "/today" })
  const logout = () => signOut({ callbackUrl: "/login" })

  return {
    user,
    accessToken,
    isAuthenticated,
    isLoading,
    isOwner,
    isEmployee,
    isAdmin,
    login,
    logout,
    status,
  }
}
