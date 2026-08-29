"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, addDays, subDays } from "date-fns"
import { es } from "date-fns/locale"
import { Plus } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { PageShell } from "@/components/layout/page-shell"
import { DayView, type EmployeeBreaks } from "@/components/calendar/day-view"
import {
  DateNavigatorCluster,
  DateNavigatorRow,
} from "@/components/calendar/date-navigator"
import { EmployeeFilter } from "@/components/calendar/employee-filter"
import {
  CalendarSearch,
  filterAppointmentsBySearch,
} from "@/components/calendar/calendar-search"
import { AppointmentDetailSheet } from "@/components/appointments/appointment-detail-sheet"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { useAppointments } from "@/hooks/use-appointments"
import { useEmployees, useEmployeesWorkingHours } from "@/hooks/use-staff"
import { useMediaQuery } from "@/hooks/use-media-query"
import { capitalizeFirst } from "@/lib/utils/format"
import { breakPosition, groupByEmployee, nextFreeSlot } from "@/lib/utils/calendar"
import type { Appointment } from "@/types/appointment"

// Tailwind's `lg:` breakpoint (1024px), igual que `page-shell.tsx`.
const DESKTOP_QUERY = "(min-width: 1024px)"

/**
 * La agenda del dia. Es una pantalla de REJILLA: `/calendar` esta en
 * `FILL_ROUTES` (`src/app/(app)/layout.tsx`), asi que el chasis le da
 * `h-dvh overflow-hidden` y esta pagina TIENE que pasar `layout="fill"` --
 * las dos mitades de esa invariante, que esta escrita alli. Sin `fill`, lo
 * que pase de 100dvh queda inalcanzable; con `fill` pero sin la ruta, el
 * scroll se lo vuelve a quedar la pagina. Aqui abajo cada franja del cuerpo
 * es un hijo flex directo y la unica que crece es `DayView` (`flex-1
 * min-h-0` propio), que es quien hace scroll por dentro.
 *
 * NO se montan el segmentado Dia/Semana de escritorio
 * (`design/CalendarioDesktop.dc.html:89-92`) ni su gemelo movil, el conmutador
 * de agenda (`design/Calendario.dc.html:31-33`). Estan dibujados, pero su
 * segunda opcion no lleva a ninguna parte: no existe artboard de vista
 * semanal. Es una desviacion DECIDIDA del artboard, no un olvido.
 */
export default function CalendarPage() {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(() => new Date())
  /**
   * El "ahora" del hueco libre, congelado al montar. Si se leyera el reloj en
   * cada render, el recuadro "Libre" saltaria de sitio a mitad de una
   * interaccion (basta con teclear en el buscador para provocar un render) y
   * lo que se pulsa no seria lo que se vio.
   */
  const [now] = useState(() => new Date())
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  const dateStr = format(currentDate, "yyyy-MM-dd")

  const { data: appointmentsData, isLoading: aptsLoading } = useAppointments({
    date: dateStr,
    // `employeeId` SOLO en movil. En escritorio la rejilla dibuja una columna
    // por empleado (`CalendarioDesktop.dc.html:105-128`): pedir las de uno
    // solo dejaria las demas columnas vacias, que es justo lo contrario de lo
    // que la vista muestra. El filtro de pildoras que alimenta este id es de
    // movil (`EmployeeFilter`), y alli si hay una sola columna que filtrar.
    employeeId: isDesktop ? undefined : (selectedEmployeeId ?? undefined),
    page: 0,
    size: 200,
  })

  const { data: employeesData } = useEmployees()
  // Memorizado porque `groupByEmployee` depende de el: sin esto la lista
  // seria un array nuevo en cada render y el reparto en columnas se
  // recalcularia siempre.
  const employees = useMemo(() => employeesData?.content ?? [], [employeesData])

  // Solo los activos: son los que `groupByEmployee` convierte en columna, y
  // pedir los horarios de un empleado que no se pinta seria una peticion por
  // un bloque que nadie va a ver.
  const employeeIds = useMemo(
    () => employees.filter((employee) => employee.isActive).map((employee) => employee.id),
    [employees]
  )
  const { data: workingHours } = useEmployeesWorkingHours(employeeIds)

  /**
   * TODAS las citas del dia, canceladas incluidas. El artboard las dibuja con
   * su color y su etiqueta (`CalendarioDesktop.dc.html:225-228`): esconderlas
   * deja en la rejilla un hueco que parece libre y no lo esta -- la franja
   * sigue reservada hasta que alguien la reasigne.
   */
  const dayAppointments = useMemo(() => appointmentsData?.content ?? [], [appointmentsData])

  /** Lo que se PINTA: el dia menos lo que descarte el buscador. */
  const appointments = useMemo(
    () => filterAppointmentsBySearch(dayAppointments, search),
    [dayAppointments, search]
  )

  const columns = useMemo(() => {
    const all = groupByEmployee(appointments, employees)
    // En movil la vista funde las columnas en una sola, asi que quedarse solo
    // con la del empleado elegido no cambia lo que se ve -- pero si lo que se
    // PULSA: `DayView` atribuye la franja vacia a un empleado unicamente
    // cuando recibe una columna, y con las tres seguiria mandando `null` y el
    // alta perderia el profesional que el filtro ya habia elegido.
    if (isDesktop || selectedEmployeeId === null) return all
    return all.filter((column) => column.employeeId === selectedEmployeeId)
  }, [appointments, employees, isDesktop, selectedEmployeeId])

  /**
   * El descanso es POR EMPLEADO, no del salon: el artboard lo pinta solo en la
   * columna de Laura (`CalendarioDesktop.dc.html:177-180`). De ahi el mapa
   * indexado por id -- `DayView` busca en el con el id de cada columna.
   */
  const breaks = useMemo<EmployeeBreaks>(() => {
    const byEmployee: EmployeeBreaks = {}
    for (const employeeId of employeeIds) {
      byEmployee[employeeId] = breakPosition(workingHours[employeeId], currentDate)
    }
    return byEmployee
  }, [employeeIds, workingHours, currentDate])

  /**
   * Sobre `dayAppointments`, no sobre `appointments`: el buscador cambia lo
   * que se pinta, no lo que esta ocupado. Filtrando por "Ana" el resto de
   * citas desaparece de la rejilla pero la agenda sigue llena, y calcular el
   * hueco con la lista recortada ofreceria como libre una franja que ya tiene
   * cita.
   *
   * La guarda de "solo si el dia visible es hoy" ya vive dentro de
   * `nextFreeSlot`; aqui no se repite. Los horarios son los del empleado
   * elegido: en "Todos" no hay un descanso unico que respetar.
   */
  const freeSlot = useMemo(
    () =>
      nextFreeSlot(
        dayAppointments,
        currentDate,
        now,
        selectedEmployeeId ? workingHours[selectedEmployeeId] : null
      ),
    [dayAppointments, currentDate, now, selectedEmployeeId, workingHours]
  )

  const handleAppointmentTap = (appointment: Appointment) => {
    setSelectedAppointment(appointment)
    setSheetOpen(true)
  }

  const goToPreviousDay = () => setCurrentDate((d) => subDays(d, 1))
  const goToNextDay = () => setCurrentDate((d) => addDays(d, 1))
  const goToToday = () => setCurrentDate(new Date())

  /**
   * Pulsar la rejilla lleva al alta con el dia, la hora y -- si se sabe -- el
   * profesional de la franja pulsada.
   *
   * LIMITE CONOCIDO: el asistente de `/appointments/new` todavia no lee estos
   * parametros (hace `reset()` al montar y arranca siempre en el paso 1), asi
   * que hoy la hora llega a la URL pero no al formulario. Prerrellenarlo es
   * del asistente, no de esta pantalla; lo que aqui se cierra es el otro
   * extremo: que la intencion viaje en la navegacion en vez de perderse.
   */
  const openNewAppointment = (time: string, employeeId: string | null) => {
    const params = new URLSearchParams({ date: dateStr, time })
    if (employeeId) params.set("employeeId", employeeId)
    router.push(`/appointments/new?${params.toString()}`)
  }

  const searchField = (
    <CalendarSearch
      value={search}
      onChange={setSearch}
      variant={isDesktop ? "desktop" : "mobile"}
    />
  )

  return (
    <PageShell
      layout="fill"
      // Movil: el titulo es "Citas" (`Calendario.dc.html:26`) y la fecha vive
      // en su propia fila, debajo. Escritorio: el titulo ES la fecha a 26px
      // (`CalendarioDesktop.dc.html:76`), y por eso el cluster que va pegado a
      // el no la repite -- en esta pantalla la fecha se escribe UNA sola vez.
      title={
        isDesktop
          ? capitalizeFirst(format(currentDate, "EEEE, d 'de' MMMM", { locale: es }))
          : "Citas"
      }
      titleSize="lg"
      // El navegador de fecha va pegado al titulo (`CalendarioDesktop:77-85`),
      // no es una flecha de volver -- por eso esta pantalla no lleva `back`
      // ni `desktopBack` a pesar de compartir el icono de ChevronLeft.
      titleAdjacent={
        <DateNavigatorCluster
          onPrev={goToPreviousDay}
          onNext={goToNextDay}
          onToday={goToToday}
        />
      }
      actions={
        <>
          {searchField}
          <Link href="/appointments/new" className={buttonVariants({ size: "action" })}>
            <Plus className="size-[17px]" />
            Nueva cita
          </Link>
        </>
      }
      // Solo el buscador (`Calendario.dc.html:27-34`): en movil el alta vive
      // en el boton flotante que monta `(app)/layout.tsx`, no en la cabecera.
      mobileActions={searchField}
    >
      {/*
        Sin envoltorio propio: los hijos son franjas hermanas del contenedor
        `flex min-h-0 flex-1 flex-col` de `PageShell`, que es lo que deja
        crecer a `DayView` y encogerse al resto. Un `<div>` intermedio sin
        `min-h-0 flex-1` corta la cadena de alturas y devuelve el scroll a la
        pagina. Tampoco hay padding aqui: cada franja trae el suyo
        (`DateNavigatorRow` y `EmployeeFilter` 16px, `DayView` 24/12px), que es
        lo que permite que las pildoras y la rejilla lleguen al borde.
      */}
      {!isDesktop && (
        <>
          <DateNavigatorRow date={currentDate} onPrev={goToPreviousDay} onNext={goToNextDay} />
          <EmployeeFilter
            employees={employees}
            selectedId={selectedEmployeeId}
            onSelect={setSelectedEmployeeId}
          />
        </>
      )}

      {aptsLoading ? (
        <LoadingSkeleton count={6} />
      ) : (
        <DayView
          variant={isDesktop ? "desktop" : "mobile"}
          columns={columns}
          breaks={breaks}
          freeSlot={freeSlot}
          onAppointmentTap={handleAppointmentTap}
          onSlotTap={(employeeId, time) => openNewAppointment(time, employeeId)}
          // `startTime` es ISO LOCAL ("2026-08-27T12:00:00"), tal y como lo
          // escribe `nextFreeSlot`: los caracteres 11-16 son la hora.
          onFreeSlotTap={(slot) =>
            openNewAppointment(slot.startTime.slice(11, 16), selectedEmployeeId)
          }
        />
      )}

      {/*
        El detalle sigue abriendose en hoja lateral. El bloque siguiente lo
        sustituye por un panel acoplado de 360px; aqui solo se conserva el
        cableado.
      */}
      <AppointmentDetailSheet
        appointment={selectedAppointment}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </PageShell>
  )
}
