import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { DateNavigatorRow, DateNavigatorCluster } from "./date-navigator"

// El dia visible se fija con `vi.setSystemTime`: `DateNavigatorRow` decide si
// pinta el indicador "Hoy" comparando contra el reloj, y sin fijarlo la prueba
// se pondria roja sola un dia cualquiera.
const TODAY = new Date(2026, 7, 27, 10, 0) // jueves 27 de agosto de 2026
const NOT_TODAY = new Date(2026, 7, 24, 10, 0) // lunes 24 de agosto de 2026

const noop = () => {}

describe("DateNavigatorRow", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("pinta el indicador 'Hoy' cuando el dia visible es hoy", () => {
    vi.useFakeTimers()
    vi.setSystemTime(TODAY)

    render(<DateNavigatorRow date={TODAY} onPrev={noop} onNext={noop} />)

    expect(screen.getByText("Jueves, 27 de agosto")).toBeInTheDocument()
    expect(screen.getByText("Hoy")).toBeInTheDocument()
  })

  it("no pinta el indicador 'Hoy' cuando el dia visible no es hoy", () => {
    vi.useFakeTimers()
    vi.setSystemTime(TODAY)

    render(<DateNavigatorRow date={NOT_TODAY} onPrev={noop} onNext={noop} />)

    expect(screen.getByText("Lunes, 24 de agosto")).toBeInTheDocument()
    expect(screen.queryByText("Hoy")).not.toBeInTheDocument()
  })

  // El "Hoy" de la fila movil es un indicador pasivo (Calendario.dc.html:43):
  // el unico "Hoy" pulsable de la pantalla es el del cluster de escritorio.
  it("el indicador 'Hoy' no es un control pulsable", () => {
    vi.useFakeTimers()
    vi.setSystemTime(TODAY)

    render(<DateNavigatorRow date={TODAY} onPrev={noop} onNext={noop} />)

    expect(screen.queryByRole("button", { name: /hoy/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole("button")).toHaveLength(2)
  })

  it("los pasos de dia llaman a su callback y se localizan por aria-label", () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()

    render(<DateNavigatorRow date={NOT_TODAY} onPrev={onPrev} onNext={onNext} />)

    fireEvent.click(screen.getByRole("button", { name: "Dia anterior" }))
    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onNext).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Dia siguiente" }))
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onPrev).toHaveBeenCalledTimes(1)
  })
})

describe("DateNavigatorCluster", () => {
  it("los tres controles llaman a su callback, 'Hoy' incluido", () => {
    const onPrev = vi.fn()
    const onNext = vi.fn()
    const onToday = vi.fn()

    render(
      <DateNavigatorCluster onPrev={onPrev} onNext={onNext} onToday={onToday} />
    )

    fireEvent.click(screen.getByRole("button", { name: "Dia anterior" }))
    fireEvent.click(screen.getByRole("button", { name: "Hoy" }))
    fireEvent.click(screen.getByRole("button", { name: "Dia siguiente" }))

    expect(onPrev).toHaveBeenCalledTimes(1)
    expect(onToday).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  // En escritorio los tres controles conviven: sin `aria-label` en los de
  // icono, un lector de pantalla anunciaba tres botones indistinguibles.
  it("los pasos de dia tienen nombre accesible propio, distinto de 'Hoy'", () => {
    render(
      <DateNavigatorCluster onPrev={noop} onNext={noop} onToday={noop} />
    )

    const names = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent)

    expect(names).toEqual(["Dia anterior", "Hoy", "Dia siguiente"])
  })
})
