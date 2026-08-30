"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { NewAppointmentShell } from "./new-appointment-shell"
import { WizardContextPills } from "./wizard-context-pills"
import { useWizardNavigation } from "./use-wizard-navigation"
import { getWizardSummaryCta, getWizardSummaryRows } from "./wizard-summary"
import type { WizardSummaryState } from "./wizard-summary"
import { WizardSummaryAside } from "@/components/wizard/wizard-summary-aside"
import { useClients } from "@/hooks/use-clients"
import { useEmployees } from "@/hooks/use-staff"
import { useAuth } from "@/hooks/use-auth"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useWizardStore } from "@/lib/stores/wizard-store"
import { clientsApi } from "@/lib/api/clients"
import { initials } from "@/lib/utils/format"
import { employeeFallbackAvatarClassName } from "@/lib/utils/avatar"
import { cn } from "@/lib/utils"
import type { Client } from "@/types/client"

// Tailwind's `lg:` breakpoint (1024px) -- keep in sync with
// `new-appointment-shell.tsx`. Needed here (and not just inside the shell)
// because the mobile/desktop markup genuinely differs in content, not just
// spacing: the search placeholder text is different in each artboard
// (`NuevaCitaPaso4.dc.html:62` vs `NuevaCitaDesktopPaso4.dc.html:74`), and the
// "clientes recientes" label / visits column only exist on one side each. Per
// the width-difference rule this is decided once in JS, not with paired
// `hidden lg:...` classes that would leave both wordings in the DOM at once.
const DESKTOP_QUERY = "(min-width: 1024px)"

export function ClientStep() {
  const { onClose, onBack } = useWizardNavigation()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const { accessToken, isAuthenticated } = useAuth()

  const wizardState = useWizardStore()
  const { selectClient, newClientData, setNewClientData, nextStep, preferredClientId } = wizardState
  const [search, setSearch] = useState("")
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [formData, setFormData] = useState({
    firstName: newClientData?.firstName ?? "",
    lastName: newClientData?.lastName ?? "",
    email: newClientData?.email ?? "",
    phone: newClientData?.phone ?? "",
  })

  const { data, isLoading } = useClients(search)
  const clients = data?.content ?? []

  const { data: employeesData } = useEmployees()
  const employees = employeesData?.content ?? []

  // D26: resuelve el prefill de `?clientId=...` sembrado en
  // `preferredClientId`. La `queryKey` (`["client", id]`) es la MISMA que
  // `/clients/{id}` (`clients/[id]/page.tsx`), asi que si el usuario vino de
  // ahi la respuesta ya esta en cache y esta consulta ni siquiera golpea la
  // red. Si el id no resuelve (cliente borrado/invalido), se limpia la
  // preferencia igual que hace `employee-step.tsx` con la suya, para no dejar
  // al usuario atrapado reintentando en cada render.
  const {
    data: preferredClient,
    isLoading: preferredClientLoading,
    isError: preferredClientErrored,
  } = useQuery<Client>({
    queryKey: ["client", preferredClientId],
    queryFn: () => clientsApi.getById(preferredClientId!, accessToken!),
    enabled: isAuthenticated && !!accessToken && !!preferredClientId,
  })

  useEffect(() => {
    if (!preferredClientId || preferredClientLoading) return

    if (preferredClient) {
      selectClient(preferredClient)
      nextStep()
    } else if (preferredClientErrored) {
      useWizardStore.setState({ preferredClientId: null })
    }
  }, [preferredClientId, preferredClientLoading, preferredClient, preferredClientErrored, selectClient, nextStep])

  const handleSelectClient = (client: Client) => {
    selectClient(client)
    nextStep()
  }

  const handleCreateInline = () => {
    if (!formData.firstName || !formData.lastName) return
    setNewClientData(formData)
    nextStep()
  }

  // `slotEmployee` resuelto desde `selectedSlotEmployeeId` (el dueno del hueco
  // elegido, no `selectedEmployee`): con "Sin preferencia" en cuanto hay hueco
  // la cita ya tiene un profesional concreto, y `getProfessionalRow`
  // (`wizard-summary.ts:108-113`) solo deja de decir "Sin preferencia" si se lo
  // pasamos. Sin esto el aside nombraria a la persona en los pasos 3 y 5 y
  // diria "Sin preferencia" en el 4, contradiciendose entre pantallas
  // consecutivas del mismo asistente. Mismo patron que
  // `datetime-step.tsx:240` y `confirmation-step.tsx:139-140`.
  const slotEmployee =
    employees.find((candidate) => candidate.id === wizardState.selectedSlotEmployeeId) ?? null
  const summaryState: WizardSummaryState = {
    selectedEmployee: wizardState.selectedEmployee,
    anyEmployee: wizardState.anyEmployee,
    selectedService: wizardState.selectedService,
    selectedDate: wizardState.selectedDate,
    selectedSlot: wizardState.selectedSlot,
    selectedClient: wizardState.selectedClient,
    newClientData,
    slotEmployee,
  }
  const rows = getWizardSummaryRows(summaryState, 4)
  const cta = getWizardSummaryCta(summaryState, 4)
  // `heading`/`note` defaults on `WizardSummaryAside` ("Tu reserva" + trust
  // note) belong to the PUBLIC booking flow. This is a salon-staff wizard for
  // a manually-created appointment: `NuevaCitaDesktopPaso4.dc.html:129` says
  // "Resumen", and none of the ten wizard artboards carry the "Sin registro
  // ... cancela gratis" note -- it would be a false claim here.
  const aside = (
    <WizardSummaryAside
      rows={rows}
      ctaLabel={cta.label}
      ctaDisabled={cta.disabled}
      heading="Resumen"
      note={null}
    />
  )

  return (
    <NewAppointmentShell
      step={4}
      title="Selecciona un cliente"
      subtitle="Busca uno existente o crea uno nuevo sin salir del flujo."
      onBack={onBack}
      onClose={onClose}
      aside={aside}
    >
      {showCreateForm ? (
        // Sin artboard propio -- `design/NuevaCita{,Desktop}Paso4.dc.html` solo
        // dibujan la tarjeta que ABRE este formulario, nunca su contenido. Se
        // conserva tal cual (sin rediseno) porque quitarlo dejaria esa tarjeta
        // apuntando a un destino que no existe en ninguno de los dos anchos.
        // Anotado como hueco de canvas para quien retome este formulario.
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold">Nuevo cliente</h2>
            <p className="text-sm text-muted-foreground">Introduce los datos del cliente</p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="firstName" className="text-xs">
                  Nombre *
                </Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="Nombre"
                />
              </div>
              <div>
                <Label htmlFor="lastName" className="text-xs">
                  Apellidos *
                </Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Apellidos"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email" className="text-xs">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@ejemplo.com"
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-xs">
                Teléfono
              </Label>
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
            <Button variant="outline" className="flex-1" onClick={() => setShowCreateForm(false)}>
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
      ) : (
        <>
          {!isDesktop && <WizardContextPills />}

          <div className="relative">
            <Search
              className={cn(
                "absolute top-1/2 -translate-y-1/2 text-muted-foreground-2",
                isDesktop ? "left-[14px] size-[18px]" : "left-[13px] size-[17px]"
              )}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isDesktop ? "Buscar por nombre, teléfono o email..." : "Buscar por nombre..."
              }
              className={cn(
                "rounded-lg border-border bg-card text-sm placeholder:text-muted-foreground-2",
                isDesktop ? "h-[46px] pl-[42px] pr-3.5" : "h-11 pl-10 pr-3.5"
              )}
            />
          </div>

          <div className={cn("flex flex-col gap-2", isDesktop && "grid grid-cols-2 gap-[14px]")}>
            <CreateClientCard isDesktop={isDesktop} onClick={() => setShowCreateForm(true)} />

            {!isDesktop && search === "" && (
              <span className="mt-1 text-xs leading-tight text-muted-foreground">Clientes recientes</span>
            )}

            {isLoading ? (
              <LoadingSkeleton count={4} />
            ) : clients.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No se encontraron clientes. Puedes crear uno nuevo.
              </p>
            ) : (
              clients.map((client, index) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  index={index}
                  isDesktop={isDesktop}
                  onSelect={() => handleSelectClient(client)}
                />
              ))
            )}
          </div>
        </>
      )}
    </NewAppointmentShell>
  )
}

interface CreateClientCardProps {
  isDesktop: boolean
  onClick: () => void
}

/**
 * `.row`/`.card` con borde discontinuo (`NuevaCitaPaso4.dc.html:67`,
 * `...Desktop...:78`). `border-border-dashed-strong` es el COLOR
 * (`#dcc9bb`) y `border-dashed` el ESTILO nativo de Tailwind -- hacen falta
 * las dos clases, receta ya usada en `free-slot-hint.tsx:43`.
 */
function CreateClientCard({ isDesktop, onClick }: CreateClientCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-dashed border-border-dashed-strong bg-accent p-3 text-left transition-colors hover:bg-accent/80",
        isDesktop && "gap-[14px] rounded-[10px] p-4"
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-primary",
          isDesktop && "size-11"
        )}
      >
        <Plus className={isDesktop ? "size-5" : "size-[19px]"} strokeWidth={2} />
      </div>
      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            "text-sm font-semibold text-primary-pressed",
            isDesktop ? "text-[15px] leading-tight" : "leading-tight"
          )}
        >
          Crear nuevo cliente
        </span>
        <span className="text-xs text-muted-foreground">Añadir datos manualmente</span>
      </div>
    </button>
  )
}

interface ClientCardProps {
  client: Client
  /** Posicion en la lista tal como llega, no el `id` -- misma regla que
   * `employeePaletteIndex` (`avatar.ts:98-114`): asi dos clientes contiguos
   * nunca comparten color y el reparto es estable mientras no cambie el
   * orden. `Client` no tiene `colorHex` (no es un `Employee`), asi que aqui
   * SIEMPRE se usa el color de reserva, nunca uno propio. */
  index: number
  isDesktop: boolean
  onSelect: () => void
}

/**
 * `.row` (`NuevaCitaPaso4.dc.html:79-109`) y `.card`
 * (`NuevaCitaDesktopPaso4.dc.html:86-124`) son la misma tarjeta cliente con
 * distinto padding/tamano y una segunda linea/columna de visitas que cambia
 * de forma entre anchos -- de ahi un unico componente con `isDesktop`, igual
 * que `ServiceCard` en `service-step.tsx:205`.
 *
 * El numero de visitas sale de `client.totalVisits` tal cual. HOY vale 0 para
 * todos los clientes (`ClientService.java:66,193` lo fija a 0 al crear y
 * ningun endpoint lo incrementa) -- pintar "0 visitas" es correcto y
 * deliberado, no un bug de este componente. Derivarlo contando citas aqui
 * anadiria N peticiones por pantalla, daria un numero distinto del que
 * enseña la ficha de cliente, y taparia el hueco de backend justo donde mas
 * se nota. Deuda anotada, arreglo pendiente en el backend.
 */
function ClientCard({ client, index, isDesktop, onSelect }: ClientCardProps) {
  const hasPhone = Boolean(client.phone)
  const contactLine = client.phone ?? "Sin contacto"
  const visitsLabel = `${client.totalVisits} visita${client.totalVisits === 1 ? "" : "s"}`

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50",
        isDesktop && "gap-[14px] rounded-[10px] p-4"
      )}
    >
      <Avatar className={cn("size-10", isDesktop && "size-11")}>
        <AvatarFallback
          className={cn(
            isDesktop ? "text-sm" : "text-[13px] leading-tight",
            "font-semibold",
            employeeFallbackAvatarClassName(index)
          )}
        >
          {initials(client.firstName, client.lastName)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className={cn("truncate text-sm font-semibold", isDesktop ? "text-[15px] leading-tight" : "leading-tight")}>
          {client.firstName} {client.lastName}
        </p>
        {isDesktop ? (
          <p className="truncate text-xs text-muted-foreground">{contactLine}</p>
        ) : (
          <p
            className={cn(
              "truncate text-xs tabular-nums",
              hasPhone ? "text-muted-foreground" : "text-muted-foreground-2"
            )}
          >
            {contactLine} &middot; {visitsLabel}
          </p>
        )}
      </div>
      {isDesktop && (
        <div className="flex shrink-0 flex-col items-end">
          <span className="text-[13px] leading-tight font-semibold tabular-nums">{client.totalVisits}</span>
          <span className="text-[10px] leading-tight text-muted-foreground-2">visitas</span>
        </div>
      )}
    </button>
  )
}
