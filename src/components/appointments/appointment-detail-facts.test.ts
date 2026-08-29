import { describe, it, expect } from "vitest"
import {
  getAppointmentTimeRange,
  getAppointmentDateAndDuration,
  getAppointmentServicePrice,
  getAppointmentServiceSummary,
  getAppointmentStatusLabel,
  getAppointmentSourceLabel,
  getAppointmentSheetMeta,
  getAppointmentPanelMeta,
} from "./appointment-detail-facts"
import type { Appointment, AppointmentStatus } from "@/types/appointment"

const DAY = "2026-03-22"

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "apt_1",
    tenantId: "tenant_1",
    clientId: "cli_1",
    clientName: "Ana Garcia",
    clientPhone: "612345678",
    clientEmail: "ana@mail.com",
    employeeId: "emp_1",
    employeeName: "Laura Martinez",
    serviceId: "svc_1",
    serviceName: "Corte y secado",
    servicePrice: 65,
    serviceDurationMinutes: 90,
    startTime: `${DAY}T10:00:00`,
    endTime: `${DAY}T11:30:00`,
    status: "PENDING" as AppointmentStatus,
    source: "ONLINE",
    notes: null,
    reminderSent: true,
    createdAt: `${DAY}T08:00:00`,
    updatedAt: `${DAY}T08:00:00`,
    ...overrides,
  }
}

/**
 * `Intl.NumberFormat("es-ES", { currency: "EUR" })` separa la cifra del
 * simbolo con un espacio DURO (U+00A0), no con el espacio normal que se lee
 * en el artboard. Sin normalizar, `"65,00 €"` tecleado a mano no encuentra
 * nada y el test se queda verde en falso (antidoto ya usado en
 * `appointment-block.test.tsx:40-51`).
 */
function normalize(value: string): string {
  return value.replace(/ /g, " ")
}

describe("getAppointmentTimeRange", () => {
  it("formats the start - end range (DetalleCita:54)", () => {
    expect(getAppointmentTimeRange(makeAppointment())).toBe("10:00 - 11:30")
  })
})

describe("getAppointmentDateAndDuration", () => {
  it("combines the long date with the duration (DetalleCita:54)", () => {
    // 2026-03-22 es domingo.
    expect(getAppointmentDateAndDuration(makeAppointment())).toBe(
      "Domingo, 22 de marzo · 1h 30min"
    )
  })

  it("is identical regardless of variant -- movil y escritorio comparten esta cadena", () => {
    const appointment = makeAppointment()
    expect(getAppointmentDateAndDuration(appointment)).toBe(
      getAppointmentDateAndDuration(appointment)
    )
  })
})

describe("getAppointmentServicePrice", () => {
  it("formats the price with formatCurrency (DetalleCitaDesktop:96)", () => {
    expect(normalize(getAppointmentServicePrice(makeAppointment()))).toBe("65,00 €")
  })
})

describe("getAppointmentServiceSummary", () => {
  it("combines duration and price for the mobile service row (DetalleCita:80)", () => {
    expect(normalize(getAppointmentServiceSummary(makeAppointment()))).toBe(
      "1h 30min · 65,00 €"
    )
  })
})

describe("getAppointmentStatusLabel", () => {
  it("uses the short label from statusConfig on the sheet variant", () => {
    const appointment = makeAppointment({ status: "PENDING" })
    expect(getAppointmentStatusLabel(appointment, "sheet")).toBe("Pendiente")
  })

  it("uses the long label on the panel variant for PENDING (DetalleCitaDesktop:259)", () => {
    const appointment = makeAppointment({ status: "PENDING" })
    expect(getAppointmentStatusLabel(appointment, "panel")).toBe("Pendiente de confirmar")
  })

  it("falls back to the short label on panel for statuses without a long variant", () => {
    const appointment = makeAppointment({ status: "CONFIRMED" })
    expect(getAppointmentStatusLabel(appointment, "panel")).toBe("Confirmada")
    expect(getAppointmentStatusLabel(appointment, "sheet")).toBe("Confirmada")
  })
})

describe("getAppointmentSourceLabel", () => {
  it("maps ONLINE to 'Reserva online' (the only one drawn in the artboards)", () => {
    expect(getAppointmentSourceLabel("ONLINE")).toBe("Reserva online")
  })

  it("maps the other known sources", () => {
    expect(getAppointmentSourceLabel("PHONE")).toBe("Telefono")
    expect(getAppointmentSourceLabel("WALK_IN")).toBe("Sin cita")
    expect(getAppointmentSourceLabel("MANUAL")).toBe("Manual")
  })
})

describe("getAppointmentSheetMeta", () => {
  it("prefixes with 'Fuente:' and appends the reminder with a capital letter (DetalleCita:114)", () => {
    const appointment = makeAppointment({ source: "ONLINE", reminderSent: true })
    expect(getAppointmentSheetMeta(appointment)).toBe(
      "Fuente: Reserva online · Recordatorio enviado"
    )
  })

  it("drops the reminder segment when reminderSent is false", () => {
    const appointment = makeAppointment({ source: "ONLINE", reminderSent: false })
    expect(getAppointmentSheetMeta(appointment)).toBe("Fuente: Reserva online")
  })
})

describe("getAppointmentPanelMeta", () => {
  it("has no 'Fuente:' prefix, lowercases 'recibida'/'recordatorio' and abbreviates the relative time (DetalleCitaDesktop:311)", () => {
    const appointment = makeAppointment({
      source: "ONLINE",
      createdAt: `${DAY}T08:00:00`,
      reminderSent: true,
    })
    const now = new Date(2026, 2, 22, 10, 0, 0) // 2h after createdAt
    expect(getAppointmentPanelMeta(appointment, now)).toBe(
      "Reserva online · recibida hace 2 h · recordatorio enviado"
    )
  })

  it("drops the reminder segment when reminderSent is false", () => {
    const appointment = makeAppointment({
      source: "ONLINE",
      createdAt: `${DAY}T08:00:00`,
      reminderSent: false,
    })
    const now = new Date(2026, 2, 22, 10, 0, 0)
    expect(getAppointmentPanelMeta(appointment, now)).toBe("Reserva online · recibida hace 2 h")
  })

  it("is a DIFFERENT string from the sheet meta, not the same one with an extra segment (§1.2 dif. 4)", () => {
    const appointment = makeAppointment({ source: "ONLINE", reminderSent: true })
    const now = new Date(2026, 2, 22, 10, 0, 0)
    expect(getAppointmentPanelMeta(appointment, now)).not.toBe(getAppointmentSheetMeta(appointment))
  })
})
