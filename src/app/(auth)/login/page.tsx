"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Scissors, Loader2 } from "lucide-react"

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async () => {
    setIsLoading(true)
    await signIn("keycloak", { callbackUrl: "/today" })
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Scissors className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">Iniciar sesion</CardTitle>
        <CardDescription>
          Accede a tu cuenta para gestionar tu salon
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          className="w-full"
          size="lg"
          onClick={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Conectando...
            </>
          ) : (
            "Iniciar sesion"
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Al iniciar sesion, seras redirigido a la pagina de autenticacion segura.
        </p>
      </CardContent>
    </Card>
  )
}
