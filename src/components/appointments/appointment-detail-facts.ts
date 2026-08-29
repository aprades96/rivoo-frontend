// Derivacion PURA de los hechos que pintan la hoja de movil
// (`design/DetalleCita.dc.html`) y el panel de escritorio
// (`design/DetalleCitaDesktop.dc.html`) del detalle de una cita (D3, T4).
//
// Cero JSX aqui: hoja y panel comparten estos DATOS, pero no la maquetacion
// (D3) -- cada chasis decide donde y con que icono pinta cada cadena.

import type { Appointment, AppointmentSource } from "@/types/appointment"
import { formatTimeRange, formatDuration, formatDateLong, formatRelativeTime } from "@/lib/utils/dates"
import { formatCurrency } from "@/lib/utils/format"
import { statusConfig } from "./status-badge"

export type AppointmentDetailVariant = "sheet" | "panel"

// "10:00 - 11:30" (`DetalleCita.dc.html:54`, `DetalleCitaDesktop.dc.html:261`).
export function getAppointmentTimeRange(appointment: Appointment): string {
  return formatTimeRange(appointment.startTime, appointment.endTime)
}

// "Martes, 27 de agosto · 1h 30min" -- IDENTICA en los dos anchos
// (`DetalleCita.dc.html:54`, `DetalleCitaDesktop.dc.html:261`). `formatDate`
// NO sirve aqui (da "27 ago 2026"): la fecha larga es `formatDateLong`.
export function getAppointmentDateAndDuration(appointment: Appointment): string {
  const duration = formatDuration(appointment.serviceDurationMinutes)
  return `${formatDateLong(appointment.startTime)} · ${duration}`
}

// "65,00 €" -- lleva el espacio duro (U+00A0) que mete `Intl.NumberFormat`;
// quien lo compare en un test tiene que normalizarlo (§1.4).
export function getAppointmentServicePrice(appointment: Appointment): string {
  return formatCurrency(appointment.servicePrice)
}

// "1h 30min · 65,00 €" -- SOLO la fila de servicio de la hoja de movil pinta
// esta combinacion (`DetalleCita.dc.html:80`); el panel de escritorio separa
// duracion y precio en dos nodos distintos (`DetalleCitaDesktop.dc.html:282-291`)
// y no debe usar esta funcion.
export function getAppointmentServiceSummary(appointment: Appointment): string {
  const duration = formatDuration(appointment.serviceDurationMinutes)
  const price = getAppointmentServicePrice(appointment)
  return `${duration} · ${price}`
}

// El badge de estado NO se reinventa: `statusConfig` (`status-badge.tsx`) ya
// es la fuente unica de los rotulos. Aqui solo se decide, por ancho, si toca
// el rotulo corto o el largo -- y hoy solo PENDING tiene rotulo largo
// ("Pendiente de confirmar" en escritorio; "Pendiente" en movil, §1.2 dif. 2).
export function getAppointmentStatusLabel(
  appointment: Appointment,
  variant: AppointmentDetailVariant
): string {
  const config = statusConfig[appointment.status]
  return variant === "panel" && config.longLabel ? config.longLabel : config.label
}

// Rotulo del origen de la cita. "Reserva online" es el unico dibujado en los
// artboards (`DetalleCita.dc.html:114`, `DetalleCitaDesktop.dc.html:311`); el
// resto sigue el mismo mapeo que ya usaba `appointment-detail-sheet.tsx`.
export function getAppointmentSourceLabel(source: AppointmentSource): string {
  switch (source) {
    case "ONLINE":
      return "Reserva online"
    case "PHONE":
      return "Telefono"
    case "WALK_IN":
      return "Sin cita"
    case "MANUAL":
      return "Manual"
    default:
      return source
  }
}

// "Fuente: Reserva online · Recordatorio enviado" -- SOLO movil
// (`DetalleCita.dc.html:114`): prefijo "Fuente:" y mayuscula inicial en el
// segundo tramo. Sin recordatorio, se queda solo con la fuente.
export function getAppointmentSheetMeta(appointment: Appointment): string {
  const source = `Fuente: ${getAppointmentSourceLabel(appointment.source)}`
  return appointment.reminderSent ? `${source} · Recordatorio enviado` : source
}

// "Reserva online · recibida hace 2 h · recordatorio enviado" -- SOLO
// escritorio (`DetalleCitaDesktop.dc.html:311`): sin prefijo, en minusculas
// salvo la primera letra de la cadena, y con el relativo de `createdAt`
// abreviado (D15). `now` es inyectable para tests deterministas.
export function getAppointmentPanelMeta(appointment: Appointment, now: Date = new Date()): string {
  const source = getAppointmentSourceLabel(appointment.source)
  const received = `recibida ${formatRelativeTime(appointment.createdAt, now)}`
  const base = `${source} · ${received}`
  return appointment.reminderSent ? `${base} · recordatorio enviado` : base
}
