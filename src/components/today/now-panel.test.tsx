import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { NowPanel } from "./now-panel"
import type { NowRow } from "./today-facts"
import type { Employee } from "@/types/employee"

const NOW = new Date(2026, 7, 27, 10, 10, 0) // 10:10

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp_1",
    firstName: "Laura",
    lastName: "Martinez",
    email: "laura@test.com",
    phone: null,
    jobTitle: "Estilista",
    colorHex: "#3B82F6",
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

const busyEmployee = makeEmployee({ id: "emp_busy", firstName: "Laura", lastName: "Martinez" })
const freeEmployee = makeEmployee({ id: "emp_free", firstName: "Sofia", lastName: "Puig", colorHex: "#5C7A5E" })
const freeEmployee2 = makeEmployee({ id: "emp_free_2", firstName: "Marc", lastName: "Oliva", colorHex: "#4A6274" })
const offEmployee = makeEmployee({ id: "emp_off", firstName: "Julia", lastName: "Ventura", colorHex: "#9A8A7E" })

const busyRow: NowRow = {
  kind: "busy",
  employee: busyEmployee,
  clientName: "Ana Garcia",
  serviceName: "Corte + Tinte",
  until: "11:30",
}

const freeRowWithNext: NowRow = {
  kind: "free",
  employee: freeEmployee,
  freeFor: "2h 20min",
  next: { time: "12:30", clientName: "Laia Roca" },
}

const freeRowWithoutNext: NowRow = {
  kind: "free",
  employee: freeEmployee,
  freeFor: "45min",
}

const offRow: NowRow = { kind: "off", employee: offEmployee }

const allEmployees = [busyEmployee, freeEmployee, freeEmployee2, offEmployee]

describe("NowPanel", () => {
  describe("fila busy", () => {
    it("pinta nombre, badge 'En curso' y -- SOLO en movil -- el servicio en la segunda linea", () => {
      render(<NowPanel rows={[busyRow]} employees={allEmployees} now={NOW} variant="mobile" />)

      expect(screen.getByText("Laura Martinez")).toBeInTheDocument()
      expect(screen.getByText("En curso")).toBeInTheDocument()
      expect(screen.getByText("Ana Garcia · Corte + Tinte · hasta las 11:30")).toBeInTheDocument()
    })

    it("en escritorio omite el servicio de la segunda linea (D16: ya sale en la fila de la cita)", () => {
      render(<NowPanel rows={[busyRow]} employees={allEmployees} now={NOW} variant="desktop" />)

      expect(screen.getByText("Ana Garcia · hasta las 11:30")).toBeInTheDocument()
      expect(screen.queryByText(/Corte \+ Tinte/)).not.toBeInTheDocument()
    })
  })

  describe("fila free", () => {
    it("con 'next': pinta el badge 'Libre Xh Ymin' y la segunda linea 'Siguiente: ...'", () => {
      render(<NowPanel rows={[freeRowWithNext]} employees={allEmployees} now={NOW} variant="mobile" />)

      expect(screen.getByText("Libre 2h 20min")).toBeInTheDocument()
      expect(screen.getByText("Siguiente: 12:30 · Laia Roca")).toBeInTheDocument()
    })

    it("sin 'next' (D20): omite la segunda linea entera, no inventa una frase", () => {
      render(<NowPanel rows={[freeRowWithoutNext]} employees={allEmployees} now={NOW} variant="mobile" />)

      expect(screen.getByText("Libre 45min")).toBeInTheDocument()
      expect(screen.queryByText(/Siguiente/)).not.toBeInTheDocument()
    })
  })

  describe("fila off (D18)", () => {
    it("pinta el nombre y 'Hoy no trabaja', SIN badge de tiempo", () => {
      render(<NowPanel rows={[offRow]} employees={allEmployees} now={NOW} variant="mobile" />)

      expect(screen.getByText("Julia Ventura")).toBeInTheDocument()
      expect(screen.getByText("Hoy no trabaja")).toBeInTheDocument()
      expect(screen.queryByText(/Libre|En curso/)).not.toBeInTheDocument()
    })

    it("atenua la FILA ENTERA con opacity (0.55 en movil), conservando el color real del empleado en el punto", () => {
      render(<NowPanel rows={[offRow]} employees={allEmployees} now={NOW} variant="mobile" />)

      const row = screen.getByTestId("now-row")
      expect(row).toHaveClass("opacity-[0.55]")

      const dot = within(row).getByTestId("now-row-dot")
      expect(dot).toHaveStyle({ backgroundColor: "#9A8A7E" })
    })

    it("en escritorio la opacity de la fila off es 0.5 (NuevaCitaDesktopPaso1.dc.html:112)", () => {
      render(<NowPanel rows={[offRow]} employees={allEmployees} now={NOW} variant="desktop" />)

      expect(screen.getByTestId("now-row")).toHaveClass("opacity-[0.5]")
    })
  })

  describe("orden (D37: getNowRows ya lo resuelve, aqui solo se comprueba que se respeta)", () => {
    it("pinta las filas en el mismo orden en que llegan -- busy, dos free con huecos distintos, off", () => {
      render(
        <NowPanel
          rows={[busyRow, freeRowWithNext, freeRowWithoutNext, offRow]}
          employees={allEmployees}
          now={NOW}
          variant="mobile"
        />
      )

      const rows = screen.getAllByTestId("now-row")
      expect(rows.map((row) => row.dataset.kind)).toEqual(["busy", "free", "free", "off"])
      // La segunda fila "free" (hueco mayor) va ANTES que la tercera (hueco
      // menor) porque asi llegan en `rows` -- el componente NO reordena por
      // `freeFor` (D37: eso ya lo resuelve `getNowRows`).
      expect(within(rows[1]).getByText("Libre 2h 20min")).toBeInTheDocument()
      expect(within(rows[2]).getByText("Libre 45min")).toBeInTheDocument()
    })
  })

  describe("el punto de color", () => {
    it("usa employeeSolidColor + employeePaletteIndex sobre la lista COMPLETA de empleados", () => {
      render(<NowPanel rows={[busyRow]} employees={allEmployees} now={NOW} variant="mobile" />)

      expect(screen.getByTestId("now-row-dot")).toHaveStyle({ backgroundColor: "#3B82F6" })
    })

    it("MUTACION: normaliza el -1 de employeePaletteIndex a 0 -- el empleado de la fila no esta en `employees` (inactivo), y sin la normalizacion el color caeria en el ULTIMO de la paleta en vez de en el primero", () => {
      const ghostEmployee = makeEmployee({
        id: "emp_ghost",
        firstName: "Ghost",
        lastName: "Employee",
        colorHex: null,
        isActive: false,
      })
      const ghostRow: NowRow = { kind: "busy", employee: ghostEmployee, clientName: "X", serviceName: "Y", until: "12:00" }
      // `employees` incluye al fantasma pero INACTIVO -- `employeePaletteIndex`
      // lo filtra a proposito (misma invariante que `appointment-detail-sheet.tsx:59-60`)
      // y devuelve -1. Normalizado a 0, el color de reserva es el PRIMERO de la
      // paleta (`--chart-1`, #b4522f), NUNCA el ultimo (`--chart-5`).
      render(
        <NowPanel
          rows={[ghostRow]}
          employees={[...allEmployees, ghostEmployee]}
          now={NOW}
          variant="mobile"
        />
      )

      expect(screen.getByTestId("now-row-dot")).toHaveStyle({ backgroundColor: "var(--chart-1)" })
    })
  })

  describe("las dos variantes de ancho (D15: montaje condicional, no CSS)", () => {
    it("movil: el rotulo va DENTRO de la tarjeta, junto a la hora actual", () => {
      render(<NowPanel rows={[busyRow]} employees={allEmployees} now={NOW} variant="mobile" />)

      const panel = screen.getByTestId("now-panel")
      expect(within(panel).getByText("Ahora mismo")).toBeInTheDocument()
      expect(screen.getByTestId("now-panel-current-time")).toHaveTextContent("10:10")
    })

    it("MUTACION: en escritorio la hora actual NO ESTA EN EL DOM -- no es una clase que la oculte, el nodo no existe", () => {
      render(<NowPanel rows={[busyRow]} employees={allEmployees} now={NOW} variant="desktop" />)

      expect(screen.getByText("Ahora mismo")).toBeInTheDocument()
      expect(screen.queryByTestId("now-panel-current-time")).not.toBeInTheDocument()
    })

    it("escritorio: el rotulo va en el token neutro (text-muted-foreground), no en el token del panel", () => {
      render(<NowPanel rows={[busyRow]} employees={allEmployees} now={NOW} variant="desktop" />)

      expect(screen.getByText("Ahora mismo")).toHaveClass("text-muted-foreground")
    })
  })
})
