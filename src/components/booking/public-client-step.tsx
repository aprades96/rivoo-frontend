"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePublicBookingStore } from "@/lib/stores/public-booking-store"

export function PublicClientStep() {
  const { clientForm, setClientForm, honeypot, setHoneypot, nextStep } = usePublicBookingStore()

  const isValid =
    clientForm.firstName &&
    clientForm.lastName &&
    clientForm.email &&
    clientForm.phone &&
    clientForm.gdprConsent

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Tus datos</h2>
        <p className="text-sm text-muted-foreground">
          Necesitamos tus datos para confirmar la reserva
        </p>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Nombre *</Label>
            <Input
              value={clientForm.firstName}
              onChange={(e) => setClientForm({ firstName: e.target.value })}
              placeholder="Nombre"
            />
          </div>
          <div>
            <Label className="text-xs">Apellidos *</Label>
            <Input
              value={clientForm.lastName}
              onChange={(e) => setClientForm({ lastName: e.target.value })}
              placeholder="Apellidos"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Email *</Label>
          <Input
            type="email"
            value={clientForm.email}
            onChange={(e) => setClientForm({ email: e.target.value })}
            placeholder="tu@email.com"
          />
        </div>
        <div>
          <Label className="text-xs">Telefono *</Label>
          <Input
            type="tel"
            value={clientForm.phone}
            onChange={(e) => setClientForm({ phone: e.target.value })}
            placeholder="612 345 678"
          />
        </div>

        {/* Honeypot — hidden from real users */}
        <div className="absolute -left-[9999px] opacity-0" aria-hidden="true">
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        {/* GDPR consent */}
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={clientForm.gdprConsent}
            onChange={(e) => setClientForm({ gdprConsent: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-border"
          />
          <span className="text-xs text-muted-foreground">
            Acepto que mis datos se utilicen para gestionar esta reserva.
            Puedo solicitar su eliminacion en cualquier momento. *
          </span>
        </label>

        <Button className="w-full" size="lg" onClick={nextStep} disabled={!isValid}>
          Revisar reserva
        </Button>
      </div>
    </div>
  )
}
