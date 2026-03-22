"use client"

import { useState } from "react"
import { Search, Plus, User } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { useClients } from "@/hooks/use-clients"
import { useWizardStore } from "@/lib/stores/wizard-store"
import { initials } from "@/lib/utils/format"
import type { Client } from "@/types/client"

export function ClientStep() {
  const { selectedClient, newClientData, selectClient, setNewClientData, nextStep } = useWizardStore()
  const [search, setSearch] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  })

  const { data, isLoading } = useClients(search)
  const clients = data?.content ?? []

  const handleSelectClient = (client: Client) => {
    selectClient(client)
    nextStep()
  }

  const handleCreateInline = () => {
    if (!formData.firstName || !formData.lastName) return
    setNewClientData(formData)
    nextStep()
  }

  if (showCreateForm) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Nuevo cliente</h2>
          <p className="text-sm text-muted-foreground">
            Introduce los datos del cliente
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="firstName" className="text-xs">Nombre *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                placeholder="Nombre"
              />
            </div>
            <div>
              <Label htmlFor="lastName" className="text-xs">Apellidos *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                placeholder="Apellidos"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@ejemplo.com"
            />
          </div>
          <div>
            <Label htmlFor="phone" className="text-xs">Telefono</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="612 345 678"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setShowCreateForm(false)}
          >
            Volver
          </Button>
          <Button
            className="flex-1"
            disabled={!formData.firstName || !formData.lastName}
            onClick={handleCreateInline}
          >
            Continuar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Selecciona un cliente</h2>
        <p className="text-sm text-muted-foreground">
          Busca o crea un nuevo cliente
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Create new button */}
      <Card
        className="cursor-pointer p-3 transition-colors hover:bg-muted/50"
        onClick={() => setShowCreateForm(true)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Crear nuevo cliente</p>
            <p className="text-xs text-muted-foreground">Anadir datos manualmente</p>
          </div>
        </div>
      </Card>

      {/* Search results */}
      {search.length >= 2 && (
        <div className="space-y-1">
          {isLoading ? (
            <LoadingSkeleton count={3} />
          ) : clients.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No se encontraron clientes. Puedes crear uno nuevo.
            </p>
          ) : (
            clients.map((client) => (
              <Card
                key={client.id}
                className={`cursor-pointer p-3 transition-colors hover:bg-muted/50 ${
                  selectedClient?.id === client.id ? "border-primary bg-primary/5" : ""
                }`}
                onClick={() => handleSelectClient(client)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs">
                      {initials(client.firstName, client.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {client.firstName} {client.lastName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[client.phone, client.email].filter(Boolean).join(" · ") || "Sin contacto"}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {client.totalVisits} visita{client.totalVisits !== 1 ? "s" : ""}
                  </span>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Skip client option */}
      <button
        className="w-full py-2 text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => {
          setNewClientData(null)
          nextStep()
        }}
      >
        Continuar sin cliente
      </button>
    </div>
  )
}
