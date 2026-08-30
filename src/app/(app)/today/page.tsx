"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarCheck, CheckCircle, Clock, Plus, RefreshCw } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { PageShell } from "@/components/layout/page-shell"
import { AppointmentCard } from "@/components/appointments/appointment-card"
import { AppointmentDetailSheet } from "@/components/appointments/appointment-detail-sheet"
import { EmptyState } from "@/components/shared/empty-state"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { UnavailableNotice } from "@/components/booking/unavailable-notice"
import { KpiCard } from "@/components/today/kpi-card"
import { NowPanel } from "@/components/today/now-panel"
import { PendingOnlineCard } from "@/components/today/pending-online-card"
import { getNowRows, getPendingOnline, getTodayStats } from "@/components/today/today-facts"
import { useTodayAppointments } from "@/hooks/use-appointments"
import { useEmployees, useEmployeesWorkingHours, useServices } from "@/hooks/use-staff"
import { useAuth } from "@/hooks/use-auth"
import { useSalon } from "@/hooks/use-salon"
import { useMediaQuery } from "@/hooks/use-media-query"
import { capitalizeFirst, formatCurrencyRounded } from "@/lib/utils/format"
import Link from "next/link"
import type { Appointment } from "@/types/appointment"

// Tailwind's `lg:` breakpoint (1024px), igual que `page-shell.tsx`. D27: el
// unico `useMediaQuery` de la pantalla -- las diferencias por ancho se
// deciden en JS (montaje condicional), nunca con pares de clases
// `hidden lg:...`: jsdom no aplica CSS, asi que un arbol duplicado seguiria
// en el DOM y dos `aria-label="Actualizar"` conviven a la vez.
const DESKTOP_QUERY = "(min-width: 1024px)"

export default function TodayPage() {
  const today = format(new Date(), "yyyy-MM-dd")
  const { data, dataUpdatedAt, isLoading, refetch, isRefetching } = useTodayAppointments(today)
  const queryClient = useQueryClient()
  const {
    data: servicesData,
    isLoading: servicesLoading,
    error: servicesError,
  } = useServices()
  const { user } = useAuth()
  const { data: salon } = useSalon()
  const { data: employeesData } = useEmployees()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  // Sin servicios no hay nada que reservar: no tiene sentido mostrar
  // contadores de citas ni el hueco vacio generico de "no hay citas hoy" como
  // si todo funcionase con normalidad. Se espera a que la carga de servicios
  // resuelva para no mostrar este aviso un instante antes de saber si hay o
  // no catalogo.
  //
  // `!servicesError` es obligatorio: sin el, un 5xx/red en el GET deja
  // `isLoading` en false y `data` en undefined, y el `?? 0` de abajo confunde
  // "no ha podido cargar" con "no tiene ninguno" -- sustituyendo la agenda
  // entera por este aviso y perdiendo tarjetas y citas de hoy por un fallo
  // que nada tiene que ver con el catalogo real.
  const hasNoServices =
    !servicesLoading && !servicesError && (servicesData?.content.length ?? 0) === 0

  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const appointments = data?.content ?? []

  // D7/D8: mismo criterio de exclusion que `EXCLUDED_STATUSES` en
  // `today-facts.ts` (CANCELLED/NO_SHOW no son "una cita de hoy" en ningun
  // sentido util). La lista y el KPI pintan A PROPOSITO el MISMO conjunto --
  // filtrando aqui, antes de repartirlo a `getTodayStats`, `getPendingOnline`,
  // `getNowRows` y al `.map` que dibuja las tarjetas -- para que nadie pueda
  // "arreglar" uno de los dos por separado y dejarlos desincronizados otra
  // vez (el KPI diciendo 8 con 10 tarjetas debajo). Si el criterio de
  // exclusion cambia, cambialo tambien en `EXCLUDED_STATUSES`.
  const visibleAppointments = useMemo(
    () => appointments.filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW"),
    [appointments]
  )

  // Sort by startTime
  const sorted = useMemo(
    () => [...visibleAppointments].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [visibleAppointments]
  )

  const stats = useMemo(() => getTodayStats(sorted), [sorted])
  const pendingOnline = useMemo(() => getPendingOnline(sorted), [sorted])

  const employees = useMemo(() => employeesData?.content ?? [], [employeesData])
  const employeeIds = useMemo(() => employees.map((employee) => employee.id), [employees])
  const { data: hoursByEmployee, isLoading: hoursLoading } = useEmployeesWorkingHours(employeeIds)

  // El reloj y los datos vienen SIEMPRE del mismo instante, por construccion
  // -- no por disciplina. Invariante: "el reloj nunca es mas viejo que los
  // datos que acompana". `dataUpdatedAt` (react-query) solo se mueve cuando
  // llega una respuesta nueva, asi que `now` sigue siendo estable entre
  // renders (no cambia al teclear en un buscador, igual que buscaba D33),
  // pero deja de poder desincronizarse del panel que alimenta: un refetch en
  // segundo plano (`refetchOnWindowFocus`, `query-provider.tsx`) trae datos Y
  // reloj nuevos a la vez, nunca uno sin el otro. Alimenta a `getNowRows` y al
  // rotulo de la hora del subtitulo de escritorio -- NUNCA a `getTodayStats`,
  // que no lo recibe. `|| Date.now()` cubre el instante antes de la primera
  // respuesta, cuando `dataUpdatedAt` todavia vale 0.
  const now = useMemo(() => new Date(dataUpdatedAt || Date.now()), [dataUpdatedAt])

  const nowRows = useMemo(
    () => getNowRows(sorted, employees, hoursByEmployee, now, hoursLoading),
    [sorted, employees, hoursByEmployee, now, hoursLoading]
  )

  // D37: sin ninguna fila "busy" o "free" no hay nada que decir sobre el
  // presente del salon -- ni la tarjeta ni su rotulo se montan. Las filas
  // "off" NO sostienen el panel por si solas: un salon cerrado con tres
  // empleados que hoy libran y nadie mas no es "el estado del salon ahora
  // mismo", es una lista de ausencias.
  const showNowPanel = nowRows.some((row) => row.kind !== "off")

  const handleTapAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setSheetOpen(true)
  }

  // El boton "Actualizar" refresca las TRES fuentes que sostienen este panel,
  // no solo las citas: un empleado cuya peticion de horario fallo
  // (`use-staff.ts`, deja fuera del mapa a quien falla) o cuyos datos
  // cambiaron nunca se recuperaba pulsando este boton -- con
  // `retry: failureCount < 1` y 5 minutos de `staleTime`, el unico remedio
  // era recargar la pagina entera. `now` ya no necesita re-sembrarse aqui:
  // al llegar la respuesta de `refetch()`, `dataUpdatedAt` cambia solo y
  // arrastra el reloj con el (ver comentario de `now` arriba).
  const handleRefresh = () => {
    refetch()
    queryClient.invalidateQueries({ queryKey: ["employees"] })
    queryClient.invalidateQueries({ queryKey: ["employee-working-hours"] })
  }

  const greetingTitle = `${getGreeting()}${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`
  // `capitalizeFirst`, no la clase CSS `capitalize`: esta ultima mayusculiza
  // tambien "de" y el mes ("Martes, 27 De Agosto"), distinto de lo que dibuja
  // el artboard ("Martes, 27 de agosto") -- mismo criterio que `/calendar`
  // (`calendar/page.tsx`), de donde viene este helper compartido.
  const todayLabel = capitalizeFirst(format(new Date(), "EEEE, d 'de' MMMM", { locale: es }))

  return (
    <PageShell
      title={greetingTitle}
      // D25: la cabecera movil pinta el NOMBRE DEL SALON (`Main.dc.html:24`),
      // no el saludo -- ese vive en el cuerpo. Sin resolver todavia el `name`
      // (`useSalon()` en vuelo), el default de `mobileTitle` (= `title`) cae
      // solo, evitando una cabecera en blanco un instante.
      mobileTitle={salon?.name}
      subtitle={`${todayLabel} · ${format(now, "HH:mm")}`}
      actions={
        <>
          {/*
            HoyDesktop.dc.html:80-81: 38x38, borde #E7DCCF, radio 8px, icono
            de 17px en #7A6A5F -- es un boton `outline`, no `ghost` (que es
            transparente y sin borde). El fondo NO es blanco: `variant="outline"`
            trae `bg-background` (#fbf7f2), el mismo color del fondo de la
            pagina -- convencion de todo el repo, no una excepcion de este boton.
          */}
          <Button
            variant="outline"
            size="icon"
            aria-label="Actualizar"
            onClick={handleRefresh}
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
      contentClassName="gap-5"
    >
      {isDesktop ? (
        <>
          {/*
            Un fallo puntual del GET de servicios nunca debe tapar la
            agenda: la pantalla principal del dia sigue pintandose con
            normalidad y este aviso se limita a informar aparte (nunca
            sustituye a `hasNoServices` ni al resto del cuerpo).
          */}
          {servicesError && (
            <UnavailableNotice
              title="No se ha podido comprobar tu catalogo de servicios"
              description="La agenda de hoy sigue disponible. Vuelve a intentarlo en unos minutos."
            />
          )}

          {hasNoServices ? (
            <NoServicesEmptyState />
          ) : (
            <>
              {/* KPIs: CUATRO, sin icono (HoyDesktop.dc.html:92-108) */}
              <div className="grid grid-cols-4 gap-[14px]">
                <KpiCard variant="desktop" label="Citas hoy" value={stats.total} />
                <KpiCard
                  variant="desktop"
                  label="Pendientes de confirmar"
                  value={stats.pending}
                  tone={stats.pending > 0 ? "warning" : "default"}
                />
                <KpiCard variant="desktop" label="Completadas" value={stats.completed} />
                <KpiCard
                  variant="desktop"
                  label="Facturacion prevista"
                  value={formatCurrencyRounded(stats.expectedRevenue)}
                />
              </div>

              {/* Dos columnas: 1.6fr / 1fr, gap 20px (HoyDesktop.dc.html:111) */}
              <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5">
                <div className="flex flex-col gap-[10px]">
                  <h2 className="text-[13px] leading-tight font-semibold text-muted-foreground">
                    Todas las citas de hoy
                  </h2>

                  {isLoading ? (
                    <LoadingSkeleton count={4} />
                  ) : sorted.length === 0 ? (
                    <TodayEmptyState />
                  ) : (
                    // HoyDesktop.dc.html:113: 10px entre filas -- distinto de
                    // `space-y-2` (8px), que SI es correcto en la rama movil de
                    // abajo (Main.dc.html:114): la clase no puede ser comun a
                    // los dos anchos.
                    <div className="space-y-[10px]">
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

                <div className="flex flex-col gap-[10px]">
                  {showNowPanel && (
                    <NowPanel rows={nowRows} employees={employees} now={now} variant="desktop" />
                  )}
                  {/* D17: solo escritorio -- se resuelve dentro (null sin citas) */}
                  <PendingOnlineCard appointments={pendingOnline} />
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-4">
          {/*
            D25: el saludo vive en el cuerpo en movil (Main.dc.html:33-41);
            la fecha + el refrescar de 44x44 los acompanan en la misma fila.
            En escritorio esos mismos datos ya salen en la cabecera de
            PageShell (title/subtitle), asi que esta fila entera es propia
            de este ancho.
          */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-[2px]">
              <h1 className="font-heading text-[27px] leading-[1.1] font-semibold tracking-[-0.015em]">
                {greetingTitle}
              </h1>
              <p className="text-[13px] leading-tight text-muted-foreground">{todayLabel}</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label="Actualizar"
              onClick={handleRefresh}
              disabled={isRefetching}
              className="size-11 shrink-0 text-muted-foreground"
            >
              <RefreshCw className={`size-[18px] ${isRefetching ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {servicesError && (
            <UnavailableNotice
              title="No se ha podido comprobar tu catalogo de servicios"
              description="La agenda de hoy sigue disponible. Vuelve a intentarlo en unos minutos."
            />
          )}

          {hasNoServices ? (
            <NoServicesEmptyState />
          ) : (
            <>
              {/* KPIs: TRES, con icono (Main.dc.html:44-64) */}
              <div className="grid grid-cols-3 gap-2">
                <KpiCard
                  variant="mobile"
                  label="Total"
                  value={stats.total}
                  icon={<CalendarCheck strokeWidth={1.75} />}
                />
                <KpiCard
                  variant="mobile"
                  label="Pendientes"
                  value={stats.pending}
                  icon={<Clock strokeWidth={1.75} />}
                  tone={stats.pending > 0 ? "warning" : "default"}
                />
                <KpiCard
                  variant="mobile"
                  label="Completadas"
                  value={stats.completed}
                  icon={<CheckCircle strokeWidth={1.75} />}
                />
              </div>

              {showNowPanel && (
                <NowPanel rows={nowRows} employees={employees} now={now} variant="mobile" />
              )}

              <div className="flex flex-col gap-2">
                <h2 className="text-[13px] leading-tight font-medium text-muted-foreground">
                  Todas las citas de hoy
                </h2>

                {isLoading ? (
                  <LoadingSkeleton count={4} />
                ) : sorted.length === 0 ? (
                  <TodayEmptyState />
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
      )}

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

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Buenos dias"
  if (hour < 20) return "Buenas tardes"
  return "Buenas noches"
}

// Pieza a conservar (no la dibuja ningun artboard): sin servicios no hay
// nada que reservar, asi que se sustituye la agenda entera por este aviso en
// vez del vacio generico de citas.
function NoServicesEmptyState() {
  return (
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
  )
}

// Pieza a conservar (no la dibuja ningun artboard): el vacio de "hoy sin
// citas todavia", distinto del de "sin servicios" de arriba.
function TodayEmptyState() {
  return (
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
  )
}
