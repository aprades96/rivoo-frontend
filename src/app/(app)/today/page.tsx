"use client"

import { useState, useMemo } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarCheck, Clock, Plus, RefreshCw } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { PageShell } from "@/components/layout/page-shell"
import { AppointmentCard } from "@/components/appointments/appointment-card"
import { AppointmentDetailSheet } from "@/components/appointments/appointment-detail-sheet"
import { EmptyState } from "@/components/shared/empty-state"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { UnavailableNotice } from "@/components/booking/unavailable-notice"
import { useTodayAppointments } from "@/hooks/use-appointments"
import { useServices } from "@/hooks/use-staff"
import { useAuth } from "@/hooks/use-auth"
import { capitalizeFirst } from "@/lib/utils/format"
import Link from "next/link"
import type { Appointment } from "@/types/appointment"

export default function TodayPage() {
  const today = format(new Date(), "yyyy-MM-dd")
  const { data, isLoading, refetch, isRefetching } = useTodayAppointments(today)
  const {
    data: servicesData,
    isLoading: servicesLoading,
    error: servicesError,
  } = useServices()
  const { user } = useAuth()

  // Sin servicios no hay nada que reservar: no tiene sentido mostrar
  // contadores de citas ni el hueco vacio generico de "no hay citas hoy" como
  // si todo funcionase con normalidad. Se espera a que la carga de servicios
  // resuelva para no mostrar este aviso un instante antes de saber si hay o
  // no catalogo.
  //
  // `!servicesError` es obligatorio: sin el, un 5xx/red en el GET deja
  // `isLoading` en false y `data` en undefined, y el `?? 0` de abajo confunde
  // "no ha podido cargar" con "no tiene ninguno" -- sustituyendo la agenda
  // entera por este aviso y perdiendo tarjetas, proxima cita y citas de hoy
  // por un fallo que nada tiene que ver con el catalogo real.
  const hasNoServices =
    !servicesLoading && !servicesError && (servicesData?.content.length ?? 0) === 0

  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const appointments = data?.content ?? []

  // Sort by startTime
  const sorted = useMemo(
    () => [...appointments].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [appointments]
  )

  const stats = useMemo(() => {
    const total = sorted.length
    const pending = sorted.filter((a) => a.status === "PENDING").length
    const confirmed = sorted.filter((a) => a.status === "CONFIRMED").length
    const completed = sorted.filter((a) => a.status === "COMPLETED").length
    return { total, pending, confirmed, completed }
  }, [sorted])

  const handleTapAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setSheetOpen(true)
  }

  // Find the next upcoming appointment
  const now = new Date().toISOString()
  const nextAppointment = sorted.find(
    (a) =>
      a.startTime > now &&
      (a.status === "PENDING" || a.status === "CONFIRMED")
  )

  const greetingTitle = `${getGreeting()}${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`
  // `capitalizeFirst`, no la clase CSS `capitalize`: esta ultima mayusculiza
  // tambien "de" y el mes ("Martes, 27 De Agosto"), distinto de lo que dibuja
  // el artboard ("Martes, 27 de agosto") -- mismo criterio que `/calendar`
  // (`calendar/page.tsx`), de donde viene este helper compartido.
  const todayLabel = capitalizeFirst(format(new Date(), "EEEE, d 'de' MMMM", { locale: es }))

  return (
    <PageShell
      title={greetingTitle}
      subtitle={`${todayLabel} · ${format(new Date(), "HH:mm")}`}
      actions={
        <>
          {/*
            HoyDesktop.dc.html:80-81: 38x38, borde #E7DCCF, fondo blanco,
            radio 8px, icono de 17px en #7A6A5F -- es un boton `outline`, no
            `ghost` (que es transparente y sin borde).
          */}
          <Button
            variant="outline"
            size="icon"
            aria-label="Actualizar"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="size-[38px] text-muted-foreground"
          >
            <RefreshCw className={`size-[17px] ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
          {/*
            HoyDesktop.dc.html:83-86: unico CTA de creacion en escritorio
            desde que el boton flotante se retiro de esa rama.
          */}
          <Link href="/appointments/new" className={buttonVariants({ size: "action" })}>
            <Plus className="size-[17px]" />
            Nueva cita
          </Link>
        </>
      }
      mobileActions={user ? <UserBadge name={user.name} /> : null}
    >
      <div className="space-y-4">
        {/*
          El saludo y el refrescar viven en la cabecera de PageShell en los dos
          anchos; esta linea de fecha + el refrescar de 44x44 son propios del
          cuerpo en movil (Main.dc.html:33-40) -- en escritorio esa misma
          fecha (con hora) ya sale en el `subtitle` de la cabecera.
        */}
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <p className="text-sm text-muted-foreground">{todayLabel}</p>
          <Button
            variant="outline"
            size="icon"
            aria-label="Actualizar"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="size-11 shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/*
          Un fallo puntual del GET de servicios nunca debe tapar la agenda: la
          pantalla principal del dia sigue pintandose con normalidad y este
          aviso se limita a informar aparte (nunca sustituye a `hasNoServices`
          ni al resto del cuerpo).
        */}
        {servicesError && (
          <UnavailableNotice
            title="No se ha podido comprobar tu catalogo de servicios"
            description="La agenda de hoy sigue disponible. Vuelve a intentarlo en unos minutos."
          />
        )}

        {hasNoServices ? (
          <EmptyState
            title="Aun no tienes servicios"
            description="Sin servicios no se pueden coger citas. Crea el primero para empezar a recibir reservas."
            action={
              <Link
                href="/staff?tab=services"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Crear servicio
              </Link>
            }
          />
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                label="Total"
                value={stats.total}
                icon={<CalendarCheck className="h-4 w-4" />}
              />
              <StatCard
                label="Pendientes"
                value={stats.pending}
                icon={<Clock className="h-4 w-4" />}
                highlight={stats.pending > 0}
              />
              <StatCard
                label="Completadas"
                value={stats.completed}
                icon={<CalendarCheck className="h-4 w-4" />}
              />
            </div>

            {/* Next appointment highlight */}
            {nextAppointment && (
              <Card className="border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-medium text-primary">Proxima cita</p>
                <AppointmentCard
                  appointment={nextAppointment}
                  onTap={handleTapAppointment}
                />
              </Card>
            )}

            {/* Timeline */}
            <div>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                Todas las citas de hoy
              </h2>

              {isLoading ? (
                <LoadingSkeleton count={4} />
              ) : sorted.length === 0 ? (
                <EmptyState
                  title="No hay citas para hoy"
                  description="Crea una nueva cita o espera a que tus clientes reserven."
                  action={
                    <Link
                      href="/appointments/new"
                      className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Crear cita
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-2">
                  {sorted.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      onTap={handleTapAppointment}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Detail sheet */}
      <AppointmentDetailSheet
        appointment={selectedAppointment}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </PageShell>
  )
}

// Cluster de la cabecera movil (Main.dc.html:25-28): nombre corto + iniciales
// en circulo. Distinto del `UserCard` de la barra lateral (ese lleva borde,
// rol y avatar de 34px); aqui es un elemento de cabecera de 32px sin borde,
// asi que no se reutiliza.
function UserBadge({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{formatShortName(name)}</span>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
        {getInitials(name)}
      </div>
    </div>
  )
}

function formatShortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return parts[0] ?? ""
  return `${parts[0]} ${parts[parts.length - 1]!.charAt(0)}.`
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase()
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase()
}

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string
  value: number
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <Card className={`p-3 ${highlight ? "border-yellow-300 bg-yellow-50" : ""}`}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </Card>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Buenos dias"
  if (hour < 20) return "Buenas tardes"
  return "Buenas noches"
}
