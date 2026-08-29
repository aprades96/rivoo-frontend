"use client"

import { LogOut, KeyRound, User, Mail, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PageShell } from "@/components/layout/page-shell"
import { useAuth } from "@/hooks/use-auth"

export default function AccountSettingsPage() {
  const { user, logout } = useAuth()

  const keycloakAccountUrl = `${process.env.NEXT_PUBLIC_KEYCLOAK_URL}/realms/rivoo/account`

  return (
    // `max-w-[860px]` = `AjustesCuentaDesktop.dc.html:113`; sin ella
    // `PageShell` estira el contenido a los 1084px de listas/tablas y los
    // botones `w-full` de mas abajo quedan igual de anchos.
    <PageShell title="Mi cuenta" back contentClassName="max-w-[860px] space-y-4">
      {/* User info */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <User className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{user?.name || "Usuario"}</p>
            <p className="text-xs text-muted-foreground">{user?.role?.replace("ROLE_", "")}</p>
          </div>
        </div>
        {user?.email && (
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm">{user.email}</p>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm">Plan: {user?.subscriptionPlan ?? "—"}</p>
        </div>
      </Card>

      {/* Actions */}
      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => window.open(keycloakAccountUrl, "_blank")}
        >
          <KeyRound className="mr-2 h-4 w-4" />
          Cambiar contraseña
        </Button>

        <Separator />

        <Button
          variant="destructive"
          className="w-full justify-start"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesion
        </Button>
      </div>
    </PageShell>
  )
}
