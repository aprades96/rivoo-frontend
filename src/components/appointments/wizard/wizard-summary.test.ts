import { describe, it, expect } from "vitest"
import {
  getWizardSummaryRows,
  getWizardSummaryTotal,
  getWizardSummaryCta,
  formatWizardDayShort,
  formatWizardDayFooter,
  formatWizardTimeRange,
  formatWizardContextPill,
  type WizardSummaryState,
} from "./wizard-summary"
import type { Employee } from "@/types/employee"
import type { ServiceOffering } from "@/types/service"
import type { Client } from "@/types/client"

// 2026-08-26 es miercoles: fecha real, no la ficticia de los artboards.
const DATE = "2026-08-26"
const SLOT = `${DATE}T11:00:00`

const employee: Employee = {
  id: "emp_1",
  firstName: "Laura",
  lastName: "Martinez",
  email: "laura@test.com",
  phone: null,
  jobTitle: "Estilista",
  colorHex: "#3B82F6",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
}

const service: ServiceOffering = {
  id: "svc_1",
  name: "Corte + Tinte",
  description: null,
  durationMinutes: 90,
  price: 65,
  category: null,
  isActive: true,
}

const client: Client = {
  id: "cli_1",
  firstName: "Ana",
  lastName: "Garcia",
  email: "ana@test.com",
  phone: "612345678",
  gender: null,
  dateOfBirth: null,
  notes: null,
  source: null,
  totalVisits: 14,
  lastVisitAt: null,
  gdprConsentAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}

const EMPTY_STATE: WizardSummaryState = {
  selectedEmployee: null,
  anyEmployee: false,
  selectedService: null,
  selectedDate: null,
  selectedSlot: null,
  selectedClient: null,
  newClientData: null,
}

/**
 * `Intl.NumberFormat("es-ES", { currency: "EUR" })` separa la cifra del
 * simbolo con un espacio DURO (U+00A0), no con el espacio normal tecleado a
 * mano. Sin normalizar, `"65,00 €"` no encuentra nada y el test se queda
 * verde en falso (mismo antidoto que `appointment-block.test.tsx:43-51`).
 */
function normalize(value: string): string {
  return value.replace(/ /g, " ")
}

function rowByLabel(rows: ReturnType<typeof getWizardSummaryRows>, label: string) {
  const row = rows.find((r) => r.label === label)
  if (!row) throw new Error(`no row with label "${label}"`)
  return row
}

describe("formatWizardDayShort", () => {
  it('formats "Mié 28" -- dia abreviado CON tilde, aunque el artboard lo dibuje sin ella', () => {
    expect(formatWizardDayShort(DATE)).toBe("Mié 26")
  })
})

describe("formatWizardDayFooter", () => {
  it('formats "Miércoles 28" -- nombre de dia completo + numero, sin mes ni coma', () => {
    expect(formatWizardDayFooter(DATE)).toBe("Miércoles 26")
  })
})

describe("formatWizardTimeRange", () => {
  it("computes the end time from the slot and the duration", () => {
    expect(formatWizardTimeRange(SLOT, 90)).toBe("11:00 - 12:30")
  })
})

describe("formatWizardContextPill", () => {
  it('formats "28 · 11:00" -- numero de dia suelto, sin nombre de dia', () => {
    expect(formatWizardContextPill(DATE, SLOT)).toBe("26 · 11:00")
  })
})

describe("getWizardSummaryRows", () => {
  it('paso 1: "Profesional" es SIEMPRE "Sin elegir" en tono placeholder, no la raya', () => {
    const withEmployee: WizardSummaryState = { ...EMPTY_STATE, selectedEmployee: employee }
    const row = rowByLabel(getWizardSummaryRows(withEmployee, 1), "Profesional")
    expect(row.value).toBe("Sin elegir")
    expect(row.valueTone).toBe("placeholder")
  })

  it("desde el paso 2: muestra el nombre del profesional elegido", () => {
    const state: WizardSummaryState = { ...EMPTY_STATE, selectedEmployee: employee }
    const row = rowByLabel(getWizardSummaryRows(state, 2), "Profesional")
    expect(row.value).toBe("Laura Martinez")
    expect(row.valueTone).toBeUndefined()
  })

  it('anyEmployee: muestra "Sin preferencia" desde el paso 2', () => {
    const state: WizardSummaryState = { ...EMPTY_STATE, anyEmployee: true }
    const row = rowByLabel(getWizardSummaryRows(state, 3), "Profesional")
    expect(row.value).toBe("Sin preferencia")
  })

  it("sin seleccion, fuera del paso 1: la fila queda sin value (raya)", () => {
    const row = rowByLabel(getWizardSummaryRows(EMPTY_STATE, 2), "Profesional")
    expect(row.value).toBeUndefined()
  })

  it('paso 3: "Servicio" lleva detalle "duracion · precio"', () => {
    const state: WizardSummaryState = { ...EMPTY_STATE, selectedService: service }
    const row = rowByLabel(getWizardSummaryRows(state, 3), "Servicio")
    expect(row.value).toBe("Corte + Tinte")
    expect(normalize(row.detail as string)).toBe("1h 30min · 65,00 €")
  })

  it('paso 4: "Servicio" tambien lleva el detalle', () => {
    const state: WizardSummaryState = { ...EMPTY_STATE, selectedService: service }
    const row = rowByLabel(getWizardSummaryRows(state, 4), "Servicio")
    expect(normalize(row.detail as string)).toBe("1h 30min · 65,00 €")
  })

  it('paso 5: "Servicio" NO lleva detalle -- el precio ya sale en el total', () => {
    const state: WizardSummaryState = { ...EMPTY_STATE, selectedService: service }
    const row = rowByLabel(getWizardSummaryRows(state, 5), "Servicio")
    expect(row.value).toBe("Corte + Tinte")
    expect(row.detail).toBeUndefined()
  })

  it('paso 3: "Fecha y hora" lleva solo la hora de inicio', () => {
    const state: WizardSummaryState = {
      ...EMPTY_STATE,
      selectedService: service,
      selectedDate: DATE,
      selectedSlot: SLOT,
    }
    const row = rowByLabel(getWizardSummaryRows(state, 3), "Fecha y hora")
    expect(row.value).toBe("Mié 26, 11:00")
  })

  it('pasos 4 y 5: "Fecha y hora" lleva el rango completo', () => {
    const state: WizardSummaryState = {
      ...EMPTY_STATE,
      selectedService: service,
      selectedDate: DATE,
      selectedSlot: SLOT,
    }
    expect(rowByLabel(getWizardSummaryRows(state, 4), "Fecha y hora").value).toBe(
      "Mié 26, 11:00 - 12:30"
    )
    expect(rowByLabel(getWizardSummaryRows(state, 5), "Fecha y hora").value).toBe(
      "Mié 26, 11:00 - 12:30"
    )
  })

  it('"Cliente" muestra el cliente existente elegido', () => {
    const state: WizardSummaryState = { ...EMPTY_STATE, selectedClient: client }
    expect(rowByLabel(getWizardSummaryRows(state, 5), "Cliente").value).toBe("Ana Garcia")
  })

  it('"Cliente" muestra el nombre del cliente nuevo en construccion', () => {
    const state: WizardSummaryState = {
      ...EMPTY_STATE,
      newClientData: { firstName: "Nuevo", lastName: "Cliente", email: "", phone: "" },
    }
    expect(rowByLabel(getWizardSummaryRows(state, 4), "Cliente").value).toBe("Nuevo Cliente")
  })
})

describe("getWizardSummaryTotal", () => {
  it("solo aparece en el paso 5", () => {
    const state: WizardSummaryState = { ...EMPTY_STATE, selectedService: service }
    expect(getWizardSummaryTotal(state, 3)).toBeUndefined()
    expect(getWizardSummaryTotal(state, 4)).toBeUndefined()
    expect(normalize(getWizardSummaryTotal(state, 5) as string)).toBe("65,00 €")
  })

  it("sin servicio elegido, incluso en el paso 5, no hay total", () => {
    expect(getWizardSummaryTotal(EMPTY_STATE, 5)).toBeUndefined()
  })
})

describe("getWizardSummaryCta", () => {
  it("paso 1: deshabilitado sin profesional ni anyEmployee", () => {
    expect(getWizardSummaryCta(EMPTY_STATE, 1)).toEqual({ label: "Continuar", disabled: true })
  })

  it("paso 1: habilitado con anyEmployee, sin necesidad de un empleado concreto", () => {
    const state: WizardSummaryState = { ...EMPTY_STATE, anyEmployee: true }
    expect(getWizardSummaryCta(state, 1).disabled).toBe(false)
  })

  it("paso 4: sigue deshabilitado aunque falte solo el cliente", () => {
    const state: WizardSummaryState = {
      ...EMPTY_STATE,
      selectedEmployee: employee,
      selectedService: service,
      selectedDate: DATE,
      selectedSlot: SLOT,
    }
    expect(getWizardSummaryCta(state, 4)).toEqual({ label: "Continuar", disabled: true })
  })

  it("paso 4: habilitado en cuanto hay cliente", () => {
    const state: WizardSummaryState = {
      ...EMPTY_STATE,
      selectedEmployee: employee,
      selectedService: service,
      selectedDate: DATE,
      selectedSlot: SLOT,
      selectedClient: client,
    }
    expect(getWizardSummaryCta(state, 4).disabled).toBe(false)
  })

  it('paso 5: la etiqueta es "Crear cita"', () => {
    const complete: WizardSummaryState = {
      ...EMPTY_STATE,
      selectedEmployee: employee,
      selectedService: service,
      selectedDate: DATE,
      selectedSlot: SLOT,
      selectedClient: client,
    }
    expect(getWizardSummaryCta(complete, 5)).toEqual({ label: "Crear cita", disabled: false })
  })
})
