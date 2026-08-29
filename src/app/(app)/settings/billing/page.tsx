"use client"

import { useQuery, useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { CreditCard, ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { PageShell } from "@/components/layout/page-shell"
import { billingApi } from "@/lib/api/billing"
import { useAuth } from "@/hooks/use-auth"
import { formatCurrency } from "@/lib/utils/format"
import type { Subscription, PlanInfo, PlanName } from "@/types/billing"

const PLAN_LABELS: Record<PlanName, string> = {
  FREE_TRIAL: "Prueba gratuita",
  BASIC: "Basic",
  PREMIUM: "Premium",
  ENTERPRISE: "Enterprise",
}

const STATUS_LABELS: Record<string, { label: string; variant: "secondary" | "outline" | "destructive" }> = {
  TRIALING: { label: "En prueba", variant: "secondary" },
  ACTIVE: { label: "Activo", variant: "secondary" },
  PAST_DUE: { label: "Pago pendiente", variant: "destructive" },
  CANCELLED: { label: "Cancelado", variant: "outline" },
  EXPIRED: { label: "Expirado", variant: "outline" },
}

export default function BillingSettingsPage() {
  const { accessToken } = useAuth()

  const { data: subscription, isLoading: subLoading } = useQuery<Subscription>({
    queryKey: ["subscription"],
    queryFn: () => billingApi.getSubscription(accessToken!),
    enabled: !!accessToken,
  })

  const { data: plans } = useQuery<PlanInfo[]>({
    queryKey: ["plans"],
    queryFn: () => billingApi.getPlans(),
  })

  const checkoutMutation = useMutation({
    mutationFn: (planName: PlanName) =>
      billingApi.createCheckoutSession({ planName }, accessToken!),
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl
    },
    onError: () => toast.error("Error al crear sesion de pago"),
  })

  const portalMutation = useMutation({
    mutationFn: () => billingApi.createPortalSession(accessToken!),
    onSuccess: (data) => {
      window.location.href = data.url
    },
    onError: () => toast.error("Error al abrir portal de facturacion"),
  })

  // `max-w-[554px]` = `AjustesFacturacionDesktop.dc.html:112`; se repite en
  // el estado de carga para que el ancho no salte al terminar de cargar
  // (antes, esta rama no llevaba `contentClassName` y la cargada si, asi que
  // el espaciado interno cambiaba al terminar).
  if (subLoading) {
    return (
      <PageShell title="Facturacion y plan" back contentClassName="max-w-[554px] space-y-4">
        <LoadingSkeleton count={4} />
      </PageShell>
    )
  }

  const statusInfo = subscription ? STATUS_LABELS[subscription.status] : null

  return (
    <PageShell title="Facturacion y plan" back contentClassName="max-w-[554px] space-y-4">
      {/* Current plan */}
      {subscription && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Plan actual</p>
              <p className="text-lg font-bold">{PLAN_LABELS[subscription.planName]}</p>
            </div>
            {statusInfo && (
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            )}
          </div>

          {subscription.currentPeriodEnd && (
            <p className="text-xs text-muted-foreground">
              Siguiente facturacion: {new Date(subscription.currentPeriodEnd).toLocaleDateString("es-ES")}
            </p>
          )}
          {subscription.trialEnd && subscription.status === "TRIALING" && (
            <p className="text-xs text-muted-foreground">
              Prueba termina: {new Date(subscription.trialEnd).toLocaleDateString("es-ES")}
            </p>
          )}

          {subscription.stripeSubscriptionId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
            >
              {portalMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <ExternalLink className="mr-1 h-3 w-3" />
              )}
              Gestionar suscripcion
            </Button>
          )}
        </Card>
      )}

      <Separator />

      {/* Available plans */}
      <div>
        <h2 className="mb-2 text-sm font-medium">Planes disponibles</h2>
        <div className="space-y-2">
          {/* Backend already returns only active plans (repository.findByActiveTrue()). Do not re-filter here. */}
          {(plans ?? []).map((plan) => {
            const isCurrent = subscription?.planName === plan.name
            return (
              <Card key={plan.id} className={`p-3 ${isCurrent ? "border-primary" : ""}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{plan.displayName}</p>
                      {isCurrent && <Badge variant="secondary" className="text-[10px]">Actual</Badge>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold">{formatCurrency(plan.monthlyPrice)}</p>
                    <p className="text-[10px] text-muted-foreground">/mes</p>
                  </div>
                </div>
                {!isCurrent && (
                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => checkoutMutation.mutate(plan.name as PlanName)}
                    disabled={checkoutMutation.isPending}
                  >
                    {checkoutMutation.isPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <CreditCard className="mr-1 h-3 w-3" />
                    )}
                    Cambiar a {plan.displayName}
                  </Button>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </PageShell>
  )
}
