import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { BookingSummaryAside } from "./booking-summary-aside"

describe("BookingSummaryAside", () => {
  it("un valor ausente pinta el guion largo, no 'undefined' ni una cadena vacia", () => {
    render(
      <BookingSummaryAside
        rows={[{ label: "Profesional" }]}
        ctaLabel="Continuar"
      />
    )

    expect(screen.getByText("—")).toBeInTheDocument()
    expect(screen.queryByText("undefined")).not.toBeInTheDocument()
  })

  it("un valor presente no pinta el guion largo", () => {
    render(
      <BookingSummaryAside
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
      <BookingSummaryAside rows={[]} ctaLabel="Continuar" ctaDisabled onCtaClick={onCtaClick} />
    )

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }))

    expect(onCtaClick).not.toHaveBeenCalled()
  })

  it("el CTA habilitado si dispara onClick", () => {
    const onCtaClick = vi.fn()
    render(
      <BookingSummaryAside rows={[]} ctaLabel="Continuar" onCtaClick={onCtaClick} />
    )

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }))

    expect(onCtaClick).toHaveBeenCalledTimes(1)
  })

  it("pinta la fila Total solo cuando se pasa (paso 5)", () => {
    render(
      <BookingSummaryAside
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
      <BookingSummaryAside
        rows={[{ label: "Servicio", value: "Corte + Tinte" }]}
        ctaLabel="Continuar"
      />
    )

    expect(screen.queryByText("Total")).not.toBeInTheDocument()
  })

  it("pinta la nota de confianza con el literal exacto de escritorio", () => {
    render(<BookingSummaryAside rows={[]} ctaLabel="Continuar" />)

    expect(
      screen.getByText("Sin registro · cancela gratis hasta 24h antes")
    ).toBeInTheDocument()
  })

  it("acepta un body en vez de filas planas (paso 3)", () => {
    render(
      <BookingSummaryAside
        body={<p>Contenido rico del paso 3</p>}
        ctaLabel="Continuar"
        ctaHeight={48}
      />
    )

    expect(screen.getByText("Contenido rico del paso 3")).toBeInTheDocument()
  })
})
