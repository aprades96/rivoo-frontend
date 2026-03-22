"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft, LogOut, KeyRound, User, Mail, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/hooks/use-auth"

export default function AccountSettingsPage() {
  const router = useRouter()
  const { user, logout } = useAuth()

  const keycloakAccountUrl = `${process.env.NEXT_PUBLIC_KEYCLOAK_URL}/realms/rivoo/account`

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-sm font-semibold">Mi cuenta</h1>
      </div>

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
          Cambiar contrasena
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
    </div>
  )
}
