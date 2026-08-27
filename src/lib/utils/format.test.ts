import { describe, it, expect } from "vitest"
import { formatCurrency, formatPhone, initials } from "./format"

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
