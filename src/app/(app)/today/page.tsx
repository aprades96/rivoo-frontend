"use client"

import { useState, useMemo } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarCheck, Clock, RefreshCw } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AppointmentCard } from "@/components/appointments/appointment-card"
import { AppointmentDetailSheet } from "@/components/appointments/appointment-detail-sheet"
import { EmptyState } from "@/components/shared/empty-state"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { useTodayAppointments } from "@/hooks/use-appointments"
import { useServices } from "@/hooks/use-staff"
import { useAuth } from "@/hooks/use-auth"
import Link from "next/link"
import type { Appointment } from "@/types/appointment"

export default function TodayPage() {
  const today = format(new Date(), "yyyy-MM-dd")
  const { data, isLoading, refetch, isRefetching } = useTodayAppointments(today)
  const { data: servicesData, isLoading: servicesLoading } = useServices()
  const { user } = useAuth()

  // Sin servicios no hay nada que reservar: no tiene sentido mostrar
  // contadores de citas ni el hueco vacio generico de "no hay citas hoy" como
  // si todo funcionase con normalidad. Se espera a que la carga de servicios
  // resuelva para no mostrar este aviso un instante antes de saber si hay o
  // no catalogo.
  const hasNoServices = !servicesLoading && (servicesData?.content.length ?? 0) === 0

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

  return (
    <div className="space-y-4 p-4 md:py-6">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            {getGreeting()}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">
            {format(new Date(), "EEEE, d MMMM", { locale: es })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {hasNoServices ? (
        <EmptyState
          title="Aun no tienes servicios"
          description="Sin servicios no se pueden coger citas. Crea el primero para empezar a recibir reservas."
          action={
            <Link
              href="/staff"
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

      {/* Detail sheet */}
      <AppointmentDetailSheet
        appointment={selectedAppointment}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  )
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
