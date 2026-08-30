import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { KpiCard } from "./kpi-card"

// Icono de muestra: cualquier <svg>, el componente es quien decide su tamano
// (14px, `[&>svg]:size-3.5`), no el llamante.
function SampleIcon() {
  return <svg data-testid="sample-icon" />
}

describe("KpiCard", () => {
  describe("mobile variant (Main.dc.html:44-64)", () => {
    it("renders padding 12px, radius 8 (rounded-lg) and the 11px label", () => {
      render(<KpiCard label="Total" value={8} icon={<SampleIcon />} variant="mobile" />)

      expect(screen.getByTestId("kpi-card")).toHaveClass("p-3", "rounded-lg")
      expect(screen.getByText("Total")).toHaveClass("text-[11px]")
    })

    it("renders the icon at 14px via a descendant selector on the wrapper", () => {
      render(<KpiCard label="Total" value={8} icon={<SampleIcon />} variant="mobile" />)

      const wrapper = screen.getByTestId("kpi-card-icon")
      expect(wrapper).toHaveClass("[&>svg]:size-3.5")
      expect(screen.getByTestId("sample-icon")).toBeInTheDocument()
    })

    it("does not render an icon wrapper when no icon is given", () => {
      render(<KpiCard label="Completadas" value={3} variant="mobile" />)

      expect(screen.queryByTestId("kpi-card-icon")).not.toBeInTheDocument()
    })
  })

  describe("desktop variant (HoyDesktop.dc.html:92-108)", () => {
    it("renders padding 14/16px, radius 10 and the 12px label, without an icon slot", () => {
      render(<KpiCard label="Citas hoy" value={8} icon={<SampleIcon />} variant="desktop" />)

      expect(screen.getByTestId("kpi-card")).toHaveClass("px-4", "py-3.5", "rounded-[10px]")
      expect(screen.getByText("Citas hoy")).toHaveClass("text-[12px]")
      // HoyDesktop.dc.html:94 no dibuja icono: aunque la pagina pasase uno por
      // error, la variante desktop nunca lo pinta.
      expect(screen.queryByTestId("kpi-card-icon")).not.toBeInTheDocument()
    })
  })

  describe("value formatting", () => {
    it("passes the value through untouched -- the page formats it (formatCurrencyRounded for revenue)", () => {
      render(<KpiCard label="Facturacion prevista" value="412 €" variant="desktop" />)

      expect(screen.getByTestId("kpi-card-value")).toHaveTextContent("412 €")
    })
  })

  describe("warning tone (Pendientes / Pendientes de confirmar)", () => {
    it("applies the pending tokens to the border/background AND to the label and the number", () => {
      render(<KpiCard label="Pendientes" value={2} tone="warning" variant="mobile" />)

      expect(screen.getByTestId("kpi-card")).toHaveClass("border-warning-border", "bg-status-pending-bg")
      expect(screen.getByText("Pendientes")).toHaveClass("text-status-pending-text")
      expect(screen.getByTestId("kpi-card-value")).toHaveClass("text-status-pending-text")
    })

    it("uses the neutral border/foreground tokens when tone is not warning (default)", () => {
      render(<KpiCard label="Total" value={8} variant="mobile" />)

      const card = screen.getByTestId("kpi-card")
      expect(card).toHaveClass("border-border")
      expect(card).not.toHaveClass("border-warning-border", "bg-status-pending-bg")
      expect(screen.getByText("Total")).toHaveClass("text-muted-foreground")
      expect(screen.getByText("Total")).not.toHaveClass("text-status-pending-text")
      expect(screen.getByTestId("kpi-card-value")).toHaveClass("text-foreground")
      expect(screen.getByTestId("kpi-card-value")).not.toHaveClass("text-status-pending-text")
    })
  })
})
