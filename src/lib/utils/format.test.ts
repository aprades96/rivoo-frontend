import { describe, it, expect } from "vitest"
import { formatCurrency, formatCurrencyRounded, formatPhone, initials, capitalizeFirst } from "./format"

/**
 * `Intl.NumberFormat("es-ES", { currency: "EUR" })` separa la cifra del simbolo
 * con un espacio DURO (U+00A0), no con el espacio normal que se lee en el
 * artboard. Sin normalizar, un `toBe("412 €")` escrito con espacio normal
 * fallaria aunque el codigo sea correcto.
 */
function normalize(value: string): string {
  return value.replace(/\u00a0/g, " ")
}

describe("formatCurrency", () => {
  it("formats as EUR with Spanish locale", () => {
    const result = formatCurrency(29.99)
    expect(result).toContain("29")
    expect(result).toMatch(/€/)
  })

  it("formats zero", () => {
    const result = formatCurrency(0)
    expect(result).toContain("0")
    expect(result).toMatch(/€/)
  })

  it("formats with an explicit currency", () => {
    const result = formatCurrency(29.99, "USD")
    expect(result).toContain("29")
    expect(result).toMatch(/\$/)
  })

  it("formats with a lowercase currency code", () => {
    const result = formatCurrency(15, "eur")
    expect(result).toContain("15")
    expect(result).toMatch(/€/)
  })

  it("falls back to EUR when currency is null", () => {
    const result = formatCurrency(15, null as unknown as string)
    expect(result).toContain("15")
    expect(result).toMatch(/€/)
  })

  it("falls back to EUR when currency is an empty string", () => {
    const result = formatCurrency(15, "")
    expect(result).toContain("15")
    expect(result).toMatch(/€/)
  })

  it("falls back to EUR when currency has fewer than 3 letters", () => {
    const result = formatCurrency(15, "EU")
    expect(result).toContain("15")
    expect(result).toMatch(/€/)
  })

  it("falls back to EUR when currency is a non-letter symbol", () => {
    const result = formatCurrency(15, "€")
    expect(result).toContain("15")
    expect(result).toMatch(/€/)
  })

  it("keeps two decimals for a unit price, unlike formatCurrencyRounded", () => {
    expect(normalize(formatCurrency(412))).toBe("412,00 €")
  })
})

describe("formatCurrencyRounded", () => {
  it("rounds a whole number to a euro amount with no decimals", () => {
    expect(normalize(formatCurrencyRounded(412))).toBe("412 €")
  })

  it("rounds an amount with decimals, dropping them entirely", () => {
    expect(normalize(formatCurrencyRounded(412.4))).toBe("412 €")
  })

  it("formats zero without decimals", () => {
    expect(normalize(formatCurrencyRounded(0))).toBe("0 €")
  })

  it("falls back to EUR when currency is invalid, same as formatCurrency", () => {
    expect(normalize(formatCurrencyRounded(15, "€"))).toBe("15 €")
  })
})

describe("formatPhone", () => {
  it("formats 9-digit Spanish phone", () => {
    expect(formatPhone("612345678")).toBe("612 345 678")
  })

  it("formats 11-digit with prefix 34", () => {
    expect(formatPhone("34612345678")).toBe("+34 612 345 678")
  })

  it("returns original for unknown format", () => {
    expect(formatPhone("+1-555-0100")).toBe("+1-555-0100")
  })
})

describe("initials", () => {
  it("returns first+last initials", () => {
    expect(initials("Carlos", "Garcia")).toBe("CG")
  })

  it("returns first initial only when no last name", () => {
    expect(initials("Maria")).toBe("M")
  })

  it("uppercases", () => {
    expect(initials("ana", "lopez")).toBe("AL")
  })
})

describe("capitalizeFirst", () => {
  it("uppercases only the first letter, leaving the rest untouched", () => {
    expect(capitalizeFirst("martes, 27 de agosto")).toBe("Martes, 27 de agosto")
  })

  it("does not uppercase words after the first, unlike CSS capitalize", () => {
    expect(capitalizeFirst("miercoles, 28 de septiembre")).not.toContain("De")
  })

  it("returns an empty string unchanged", () => {
    expect(capitalizeFirst("")).toBe("")
  })
})
