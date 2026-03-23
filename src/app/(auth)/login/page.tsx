import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Scissors, CheckCircle2 } from "lucide-react"
import { loginAction } from "./actions"

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ registered?: string }> }) {
  const params = await searchParams
  const justRegistered = params.registered === "true"

  return (
    <div className="mx-auto max-w-sm space-y-4">
      {justRegistered && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Cuenta creada. Inicia sesion para continuar.
        </div>
      )}

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
          <form action={loginAction}>
            <button
              type="submit"
              className="flex h-9 w-full cursor-pointer items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-all active:translate-y-px hover:opacity-90"
            >
              Iniciar sesion
            </button>
          </form>
          <p className="text-center text-xs text-muted-foreground">
            Al iniciar sesion, seras redirigido a la pagina de autenticacion segura.
          </p>
          <div className="text-center text-sm">
            <span className="text-muted-foreground">No tienes cuenta? </span>
            <Link href="/register" className="font-medium text-primary hover:underline">
              Crear cuenta
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
