import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { WizardSummaryAside } from "./wizard-summary-aside"

describe("WizardSummaryAside", () => {
  it("un valor ausente pinta el guion largo, no 'undefined' ni una cadena vacia", () => {
    render(
      <WizardSummaryAside
        rows={[{ label: "Profesional" }]}
        ctaLabel="Continuar"
      />
    )

    expect(screen.getByText("—")).toBeInTheDocument()
    expect(screen.queryByText("undefined")).not.toBeInTheDocument()
  })

  it("un valor presente no pinta el guion largo", () => {
    render(
      <WizardSummaryAside
        rows={[{ label: "Profesional", value: "Laura Martinez" }]}
        ctaLabel="Continuar"
      />
    )

    expect(screen.getByText("Laura Martinez")).toBeInTheDocument()
    expect(screen.queryByText("—")).not.toBeInTheDocument()
  })

  it("el CTA deshabilitado no dispara onClick", () => {
    const onCtaClick = vi.fn()
    render(
      <WizardSummaryAside rows={[]} ctaLabel="Continuar" ctaDisabled onCtaClick={onCtaClick} />
    )

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }))

    expect(onCtaClick).not.toHaveBeenCalled()
  })

  it("el CTA habilitado si dispara onClick", () => {
    const onCtaClick = vi.fn()
    render(
      <WizardSummaryAside rows={[]} ctaLabel="Continuar" onCtaClick={onCtaClick} />
    )

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }))

    expect(onCtaClick).toHaveBeenCalledTimes(1)
  })

  it("pinta la fila Total solo cuando se pasa (paso 5)", () => {
    render(
      <WizardSummaryAside
        rows={[{ label: "Servicio", value: "Corte + Tinte" }]}
        total="65,00 €"
        ctaLabel="Confirmar reserva"
      />
    )

    expect(screen.getByText("Total")).toBeInTheDocument()
    expect(screen.getByText("65,00 €")).toBeInTheDocument()
  })

  it("sin total no pinta la fila Total", () => {
    render(
      <WizardSummaryAside
        rows={[{ label: "Servicio", value: "Corte + Tinte" }]}
        ctaLabel="Continuar"
      />
    )

    expect(screen.queryByText("Total")).not.toBeInTheDocument()
  })

  it("pinta la nota de confianza con el literal exacto de escritorio", () => {
    render(<WizardSummaryAside rows={[]} ctaLabel="Continuar" />)

    expect(
      screen.getByText("Sin registro · cancela gratis hasta 24h antes")
    ).toBeInTheDocument()
  })

  it("acepta un body en vez de filas planas (paso 3)", () => {
    render(
      <WizardSummaryAside
        body={<p>Contenido rico del paso 3</p>}
        ctaLabel="Continuar"
        ctaHeight={48}
      />
    )

    expect(screen.getByText("Contenido rico del paso 3")).toBeInTheDocument()
  })

  it("con heading propio pinta ese texto en vez de 'Tu reserva'", () => {
    render(<WizardSummaryAside rows={[]} ctaLabel="Continuar" heading="Nueva cita" />)

    expect(screen.getByText("Nueva cita")).toBeInTheDocument()
    expect(screen.queryByText("Tu reserva")).not.toBeInTheDocument()
  })

  it("con note={null} no pinta la nota de confianza", () => {
    render(<WizardSummaryAside rows={[]} ctaLabel="Continuar" note={null} />)

    expect(
      screen.queryByText("Sin registro · cancela gratis hasta 24h antes")
    ).not.toBeInTheDocument()
  })

  it("sin `heading` pinta 'Tu reserva' (comportamiento por defecto de la reserva publica)", () => {
    render(<WizardSummaryAside rows={[]} ctaLabel="Continuar" />)

    expect(screen.getByText("Tu reserva")).toBeInTheDocument()
  })

  it("sin `ctaHeight` el CTA mide 46px (comportamiento por defecto de la reserva publica)", () => {
    render(<WizardSummaryAside rows={[]} ctaLabel="Continuar" />)

    const cta = screen.getByRole("button", { name: "Continuar" })
    expect(cta).toHaveClass("h-[46px]")
    expect(cta).not.toHaveClass("h-12")
  })

  it("un valor por defecto (sin `valueTone`) pinta con negrita, no con el estilo de placeholder", () => {
    render(
      <WizardSummaryAside
        rows={[{ label: "Profesional", value: "Laura Martinez" }]}
        ctaLabel="Continuar"
      />
    )

    const value = screen.getByText("Laura Martinez")
    expect(value).toHaveClass("font-semibold")
    expect(value).not.toHaveClass("text-text-placeholder")
  })

  it("`valueTone='placeholder'` pinta el valor sin negrita, con el estilo de placeholder", () => {
    render(
      <WizardSummaryAside
        rows={[{ label: "Profesional", value: "Sin elegir", valueTone: "placeholder" }]}
        ctaLabel="Continuar"
      />
    )

    const value = screen.getByText("Sin elegir")
    expect(value).toHaveClass("text-text-placeholder")
    expect(value).not.toHaveClass("font-semibold")
  })

  it("la fila Total lleva la tipografia de titular (font-heading + tracking-display)", () => {
    render(
      <WizardSummaryAside
        rows={[{ label: "Servicio", value: "Corte + Tinte" }]}
        total="65,00 €"
        ctaLabel="Confirmar reserva"
      />
    )

    const totalValue = screen.getByText("65,00 €")
    expect(totalValue).toHaveClass("font-heading")
    expect(totalValue).toHaveClass("tracking-display")
  })
})
