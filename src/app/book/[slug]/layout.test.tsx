import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import BookingLayout from "./layout"

describe("BookingLayout", () => {
  /**
   * Regresion: el chasis pintaba `min-h-full`, un porcentaje que no resuelve
   * porque `body` (`src/app/layout.tsx`) solo fija `min-height`, nunca
   * `height`. Sin una altura real que ocupar, el contenedor se quedaba del
   * alto de su contenido -- el mismo defecto ya corregido en
   * `(onboarding)/layout.tsx`.
   *
   * `min-h-dvh` es una unidad de viewport: resuelve siempre, sin depender de
   * que un ancestro tenga `height` explicita. No lleva variante `md:` porque
   * el layout de escritorio de esta pantalla todavia no existe.
   */
  it("gives the container a real full-viewport height instead of the inert min-h-full", () => {
    render(
      <BookingLayout>
        <div>contenido</div>
      </BookingLayout>
    )

    const shell = screen.getByText("contenido").closest("div.flex.min-h-dvh")
    expect(shell).not.toBeNull()
    expect(shell).toHaveClass("min-h-dvh")
    expect(shell).not.toHaveClass("min-h-full")
  })
})
