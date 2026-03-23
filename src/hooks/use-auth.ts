"use client"

import { useEffect } from "react"
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

  // Dead session: authenticated but token gone (refresh failed) → force re-login
  useEffect(() => {
    if (isAuthenticated && session && !session.accessToken) {
      signIn("keycloak", { callbackUrl: window.location.pathname })
    }
  }, [isAuthenticated, session])

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

  const login = (salonSlug?: string) =>
    signIn("keycloak", { callbackUrl: "/today" }, salonSlug ? { salon_slug: salonSlug } : {})
  const logout = async () => {
    const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL
    await signOut({ redirect: false })
    window.location.href = `${keycloakUrl}/realms/rivoo/protocol/openid-connect/logout?post_logout_redirect_uri=${encodeURIComponent(window.location.origin + "/login")}&client_id=salon-frontend`
  }

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
