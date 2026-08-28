"use client"

import Link from "next/link"
import { MailCheck } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface CheckEmailNoticeProps {
  email: string
}

/**
 * Where registration ends now, for every address.
 *
 * The backend answers `POST /api/v1/salons` identically whether the address was free or already
 * had an account, and moves the difference into the inbox. This screen is the client half of that:
 * it must describe an email that was sent and NOTHING about what the email says, because saying
 * "confirma tu cuenta nueva" or "ya tenias cuenta" here would hand back exactly the signal the
 * backend just stopped giving away.
 *
 * Presentational and props-driven on purpose: no query cache, no mutation state, so its test is
 * synchronous and cannot pass by accident (see AGENTS.md on notifyManager macrotasks).
 */
export function CheckEmailNotice({ email }: CheckEmailNoticeProps) {
  return (
    <div className="mx-auto max-w-md space-y-5">
      <Card>
        <CardContent className="space-y-4 pt-6 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-3">
              <MailCheck className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
          </div>

          <h2 className="text-xl font-bold">Revisa tu correo</h2>

          <p className="text-sm text-muted-foreground">
            Hemos enviado un mensaje a{" "}
            <span className="font-medium text-foreground">{email}</span>. Sigue las instrucciones
            que encontraras ahi para continuar.
          </p>

          <p className="text-xs text-muted-foreground">
            Puede tardar un par de minutos en llegar. Si no lo ves, mira en la carpeta de spam.
          </p>
        </CardContent>
      </Card>

      <div className="text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Ir a iniciar sesion
        </Link>
      </div>
    </div>
  )
}
