import { describe, it, expect, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { BookingStepShell } from "./booking-step-shell"
import type { SalonPublic } from "@/types/salon"

const salon: SalonPublic = {
  name: "Bella Vista",
  slug: "bella-vista",
  phone: "+34600000000",
  description: null,
  logoUrl: null,
  primaryColor: null,
  addressStreet: "Carrer de Verdi 42",
  addressCity: "Barcelona",
  addressPostalCode: "08012",
  businessHours: [],
  services: [],
  employees: [],
  servicesUnavailable: false,
  employeesUnavailable: false,
}

/** `matches: desktop` para simular `(min-width: 1024px)`; jsdom no tiene layout real. */
function mockMatchMedia(desktop: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: desktop,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

describe("BookingStepShell", () => {
  afterEach(() => {
    mockMatchMedia(false)
  })

  it("no pinta el boton atras sin onBack", () => {
    mockMatchMedia(false)
    render(
      <BookingStepShell salon={salon} step={1} title="Elige un servicio">
        <p>contenido</p>
      </BookingStepShell>
    )

    expect(screen.queryByRole("button", { name: "Volver" })).not.toBeInTheDocument()
  })

  /**
   * Son DOS controles, uno por breakpoint, y los dos tienen que existir. El de
   * movil vive en la cabecera de 60px y se apaga en `md:`; el de escritorio va
   * sobre el titulo y solo aparece desde `md:`. Hubo un momento en que solo
   * existia el primero, y eso dejaba al visitante de un portatil sin ninguna
   * forma de rectificar -- en la rama "ningun profesional ofrece este
   * servicio", donde no hay tarjetas pulsables ni CTA, la pantalla quedaba
   * muerta del todo. La visibilidad la decide CSS, que jsdom no aplica, asi que
   * aqui se cuenta cuantos hay: si alguien vuelve a dejar uno solo, esto se
   * pone rojo.
   */
  it("pinta los dos botones atras -- movil y escritorio -- cuando se pasa onBack", () => {
    mockMatchMedia(false)
    render(
      <BookingStepShell salon={salon} step={2} title="Con quien la quieres" onBack={() => {}}>
        <p>contenido</p>
      </BookingStepShell>
    )

    expect(screen.getAllByRole("button", { name: /volver/i })).toHaveLength(2)
  })

  it("el stepper marca como completados los pasos anteriores al actual", () => {
    mockMatchMedia(false)
    render(
      <BookingStepShell salon={salon} step={3} title="Elige fecha y hora">
        <p>contenido</p>
      </BookingStepShell>
    )

    // Pasos 1 y 2 completados: su numero se sustituye por el check, asi que
    // solo queda el texto de la etiqueta -- comprobamos que la etiqueta este
    // presente y que el numero del paso actual (3, todavia no completado)
    // siga visible como texto.
    expect(screen.getByText("Servicio")).toBeInTheDocument()
    expect(screen.getByText("Profesional")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("en movil monta el footer y no el aside", () => {
    mockMatchMedia(false)
    render(
      <BookingStepShell
        salon={salon}
        step={3}
        title="Elige fecha y hora"
        aside={<div>contenido del aside</div>}
        footer={<div>contenido del footer</div>}
      >
        <p>contenido</p>
      </BookingStepShell>
    )

    expect(screen.getByText("contenido del footer")).toBeInTheDocument()
    expect(screen.queryByText("contenido del aside")).not.toBeInTheDocument()
  })

  it("en escritorio monta el aside y no el footer", () => {
    mockMatchMedia(true)
    render(
      <BookingStepShell
        salon={salon}
        step={3}
        title="Elige fecha y hora"
        aside={<div>contenido del aside</div>}
        footer={<div>contenido del footer</div>}
      >
        <p>contenido</p>
      </BookingStepShell>
    )

    expect(screen.getByText("contenido del aside")).toBeInTheDocument()
    expect(screen.queryByText("contenido del footer")).not.toBeInTheDocument()
  })

  it("nunca monta a la vez dos botones 'Continuar' (aside y footer), la consulta por rol que ya usan los tests del repo no puede ser ambigua", () => {
    mockMatchMedia(false)
    render(
      <BookingStepShell
        salon={salon}
        step={3}
        title="Elige fecha y hora"
        aside={<button>Continuar</button>}
        footer={<button>Continuar</button>}
      >
        <p>contenido</p>
      </BookingStepShell>
    )

    // getByRole lanza si hay mas de una coincidencia: si aside y footer
    // montaran los dos a la vez (por ejemplo, ocultando con CSS en vez de no
    // montar), esta linea fallaria por ambigua -- ver public-datetime-step.test.tsx:82.
    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument()
  })
})
