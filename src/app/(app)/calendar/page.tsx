"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format, addDays, subDays } from "date-fns"
import { es } from "date-fns/locale"
import { Plus } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { PageShell } from "@/components/layout/page-shell"
import { DayView } from "@/components/calendar/day-view"
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
import { AppointmentDetailPanel } from "@/components/appointments/appointment-detail-panel"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { useAppointments } from "@/hooks/use-appointments"
import { useEmployees, useEmployeesWorkingHours } from "@/hooks/use-staff"
import { useMediaQuery } from "@/hooks/use-media-query"
import { capitalizeFirst } from "@/lib/utils/format"
import {
  breakPosition,
  groupByEmployee,
  nextFreeSlot,
  visibleBreak,
  type EmployeeBreaks,
} from "@/lib/utils/calendar"
import { cn } from "@/lib/utils"
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
 * es un hijo flex directo y la unica que crece es la del contenido -- `DayView`
 * (`flex-1 min-h-0` propio) cuando el dia esta cargado, y el envoltorio del
 * esqueleto mientras carga --, que es quien hace scroll por dentro. Las DOS
 * ramas, no solo la cargada: sin `flex-1 min-h-0 overflow-y-auto` en la de
 * carga, lo que pase de 100dvh queda igual de inalcanzable.
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
  /**
   * Lo que el usuario ha ELEGIDO en el filtro de pildoras, o `null` mientras
   * no haya tocado ninguna. No es lo mismo que haber elegido "Todos": eso es
   * `{ id: null }`. Distinguirlos es lo que permite que el estado inicial
   * dependa de una lista que llega por red sin pisar despues una eleccion ya
   * hecha.
   */
  const [employeeChoice, setEmployeeChoice] = useState<{ id: string | null } | null>(null)
  const [search, setSearch] = useState("")
  /**
   * D16: se guarda el ID, no el objeto. La mutacion optimista de
   * `use-appointments.ts:103-111` no reescribe el objeto capturado -- crea
   * otros nuevos dentro de la cache -- y el panel se queda ABIERTO tras mutar
   * (D9), asi que un objeto capturado se congelaria en el estado previo
   * (ej.: seguir anunciando "Pendiente de confirmar" tras confirmar). Es el
   * MISMO id que D10 ya necesita para el anillo de la rejilla, no uno nuevo:
   * la cita se deriva de `dayAppointments` mas abajo, en cada render.
   */
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  const dateStr = format(currentDate, "yyyy-MM-dd")

  // La lista de empleados va ANTES de la consulta de citas porque el filtro de
  // movil arranca sobre ella: sin saber quien hay no se sabe a quien pedir.
  const { data: employeesData, isLoading: employeesLoading } = useEmployees()
  // Memorizado porque `groupByEmployee` depende de el: sin esto la lista
  // seria un array nuevo en cada render y el reparto en columnas se
  // recalcularia siempre.
  const employees = useMemo(() => employeesData?.content ?? [], [employeesData])

  // Solo los activos: son los que `groupByEmployee` convierte en columna, y
  // pedir los horarios de un empleado que no se pinta seria una peticion por
  // un bloque que nadie va a ver. Tambien son los unicos elegibles en el
  // filtro (`EmployeeFilter` filtra por `isActive`), asi que el primero de
  // esta lista es el que arranca seleccionado en movil.
  const employeeIds = useMemo(
    () => employees.filter((employee) => employee.isActive).map((employee) => employee.id),
    [employees]
  )
  const { data: workingHours } = useEmployeesWorkingHours(employeeIds)

  /**
   * El filtro de movil arranca en el PRIMER EMPLEADO ACTIVO, no en "Todos".
   * Lo dice el artboard: la pildora "Todos" va en reposo y la primera empleada
   * SELECCIONADA (`Calendario.dc.html:51-55`), y la rejilla de debajo
   * (`:97-119`) pinta los tres bloques de la columna de Laura del artboard de
   * escritorio (`CalendarioDesktop.dc.html:162,168,177`: sus dos citas y el
   * almuerzo) y ninguno de los otros SEIS -- el canvas tiene nueve `.blk`,
   * tres por columna, ocho citas (2 + 3 + 3) y un descanso. Lo unico que movil
   * anade es el recuadro "Libre" (`Calendario.dc.html:112`), que en escritorio
   * no existe. Con "Todos" esa columna llevaria las ocho citas de los tres
   * empleados repartidas en carriles. "Todos" sigue existiendo, pero como
   * eleccion explicita.
   *
   * Se DERIVA en el render y no se fija con un `useEffect`: la lista llega por
   * red, y un efecto pintaria primero un fotograma en "Todos" para corregirlo
   * despues. Y como solo manda cuando `employeeChoice` es `null`, una recarga
   * de la lista no puede pisar la pildora que el usuario ya haya pulsado.
   *
   * Salon recien creado, sin empleados activos: no hay a quien seleccionar y
   * se queda en "Todos" hasta que exista alguien.
   */
  const selectedEmployeeId = employeeChoice ? employeeChoice.id : (employeeIds[0] ?? null)

  /**
   * En movil no se pinta agenda hasta saber DE QUIEN es. Las dos consultas
   * salen a la vez, y si la de citas contesta primero la pantalla llegaria a
   * pintar el dia entero fundido en una columna -- lo que el artboard no
   * dibuja -- para sustituirlo por el esqueleto en cuanto la lista de
   * empleados cambiara el filtro y con el la `queryKey`. Se espera a la
   * lista, no a que tenga contenido: si la peticion falla, `isLoading` baja
   * igual y la pantalla sigue, en "Todos".
   */
  const waitingForFilter = !isDesktop && employeesLoading

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

  /**
   * TODAS las citas del dia, canceladas incluidas. El artboard las dibuja con
   * su color y su etiqueta (`CalendarioDesktop.dc.html:225-228`): esconderlas
   * deja en la rejilla un hueco que parece libre y no lo esta -- la franja
   * sigue reservada hasta que alguien la reasigne.
   */
  const dayAppointments = useMemo(() => appointmentsData?.content ?? [], [appointmentsData])

  /**
   * La cita que muestra el panel/hoja, DERIVADA por id (D16) -- nunca
   * capturada. Si `selectedAppointmentId` ya no esta en `dayAppointments`
   * (se cambia de dia, se filtra tras cancelar) el detalle se cierra solo, sin
   * un `useEffect` que lo persiga: no hay nada que renderizar.
   */
  const selectedAppointment = useMemo(
    () => dayAppointments.find((appointment) => appointment.id === selectedAppointmentId) ?? null,
    [dayAppointments, selectedAppointmentId]
  )

  /** Lo que se PINTA: el dia menos lo que descarte el buscador. */
  const appointments = useMemo(
    () => filterAppointmentsBySearch(dayAppointments, search),
    [dayAppointments, search]
  )

  /**
   * El dia COMPLETO repartido en columnas, SIN el recorte del buscador. De
   * aqui sale el resumen de la cabecera ("4 citas · 5h 30min"), que es una
   * afirmacion de hecho sobre la agenda del empleado y no una descripcion de
   * lo que la vista deja ver: alimentado con la lista filtrada, buscar
   * "corte" dejaba a una peluquera con el dia lleno anunciada como "Sin
   * citas". Mismo criterio que `freeSlot`, que tambien lee el dia entero.
   */
  const summaryColumns = useMemo(
    () => groupByEmployee(dayAppointments, employees),
    [dayAppointments, employees]
  )

  /** Lo que se PINTA en la rejilla: el dia menos lo que descarte el buscador. */
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
   * `nextFreeSlot`; aqui no se repite.
   *
   * El descanso que se le pasa es EXACTAMENTE el mismo objeto que `DayView`
   * pinta en la columna de movil -- `visibleBreak(columns, breaks)` --, no los
   * horarios del empleado seleccionado. Pintar y calcular tienen que leer el
   * MISMO dato: cuando se mandaba `null`, el descanso no entraba en la lista
   * de ocupados y el recuadro "Libre · toca para crear" se ofrecia ENCIMA del
   * rayado del almuerzo.
   *
   * Con el filtro arrancando en un empleado, el caso normal es el limpio:
   * `columns` trae UNA columna, asi que el descanso pintado y el que entra en
   * el calculo son los de ESE empleado. La eleccion explicita de "Todos" sigue
   * pasando por aqui -- alli `visibleBreak` resuelve el primero que tenga uno,
   * y sigue siendo el mismo que se pinta.
   */
  const freeSlot = useMemo(
    () => nextFreeSlot(dayAppointments, currentDate, now, visibleBreak(columns, breaks)),
    [dayAppointments, currentDate, now, columns, breaks]
  )

  const handleAppointmentTap = (appointment: Appointment) => {
    setSelectedAppointmentId(appointment.id)
  }

  const closeAppointmentDetail = () => setSelectedAppointmentId(null)

  /**
   * Hallazgo 1: la seleccion es DEL DIA, no sobrevive a cambiar de dia. Sin
   * esto, `selectedAppointmentId` seguia vivo tras "Siguiente"/"Anterior"/"Hoy"
   * y el panel podia REAPARECER SOLO -- si el id vuelve a existir en el dia de
   * destino (p.ej. "Anterior" tras "Siguiente") -- sin que nadie lo pidiera, y
   * de paso la rejilla volvia a modo estrecho (D17) sin motivo. Ademas, justo
   * durante el vuelo del refetch, `use-appointments.ts:differsOnlyByDate`
   * presta los datos del dia anterior (misma pagina, solo cambia la fecha), asi
   * que sin limpiar aqui el panel anunciaria un instante una cita que ya no es
   * del dia visible. Limpiar en el propio navegador -- no con un `useEffect`
   * sobre `currentDate` -- evita ese fotograma intermedio.
   */
  const goToPreviousDay = () => {
    setSelectedAppointmentId(null)
    setCurrentDate((d) => subDays(d, 1))
  }
  const goToNextDay = () => {
    setSelectedAppointmentId(null)
    setCurrentDate((d) => addDays(d, 1))
  }
  const goToToday = () => {
    setSelectedAppointmentId(null)
    setCurrentDate(new Date())
  }

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

  /**
   * La rejilla o su esqueleto de carga -- MISMA rama para los dos anchos, solo
   * cambia lo que la envuelve mas abajo (D2). `min-w-0` en las dos ramas es lo
   * que deja que la fila de escritorio encoja este lado sin que el contenido
   * empuje al panel fuera de sus 360px; en la columna de movil no molesta.
   */
  const dayContent =
    aptsLoading || waitingForFilter ? (
      /*
        La rama de carga tiene que sostener la MISMA cadena de alturas que la
        rama cargada: `flex-1 min-h-0 overflow-y-auto`. `LoadingSkeleton` es
        compartido y no las trae (es un `div` con `space-y-3 p-4`), asi que
        como hijo flex directo no crecia ni hacia scroll -- y con el
        `h-dvh overflow-hidden` del chasis, en un movil de 560dvh las
        franjas fijas (56 + 62 + 58) mas el esqueleto (332) pasaban de los
        480px utiles y la ultima fila quedaba recortada e inalcanzable. El
        envoltorio va aqui, no en el componente compartido.
      */
      <div data-testid="calendar-loading" className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <LoadingSkeleton count={6} />
      </div>
    ) : (
      <DayView
        variant={isDesktop ? "desktop" : "mobile"}
        columns={columns}
        summaryColumns={summaryColumns}
        breaks={breaks}
        freeSlot={freeSlot}
        onAppointmentTap={handleAppointmentTap}
        onSlotTap={(employeeId, time) => openNewAppointment(time, employeeId)}
        // `startTime` es ISO LOCAL ("2026-08-27T12:00:00"), tal y como lo
        // escribe `nextFreeSlot`: los caracteres 11-16 son la hora.
        onFreeSlotTap={(slot) =>
          openNewAppointment(slot.startTime.slice(11, 16), selectedEmployeeId)
        }
        // D17: solo tiene efecto en `variant="desktop"`, asi que en movil da
        // igual que `selectedAppointment` exista -- alli nunca hay panel.
        narrow={isDesktop && !!selectedAppointment}
        selectedAppointmentId={selectedAppointmentId}
        className="min-w-0"
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
          {/*
            `gap-2` = los 8px que dibuja `CalendarioDesktop.dc.html:96` entre el
            "+" y el rotulo. La talla `action` trae `gap-1.5` (6px), que es la
            de los controles de cabecera del resto de artboards; se corrige
            AQUI, en la llamada, y no en `button.tsx`, que es primitiva
            compartida por quince pantallas. Va por `cn` y no concatenado: en
            el orden del atributo no manda el ultimo, manda el orden de la hoja
            de estilos -- es tailwind-merge quien borra el `gap-1.5`.
          */}
          <Link
            href="/appointments/new"
            className={cn(buttonVariants({ size: "action" }), "gap-2")}
          >
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
            onSelect={(id) => setEmployeeChoice({ id })}
          />
        </>
      )}

      {/*
        La FILA de D2 -- SOLO en escritorio: es hermana de la rejilla dentro
        de una fila `flex min-h-0 flex-1`, por DEBAJO de la barra superior,
        que sigue a ancho completo (`design/DetalleCitaDesktop.dc.html:108`).
        La capa interna de `PageShell` en `fill` es una COLUMNA que da
        servicio a doce pantallas (`page-shell.tsx:129`): la fila la monta
        esta pagina, no `PageShell`.

        Envuelve el TERNARIO COMPLETO (`dayContent`), no solo `DayView`: la
        otra rama es el esqueleto de carga, y si la fila envolviera solo la
        rama cargada el panel desapareceria y volveria en cada recarga -- que
        es justo lo que pasa tras cada mutacion, porque `onSettled` invalida
        `["appointments"]` (`use-appointments.ts:128-130`).

        En movil el arbol se queda EXACTAMENTE como esta: `dayContent` se
        pinta suelto, sin fila ni panel.
      */}
      {isDesktop ? (
        <div className="flex min-h-0 flex-1">
          {dayContent}
          <AppointmentDetailPanel appointment={selectedAppointment} onClose={closeAppointmentDetail} />
        </div>
      ) : (
        dayContent
      )}

      {/*
        Escritorio monta el PANEL (fila de arriba); movil monta la HOJA.
        Nunca los dos a la vez: montar ambos y esconder uno con CSS dejaria
        dos arboles en jsdom y rompe `getByRole` por ambiguedad (el mismo
        motivo que documenta `page-shell.tsx:101-103`).
      */}
      {!isDesktop && (
        <AppointmentDetailSheet
          appointment={selectedAppointment}
          open={selectedAppointment !== null}
          onOpenChange={(open) => {
            if (!open) closeAppointmentDetail()
          }}
        />
      )}
    </PageShell>
  )
}
