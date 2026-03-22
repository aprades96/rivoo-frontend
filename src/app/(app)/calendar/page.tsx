"use client"

import { useState, useMemo } from "react"
import { format, addDays, subDays } from "date-fns"
import { DayView } from "@/components/calendar/day-view"
import { DateNavigator } from "@/components/calendar/date-navigator"
import { EmployeeFilter } from "@/components/calendar/employee-filter"
import { AppointmentDetailSheet } from "@/components/appointments/appointment-detail-sheet"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { useAppointments } from "@/hooks/use-appointments"
import { useEmployees } from "@/hooks/use-staff"
import type { Appointment } from "@/types/appointment"

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

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <DateNavigator
          date={currentDate}
          onPrev={() => setCurrentDate((d) => subDays(d, 1))}
          onNext={() => setCurrentDate((d) => addDays(d, 1))}
          onToday={() => setCurrentDate(new Date())}
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

      {/* Detail sheet (reused from F2) */}
      <AppointmentDetailSheet
        appointment={selectedAppointment}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  )
}
