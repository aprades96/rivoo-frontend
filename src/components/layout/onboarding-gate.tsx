"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSalon } from "@/hooks/use-salon"
import { useAuth } from "@/hooks/use-auth"
import { ApiError } from "@/lib/api/client"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import type { ReactNode } from "react"

export function OnboardingGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, accessToken, isOwner } = useAuth()
  const { data: salon, isLoading: salonLoading, error: salonError, refetch: refetchSalon } = useSalon()

  // Half-alive session: authenticated but the token is gone while use-auth.ts:22-27
  // re-authenticates. Without this, needsOnboarding/unavailable could turn true
  // for an instant on a session that is about to come back.
  const authReady = isAuthenticated && !!accessToken
  const isLoading = authLoading || salonLoading

  // Irrecoverable, not "needs onboarding": the wizard has no way to create a
  // salon (only the anonymous /register form does, via RegisterSalonRequest
  // -- see salons.ts, which the assistant never calls). Sending a 404 to
  // /welcome walks the owner through 4 steps into a second 404 on step 5 with
  // no way out but "Salir". A 404 here also happens on a broken X-Tenant-Id
  // propagation, which would misroute an owner who already completed
  // onboarding straight back into the wizard. Handled below as its own error
  // screen, same shape as `unavailable`.
  const salonNotFound =
    !salonLoading && !salon && salonError instanceof ApiError && salonError.problem.status === 404

  // Only the owner runs the wizard. The step 3/4 endpoints and the completion
  // endpoint are hasRole('SALON_OWNER'): sending an EMPLOYEE there would just
  // hand them a 403 they cannot get out of.
  //
  // Known, accepted limitation: auth.ts:55 classifies as ROLE_EMPLOYEE any JWT
  // without a ROLE_-prefixed role, so a mislabeled owner would never be sent to
  // the wizard and would land on an empty panel instead. Accepted knowingly.
  const needsOnboarding =
    authReady && !isLoading && isOwner && !!salon && !salon.onboardingCompletedAt

  // A REAL failure (network, 5xx...), not the mere absence of data yet: a
  // disabled query (use-salon.ts's `enabled: isAuthenticated && !!accessToken`)
  // leaves isLoading false and data undefined without that being an error.
  //
  // Also requires the absence of cached `salon` data: react-query keeps
  // serving the last successful payload (and setting `error`) when a
  // background refetch fails, e.g. a window-focus refetch hitting a
  // transient 5xx. Without `!salon` here, that alone would tear down a panel
  // that is working fine and replace it with the error screen.
  const unavailable = authReady && !isLoading && !!salonError && !salonNotFound && !salon

  useEffect(() => {
    if (needsOnboarding) {
      router.replace("/welcome")
    }
  }, [needsOnboarding, router])

  if (!authReady || isLoading || needsOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (unavailable) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <EmptyState
          title="No se ha podido cargar tu salon"
          description="Comprueba tu conexion e intentalo de nuevo."
          action={<Button onClick={() => refetchSalon()}>Reintentar</Button>}
        />
      </div>
    )
  }

  if (salonNotFound) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <EmptyState
          title="No hemos encontrado tu salon"
          description="Ponte en contacto con soporte: el asistente de alta no puede crear uno nuevo."
          action={<Button onClick={() => refetchSalon()}>Reintentar</Button>}
        />
      </div>
    )
  }

  return <>{children}</>
}
