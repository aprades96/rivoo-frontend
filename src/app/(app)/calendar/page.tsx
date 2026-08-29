"use client"

import { useState, useMemo } from "react"
import { format, addDays, subDays } from "date-fns"
import { es } from "date-fns/locale"
import { AlignCenter, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageShell } from "@/components/layout/page-shell"
import { DayView } from "@/components/calendar/day-view"
import { DateNavigator } from "@/components/calendar/date-navigator"
import { EmployeeFilter } from "@/components/calendar/employee-filter"
import { AppointmentDetailSheet } from "@/components/appointments/appointment-detail-sheet"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { useAppointments } from "@/hooks/use-appointments"
import { useEmployees } from "@/hooks/use-staff"
import type { Appointment } from "@/types/appointment"

// El titulo es la fecha visible ("Martes, 27 de agosto"); date-fns/es
// devuelve el dia de la semana en minuscula, y aqui solo se capitaliza la
// primera letra de la cadena (nunca con CSS `capitalize`, que tambien
// mayusculizaria "de" y el mes).
function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const dateStr = format(currentDate, "yyyy-MM-dd")

  const { data: appointmentsData, isLoading: aptsLoading } = useAppointments({
    date: dateStr,
    employeeId: selectedEmployeeId ?? undefined,
    page: 0,
    size: 200,
  })

  const { data: employeesData } = useEmployees()
  const employees = employeesData?.content ?? []

  const appointments = useMemo(() => {
    const all = appointmentsData?.content ?? []
    // Filter out cancelled for cleaner calendar
    return all.filter((a) => a.status !== "CANCELLED")
  }, [appointmentsData])

  const handleAppointmentTap = (apt: Appointment) => {
    setSelectedAppointment(apt)
    setSheetOpen(true)
  }

  const goToPreviousDay = () => setCurrentDate((d) => subDays(d, 1))
  const goToNextDay = () => setCurrentDate((d) => addDays(d, 1))
  const goToToday = () => setCurrentDate(new Date())

  return (
    <PageShell
      title={capitalizeFirst(format(currentDate, "EEEE, d 'de' MMMM", { locale: es }))}
      titleSize="lg"
      // El navegador de fecha va pegado al titulo (CalendarioDesktop:75-84),
      // no es una flecha de volver -- por eso esta pantalla no lleva `back`
      // ni `desktopBack` a pesar de compartir el icono de ChevronLeft.
      titleAdjacent={
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            aria-label="Dia anterior"
            onClick={goToPreviousDay}
            className="size-[34px]"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            onClick={goToToday}
            className="h-[34px] px-3.5 text-[13px] font-semibold"
          >
            Hoy
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Dia siguiente"
            onClick={goToNextDay}
            className="size-[34px]"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      }
      // El segmentado Dia/Semana, el buscador y el CTA de escritorio
      // (CalendarioDesktop:88-100) son del bloque del calendario: no existen
      // en el codigo y no se inventan aqui, asi que `actions` de escritorio
      // se queda vacio.
      mobileActions={
        <div className="flex items-center gap-2">
          {/*
            Buscar y el conmutador de agenda (Calendario.dc.html:28-33): solo
            presentacionales por ahora -- su funcionalidad es del bloque del
            calendario, fuera de alcance en esta tarea.
          */}
          <Button variant="outline" size="icon-lg" aria-label="Buscar">
            <Search className="size-4" />
          </Button>
          <Button variant="outline" size="icon-lg" aria-label="Cambiar vista de agenda">
            <AlignCenter className="size-4" />
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {/*
          Deuda conocida y aceptada: al ser el titulo la fecha, esta misma
          fecha vuelve a salir aqui via `DateNavigator` hasta que el bloque
          del calendario reconstruya la pantalla. No se corrige en esta tarea.
        */}
        <div className="flex items-center justify-between">
          <DateNavigator
            date={currentDate}
            onPrev={goToPreviousDay}
            onNext={goToNextDay}
            onToday={goToToday}
          />
          <span className="text-xs text-muted-foreground">
            {appointments.length} cita{appointments.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Employee filter */}
        <EmployeeFilter
          employees={employees}
          selectedId={selectedEmployeeId}
          onSelect={setSelectedEmployeeId}
        />

        {/* Day view */}
        {aptsLoading ? (
          <LoadingSkeleton count={6} />
        ) : (
          <DayView
            appointments={appointments}
            onAppointmentTap={handleAppointmentTap}
          />
        )}
      </div>

      {/* Detail sheet (reused from F2) */}
      <AppointmentDetailSheet
        appointment={selectedAppointment}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </PageShell>
  )
}
