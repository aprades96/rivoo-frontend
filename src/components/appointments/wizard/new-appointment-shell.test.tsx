import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NewAppointmentShell } from "./new-appointment-shell"

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

describe("NewAppointmentShell", () => {
  afterEach(() => {
    mockMatchMedia(false)
  })

  it("en movil, paso 1, no pinta boton de volver", () => {
    mockMatchMedia(false)
    render(
      <NewAppointmentShell step={1} title="Elige un profesional" onClose={() => {}}>
        <p>contenido</p>
      </NewAppointmentShell>
    )

    expect(screen.queryByRole("button", { name: "Volver" })).not.toBeInTheDocument()
  })

  it("en movil, a partir del paso 2 con onBack, pinta el chevron de volver", () => {
    mockMatchMedia(false)
    render(
      <NewAppointmentShell step={2} title="Elige un servicio" onBack={() => {}} onClose={() => {}}>
        <p>contenido</p>
      </NewAppointmentShell>
    )

    expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument()
  })

  it("la X llama a onClose", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    mockMatchMedia(false)
    render(
      <NewAppointmentShell step={1} title="Elige un profesional" onClose={onClose}>
        <p>contenido</p>
      </NewAppointmentShell>
    )

    await user.click(screen.getByRole("button", { name: "Cerrar" }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("en escritorio monta el stepper y el aside, y no el pie", () => {
    mockMatchMedia(true)
    render(
      <NewAppointmentShell
        step={1}
        title="Elige un profesional"
        onClose={() => {}}
        aside={<div>contenido del aside</div>}
        footer={<div>contenido del pie</div>}
      >
        <p>contenido</p>
      </NewAppointmentShell>
    )

    expect(screen.getByText("Profesional")).toBeInTheDocument()
    expect(screen.getByText("contenido del aside")).toBeInTheDocument()
    expect(screen.queryByText("contenido del pie")).not.toBeInTheDocument()
  })

  it("en movil monta el pie y no el aside", () => {
    mockMatchMedia(false)
    render(
      <NewAppointmentShell
        step={3}
        title="Elige fecha y hora"
        onClose={() => {}}
        aside={<div>contenido del aside</div>}
        footer={<div>contenido del pie</div>}
      >
        <p>contenido</p>
      </NewAppointmentShell>
    )

    expect(screen.getByText("contenido del pie")).toBeInTheDocument()
    expect(screen.queryByText("contenido del aside")).not.toBeInTheDocument()
  })

  it("en movil pinta el eyebrow 'Paso N de 5' y no el subtitulo", () => {
    mockMatchMedia(false)
    render(
      <NewAppointmentShell step={2} title="Elige un servicio" subtitle="Solo lo que ofrece Laura." onClose={() => {}}>
        <p>contenido</p>
      </NewAppointmentShell>
    )

    expect(screen.getByText("Paso 2 de 5")).toBeInTheDocument()
    expect(screen.queryByText("Solo lo que ofrece Laura.")).not.toBeInTheDocument()
  })

  it("en escritorio pinta el subtitulo y no el eyebrow", () => {
    mockMatchMedia(true)
    render(
      <NewAppointmentShell step={2} title="Elige un servicio" subtitle="Solo lo que ofrece Laura." onClose={() => {}}>
        <p>contenido</p>
      </NewAppointmentShell>
    )

    expect(screen.getByText("Solo lo que ofrece Laura.")).toBeInTheDocument()
    expect(screen.queryByText("Paso 2 de 5")).not.toBeInTheDocument()
  })

  it("en escritorio el contenido mide 1120px reales (max-w-[1200px] con px-10 de padding aparte)", () => {
    mockMatchMedia(true)
    const { container } = render(
      <NewAppointmentShell step={1} title="Elige un profesional" onClose={() => {}}>
        <p>contenido</p>
      </NewAppointmentShell>
    )

    const row = container.querySelector('[class*="gap-10"]')
    expect(row).toHaveClass("max-w-[1200px]")
    expect(row).not.toHaveClass("max-w-[1120px]")
  })

  it("en movil separa la barra de progreso del titulo 14px (gap-3.5), no 16px (gap-4)", () => {
    mockMatchMedia(false)
    const { container } = render(
      <NewAppointmentShell step={2} title="Elige un servicio" onClose={() => {}}>
        <p>contenido</p>
      </NewAppointmentShell>
    )

    const progressRoot = container.querySelector('[class*="gap-\\[5px\\]"]')
    expect(progressRoot?.parentElement).toHaveClass("gap-3.5")
    expect(progressRoot?.parentElement).not.toHaveClass("gap-4")
  })

  it("en escritorio el paso superado usa text-text-subtle (#B8A99C, artboards de NuevaCita) y no text-muted-foreground", () => {
    mockMatchMedia(true)
    render(
      <NewAppointmentShell step={2} title="Elige un servicio" onClose={() => {}}>
        <p>contenido</p>
      </NewAppointmentShell>
    )

    const completedLabel = screen.getByText("Profesional").closest("div")
    expect(completedLabel).toHaveClass("text-text-subtle")
    expect(completedLabel).not.toHaveClass("text-muted-foreground")
  })

  it("nunca monta a la vez dos CTA 'Continuar' (aside y pie)", () => {
    mockMatchMedia(false)
    render(
      <NewAppointmentShell
        step={3}
        title="Elige fecha y hora"
        onClose={() => {}}
        aside={<button>Continuar</button>}
        footer={<button>Continuar</button>}
      >
        <p>contenido</p>
      </NewAppointmentShell>
    )

    expect(screen.getByRole("button", { name: "Continuar" })).toBeInTheDocument()
  })
})
