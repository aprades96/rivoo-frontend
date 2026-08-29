"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSalon } from "@/hooks/use-salon"
import { useAuth } from "@/hooks/use-auth"
import { ApiError } from "@/lib/api/client"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Loader2, LogOut } from "lucide-react"
import type { ReactNode } from "react"

export function OnboardingGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading, accessToken, isOwner, logout } = useAuth()
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

  // Both error screens below render INSTEAD of the app shell: this gate wraps
  // it, so neither the sidebar nor the screen's own header exists here. Without
  // this the owner has no way to leave the screen at all -- not even to log out
  // and come back with a different account.
  const logoutAction = (
    <Button variant="ghost" onClick={() => logout()}>
      <LogOut className="h-4 w-4" />
      Cerrar sesion
    </Button>
  )

  if (unavailable) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <EmptyState
          title="No se ha podido cargar tu salon"
          description="Comprueba tu conexion e intentalo de nuevo."
          action={
            <div className="flex flex-col items-center gap-2 sm:flex-row">
              <Button onClick={() => refetchSalon()}>Reintentar</Button>
              {logoutAction}
            </div>
          }
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
          // No "Reintentar" aqui: un 404 de /salons/me no lo arregla repetir
          // la misma peticion (a diferencia de `unavailable`, que si puede
          // ser un 5xx transitorio). Cerrar sesion es la unica salida real
          // desde esta pantalla.
          action={logoutAction}
        />
      </div>
    )
  }

  return <>{children}</>
}
