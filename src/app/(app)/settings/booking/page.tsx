"use client"

import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Globe, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageShell } from "@/components/layout/page-shell"
import { salonsApi } from "@/lib/api/salons"
import { useSalon } from "@/hooks/use-salon"
import { useAuth } from "@/hooks/use-auth"

export default function BookingSettingsPage() {
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()
  const { data: salon } = useSalon()

  const [copied, setCopied] = useState(false)

  const bookingUrl = salon
    ? `${window.location.origin}/book/${salon.slug}`
    : ""

  const toggleMutation = useMutation({
    mutationFn: () => {
      // Toggle uses the update salon endpoint — for now we rely on the backend supporting this field
      // This is a placeholder; the actual API may differ
      return salonsApi.update({}, accessToken!)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salon"] })
      toast.success("Configuracion actualizada")
    },
  })

  const handleCopy = async () => {
    await navigator.clipboard.writeText(bookingUrl)
    setCopied(true)
    toast.success("Enlace copiado")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    // `max-w-[554px]` = `AjustesReservaDesktop.dc.html:114`; sin ella
    // `PageShell` estira la tarjeta a los 1084px de listas/tablas.
    <PageShell title="Reservas online" back contentClassName="max-w-[554px]">
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Pagina de reservas publica</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Comparte este enlace con tus clientes para que puedan reservar cita online.
        </p>

        {salon && (
          <>
            <div className="flex gap-2">
              <Input value={bookingUrl} readOnly className="text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(bookingUrl, "_blank")}
            >
              <Globe className="mr-1 h-3 w-3" />
              Abrir pagina de reservas
            </Button>
          </>
        )}
      </Card>
    </PageShell>
  )
}
