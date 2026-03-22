"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toast } from "sonner"
import { Download, ShieldAlert, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { clientsApi } from "@/lib/api/clients"
import { useAuth } from "@/hooks/use-auth"

interface GdprPanelProps {
  clientId: string
  clientName: string
  gdprConsentAt: string | null
  onAnonymized: () => void
}

export function GdprPanel({ clientId, clientName, gdprConsentAt, onAnonymized }: GdprPanelProps) {
  const { accessToken } = useAuth()
  const [anonymizeDialogOpen, setAnonymizeDialogOpen] = useState(false)

  const exportMutation = useMutation({
    mutationFn: () => clientsApi.exportData(clientId, accessToken!),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `client-export-${clientId}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Datos exportados")
    },
    onError: () => toast.error("Error al exportar datos"),
  })

  const anonymizeMutation = useMutation({
    mutationFn: () => clientsApi.anonymize(clientId, accessToken!),
    onSuccess: () => {
      toast.success("Cliente anonimizado")
      setAnonymizeDialogOpen(false)
      onAnonymized()
    },
    onError: () => toast.error("Error al anonimizar"),
  })

  return (
    <>
      <Card className="space-y-3 border-orange-200 bg-orange-50/50 p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-orange-600" />
          <h3 className="text-sm font-medium text-orange-800">Proteccion de datos (GDPR)</h3>
        </div>

        {gdprConsentAt && (
          <p className="text-xs text-muted-foreground">
            Consentimiento dado: {new Date(gdprConsentAt).toLocaleDateString("es-ES")}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
          >
            {exportMutation.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Download className="mr-1 h-3 w-3" />
            )}
            Exportar datos
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setAnonymizeDialogOpen(true)}
          >
            Anonimizar
          </Button>
        </div>
      </Card>

      <Dialog open={anonymizeDialogOpen} onOpenChange={setAnonymizeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anonimizar cliente</DialogTitle>
            <DialogDescription>
              Se eliminaran todos los datos personales de {clientName}.
              Sus citas se mantendran pero sin datos identificativos.
              Esta accion no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnonymizeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => anonymizeMutation.mutate()}
              disabled={anonymizeMutation.isPending}
            >
              {anonymizeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Anonimizar permanentemente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
