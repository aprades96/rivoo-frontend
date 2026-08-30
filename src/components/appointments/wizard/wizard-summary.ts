// Derivacion PURA de lo que pinta el aside de escritorio del asistente de
// nueva cita (`design/NuevaCitaDesktopPaso{1..5}.dc.html`) y de los textos de
// fecha/hora que comparten movil y escritorio en los cinco pasos. Cero JSX
// aqui, igual que `appointment-detail-facts.ts`: cada paso decide su propia
// maquetacion, este modulo solo decide los DATOS.

import { format, parseISO, addMinutes } from "date-fns"
import { es } from "date-fns/locale"
import { capitalizeFirst, formatCurrency } from "@/lib/utils/format"
import { formatDurationTight } from "@/lib/utils/dates"
import type { WizardState } from "@/lib/stores/wizard-store"
import type { WizardSummaryRow } from "@/components/wizard/wizard-summary-aside"

export type WizardSummaryState = Pick<
  WizardState,
  | "selectedEmployee"
  | "anyEmployee"
  | "selectedService"
  | "selectedDate"
  | "selectedSlot"
  | "selectedClient"
  | "newClientData"
>

export interface WizardSummaryCta {
  label: string
  disabled: boolean
}

function dayAbbrev(dateIso: string): string {
  return capitalizeFirst(format(parseISO(dateIso), "EEE", { locale: es }))
}

function dayFull(dateIso: string): string {
  return capitalizeFirst(format(parseISO(dateIso), "EEEE", { locale: es }))
}

function dayNumber(dateIso: string): string {
  return format(parseISO(dateIso), "d", { locale: es })
}

// "Mié 28" -- fila "Fecha y hora" del aside de escritorio
// (`NuevaCitaDesktopPaso3.dc.html:144`, dia abreviado, CON tilde aunque el
// artboard lo dibuje sin ella por convencion de dibujo).
export function formatWizardDayShort(dateIso: string): string {
  return `${dayAbbrev(dateIso)} ${dayNumber(dateIso)}`
}

// "Miércoles 28" -- pie fijo movil del paso 3 (`NuevaCitaPaso3.dc.html:114`).
// Nombre de dia COMPLETO + numero, sin mes ni coma: no es `formatDateLong`
// (esa da "Miércoles, 28 de agosto").
export function formatWizardDayFooter(dateIso: string): string {
  return `${dayFull(dateIso)} ${dayNumber(dateIso)}`
}

// "11:00 - 12:30" -- rango de horas de un hueco, dada su duracion. Comun a la
// fila "Fecha y hora" de los pasos 4/5 y a la cabecera de la tarjeta del
// paso 5 (`NuevaCitaDesktopPaso5.dc.html:75`).
export function formatWizardTimeRange(slotIso: string, durationMinutes: number): string {
  const start = parseISO(slotIso)
  const startTime = format(start, "HH:mm")
  const endTime = format(addMinutes(start, durationMinutes), "HH:mm")
  return `${startTime} - ${endTime}`
}

// "28 · 11:00" -- pildora de contexto del paso 4 (`NuevaCitaPaso4.dc.html:57`).
// Numero de dia SUELTO, sin nombre de dia: una cuarta forma de fecha distinta
// de las otras tres, y la unica que combina fecha y hora en un solo texto.
export function formatWizardContextPill(dateIso: string, slotIso: string): string {
  const time = format(parseISO(slotIso), "HH:mm")
  return `${dayNumber(dateIso)} · ${time}`
}

function getProfessionalRow(state: WizardSummaryState, step: number): WizardSummaryRow {
  // Paso 1 SIN eleccion todavia: el artboard pinta el texto "Sin elegir" en tono
  // placeholder (`NuevaCitaDesktopPaso1.dc.html:125`), no la raya por defecto que
  // llevan las otras filas vacias.
  //
  // Acotado a "sin eleccion" A PROPOSITO: el artboard dibuja ese texto porque
  // retrata el instante en que no hay nada elegido, no porque el paso 1 deba
  // decir eso siempre. Elegir profesional avanza al paso 2, asi que estar en el
  // paso 1 CON seleccion solo pasa al volver atras -- y ahi el aside afirmaria
  // "Sin elegir" con la fila de esa persona marcada delante. El aside resume lo
  // elegido en los cinco pasos; en el paso 1 solo cambia el texto del hueco
  // vacio.
  if (step === 1 && !state.anyEmployee && !state.selectedEmployee) {
    return { label: "Profesional", value: "Sin elegir", valueTone: "placeholder" }
  }
  if (state.anyEmployee) {
    return { label: "Profesional", value: "Sin preferencia" }
  }
  if (state.selectedEmployee) {
    return {
      label: "Profesional",
      value: `${state.selectedEmployee.firstName} ${state.selectedEmployee.lastName}`,
    }
  }
  return { label: "Profesional" }
}

function getServiceRow(state: WizardSummaryState, step: number): WizardSummaryRow {
  if (!state.selectedService) return { label: "Servicio" }

  // Segunda linea (duracion · precio) SOLO en los pasos 3 y 4
  // (`NuevaCitaDesktopPaso3.dc.html:142`, `...Paso4.dc.html:132`); el paso 5
  // la deja fuera porque el precio ya sale en el total
  // (`...Paso5.dc.html:97,103`). `formatDurationTight`, no `formatDuration`:
  // los artboards del asistente pegan la unidad ("45min").
  const detail =
    step === 3 || step === 4
      ? `${formatDurationTight(state.selectedService.durationMinutes)} · ${formatCurrency(state.selectedService.price)}`
      : undefined

  return { label: "Servicio", value: state.selectedService.name, detail }
}

function getDateTimeRow(state: WizardSummaryState, step: number): WizardSummaryRow {
  if (!state.selectedDate || !state.selectedSlot) return { label: "Fecha y hora" }

  const dayPart = formatWizardDayShort(state.selectedDate)

  // Paso 3: solo la hora de inicio (`NuevaCitaDesktopPaso3.dc.html:144`,
  // "Mie 28, 11:00"). Pasos 4 y 5: rango completo
  // (`...Paso4.dc.html:134`, `...Paso5.dc.html:99`, "Mie 28, 11:00 - 12:30")
  // -- el dia va SIEMPRE delante de la hora en los tres pasos.
  if (step >= 4) {
    const duration = state.selectedService?.durationMinutes ?? 0
    return {
      label: "Fecha y hora",
      value: `${dayPart}, ${formatWizardTimeRange(state.selectedSlot, duration)}`,
    }
  }

  const startTime = format(parseISO(state.selectedSlot), "HH:mm")
  return { label: "Fecha y hora", value: `${dayPart}, ${startTime}` }
}

function getClientRow(state: WizardSummaryState): WizardSummaryRow {
  if (state.selectedClient) {
    return {
      label: "Cliente",
      value: `${state.selectedClient.firstName} ${state.selectedClient.lastName}`,
    }
  }
  if (state.newClientData) {
    return {
      label: "Cliente",
      value: `${state.newClientData.firstName} ${state.newClientData.lastName}`,
    }
  }
  return { label: "Cliente" }
}

/**
 * Filas del aside de escritorio para el paso dado. El aside NO es identico en
 * los cinco pasos -- tres variaciones medidas contra los artboards, cada una
 * documentada en su fila: "Sin elegir" en el paso 1, el detalle de servicio
 * en los pasos 3-4, y el rango horario completo desde el paso 4.
 */
export function getWizardSummaryRows(state: WizardSummaryState, step: number): WizardSummaryRow[] {
  return [
    getProfessionalRow(state, step),
    getServiceRow(state, step),
    getDateTimeRow(state, step),
    getClientRow(state),
  ]
}

// Fila "Total", solo en el paso 5 (`NuevaCitaDesktopPaso5.dc.html:103`).
export function getWizardSummaryTotal(state: WizardSummaryState, step: number): string | undefined {
  if (step !== 5) return undefined
  return state.selectedService ? formatCurrency(state.selectedService.price) : undefined
}

function isStepComplete(state: WizardSummaryState, step: number): boolean {
  switch (step) {
    case 1:
      return state.selectedEmployee !== null || state.anyEmployee
    case 2:
      return state.selectedService !== null
    case 3:
      return state.selectedDate !== null && state.selectedSlot !== null
    case 4:
      return state.selectedClient !== null || state.newClientData !== null
    case 5:
      return (
        (state.selectedEmployee !== null || state.anyEmployee) &&
        state.selectedService !== null &&
        state.selectedDate !== null &&
        state.selectedSlot !== null &&
        (state.selectedClient !== null || state.newClientData !== null)
      )
    default:
      return false
  }
}

/**
 * Etiqueta y estado del CTA del aside para el paso dado. El CTA refleja si la
 * seleccion que pide ESE paso ya esta hecha -- no si el asistente entero esta
 * completo -- que es por lo que en `NuevaCitaDesktopPaso4.dc.html:137` sigue
 * gris (`disabled`) con el profesional, servicio y hora ya elegidos: falta el
 * cliente, que es lo que pide el paso 4.
 */
export function getWizardSummaryCta(state: WizardSummaryState, step: number): WizardSummaryCta {
  return {
    label: step === 5 ? "Crear cita" : "Continuar",
    disabled: !isStepComplete(state, step),
  }
}
