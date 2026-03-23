"use client"

import { useEffect } from "react"
import { SessionProvider as NextAuthSessionProvider, signIn } from "next-auth/react"
import type { ReactNode } from "react"

function SessionExpiredListener({ children }: { children: ReactNode }) {
  useEffect(() => {
    const handler = () => signIn("keycloak", { callbackUrl: window.location.pathname })
    window.addEventListener("rivoo:session-expired", handler)
    return () => window.removeEventListener("rivoo:session-expired", handler)
  }, [])

  return <>{children}</>
}

export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <SessionExpiredListener>{children}</SessionExpiredListener>
    </NextAuthSessionProvider>
  )
}
