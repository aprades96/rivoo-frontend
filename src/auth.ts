import NextAuth from "next-auth"
import Keycloak from "next-auth/providers/keycloak"

declare module "next-auth" {
  interface Session {
    accessToken: string
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      tenantId: string
      role: string
      subscriptionPlan: string
    }
  }

  interface JWT {
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
    tenantId?: string
    role?: string
    subscriptionPlan?: string
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const base64 = token.split(".")[1]
  const json = Buffer.from(base64, "base64").toString("utf-8")
  return JSON.parse(json)
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET || "",
      issuer: process.env.AUTH_KEYCLOAK_ISSUER,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // First sign-in: persist tokens and extract custom Keycloak claims
      if (account?.access_token) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at

        const payload = decodeJwtPayload(account.access_token)
        token.tenantId = payload.tenant_id as string
        token.subscriptionPlan = payload.subscription_plan as string

        const roles = (payload.realm_access as { roles?: string[] })?.roles ?? []
        token.role = roles.find((r: string) => r.startsWith("ROLE_")) ?? "ROLE_EMPLOYEE"
      }

      // Token refresh: if expired, use refresh_token
      const expiresAt = token.expiresAt as number | undefined
      if (expiresAt && Date.now() / 1000 > expiresAt - 60) {
        try {
          const issuer = process.env.AUTH_KEYCLOAK_ISSUER!
          const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              client_id: process.env.AUTH_KEYCLOAK_ID!,
              refresh_token: token.refreshToken as string,
            }),
          })

          if (!response.ok) throw new Error("Refresh failed")

          const refreshed = await response.json()
          token.accessToken = refreshed.access_token
          token.refreshToken = refreshed.refresh_token ?? token.refreshToken
          token.expiresAt = Math.floor(Date.now() / 1000) + refreshed.expires_in

          // Re-extract claims from new token
          const payload = decodeJwtPayload(refreshed.access_token)
          token.tenantId = payload.tenant_id as string
          token.subscriptionPlan = payload.subscription_plan as string
        } catch {
          // Refresh failed — force re-login
          token.accessToken = undefined
        }
      }

      return token
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      session.user.tenantId = token.tenantId as string
      session.user.role = token.role as string
      session.user.subscriptionPlan = token.subscriptionPlan as string
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
})
