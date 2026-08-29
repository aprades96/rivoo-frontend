import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, it, expect } from "vitest"
import type { Employee } from "@/types/employee"
import {
  employeeFallbackAvatarClassName,
  employeeFallbackAvatarColor,
  employeeAvatarAlphaStyle,
  employeeSolidColor,
  employeePaletteIndex,
} from "./avatar"

function makeEmployee(id: string, isActive: boolean): Employee {
  return {
    id,
    firstName: id,
    lastName: "",
    email: `${id}@example.com`,
    phone: null,
    jobTitle: null,
    colorHex: null,
    isActive,
    createdAt: "2026-01-01T00:00:00Z",
  }
}

describe("employeeFallbackAvatarClassName · la paleta de reserva", () => {
  it("cada posicion apunta a su token, en orden y sin permutar", () => {
    expect(employeeFallbackAvatarClassName(0)).toBe("bg-chart-1/12 text-chart-1")
    expect(employeeFallbackAvatarClassName(1)).toBe("bg-chart-2/12 text-chart-2")
    expect(employeeFallbackAvatarClassName(2)).toBe("bg-chart-3/12 text-chart-3")
    expect(employeeFallbackAvatarClassName(3)).toBe("bg-chart-4/12 text-chart-4")
    expect(employeeFallbackAvatarClassName(4)).toBe("bg-chart-5/12 text-chart-5")
  })

  it("da la vuelta a la tabla al desbordar por arriba", () => {
    expect(employeeFallbackAvatarClassName(5)).toBe(employeeFallbackAvatarClassName(0))
    expect(employeeFallbackAvatarClassName(7)).toBe(employeeFallbackAvatarClassName(2))
  })

  it("normaliza el indice negativo en vez de devolver undefined", () => {
    // -1 mod 5 normalizado tiene que caer en la ULTIMA posicion (4), no en la
    // primera ni en undefined -- JS `%` no normaliza negativos por si solo.
    expect(employeeFallbackAvatarClassName(-1)).toBe(employeeFallbackAvatarClassName(4))
    expect(employeeFallbackAvatarClassName(-1)).toBe("bg-chart-5/12 text-chart-5")
  })

  it("dos posiciones contiguas no comparten color", () => {
    expect(employeeFallbackAvatarClassName(0)).not.toBe(employeeFallbackAvatarClassName(1))
  })

  it("los cinco tokens existen en globals.css con el color del artboard", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8")

    for (const [token, hex] of [
      ["--chart-1", "#b4522f"],
      ["--chart-2", "#5c7a5e"],
      ["--chart-3", "#4a6274"],
      ["--chart-4", "#a8762f"],
      ["--chart-5", "#7a6a5f"],
    ] as const) {
      expect(css).toContain(`${token}: ${hex};`)
    }
  })
})

describe("employeeFallbackAvatarColor · el mismo reparto, en color pleno", () => {
  it("cada posicion referencia la MISMA variable CSS que su clase de texto", () => {
    expect(employeeFallbackAvatarColor(0)).toBe("var(--chart-1)")
    expect(employeeFallbackAvatarColor(1)).toBe("var(--chart-2)")
    expect(employeeFallbackAvatarColor(4)).toBe("var(--chart-5)")
  })

  it("da la vuelta a la tabla igual que el resolutor de clases", () => {
    expect(employeeFallbackAvatarColor(5)).toBe(employeeFallbackAvatarColor(0))
  })

  it("normaliza el indice negativo", () => {
    expect(employeeFallbackAvatarColor(-1)).toBe(employeeFallbackAvatarColor(4))
  })
})

describe("employeeAvatarAlphaStyle · fondo con alfa para el avatar de iniciales", () => {
  it("fondo al 12,5% (sufijo hex '20') y texto al color pleno", () => {
    expect(employeeAvatarAlphaStyle("#B4522F")).toEqual({
      backgroundColor: "#B4522F20",
      color: "#B4522F",
    })
  })
})

describe("employeeSolidColor · el punto SOLIDO de la hoja de movil (D12)", () => {
  it("con colorHex devuelve el color del empleado tal cual, sin alfa", () => {
    expect(employeeSolidColor("#5C7A5E", 0)).toBe("#5C7A5E")
  })

  it("sin colorHex cae en la paleta de reserva, por posicion", () => {
    expect(employeeSolidColor(null, 1)).toBe(employeeFallbackAvatarColor(1))
    expect(employeeSolidColor(null, 1)).toBe("var(--chart-2)")
  })

  it("los DOS resolutores caen en el MISMO color para el mismo empleado con colorHex", () => {
    const colorHex = "#B4522F"
    expect(employeeAvatarAlphaStyle(colorHex).color).toBe(employeeSolidColor(colorHex, 0))
  })

  it("los DOS resolutores caen en el MISMO color para el mismo empleado sin colorHex", () => {
    // Sin colorHex, el color de texto de la clase de reserva (`text-chart-2`)
    // y el color solido (`var(--chart-2)`) apuntan al MISMO token para la
    // misma posicion -- no se puede comparar la clase con el color en JS
    // (jsdom no resuelve `var()`), pero los dos resolutores comparten indice
    // y token: se comprueba aqui que usan la MISMA tabla de variables.
    expect(employeeSolidColor(null, 2)).toBe(employeeFallbackAvatarColor(2))
  })
})

describe("employeePaletteIndex · resolutor UNICO de posicion en la paleta", () => {
  it("empleado activo en medio de inactivos: posicion ENTRE LOS ACTIVOS, no la de la lista cruda", () => {
    // [A(inactivo), B, C] -> B es 0, no 1 (su indice en la lista cruda).
    const employees = [makeEmployee("A", false), makeEmployee("B", true), makeEmployee("C", true)]

    expect(employeePaletteIndex(employees, "B")).toBe(0)
    expect(employeePaletteIndex(employees, "C")).toBe(1)
  })

  it("empleado inactivo: -1", () => {
    const employees = [makeEmployee("A", false), makeEmployee("B", true)]

    expect(employeePaletteIndex(employees, "A")).toBe(-1)
  })

  it("empleado que no esta: -1", () => {
    const employees = [makeEmployee("A", true), makeEmployee("B", true)]

    expect(employeePaletteIndex(employees, "Z")).toBe(-1)
  })

  it("lista vacia: -1", () => {
    expect(employeePaletteIndex([], "A")).toBe(-1)
  })
})
