import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { TimeGrid, GridRows } from "./time-grid"
import { SLOT_HEIGHT_PX, TOTAL_SLOTS, generateTimeLabels } from "@/lib/utils/calendar"

/**
 * La rejilla no tiene texto que asertar salvo las horas del canal, asi que TODO
 * lo que la distingue del artboard vive en clases y en estilos en linea. Una
 * prueba de texto aqui es verde-falsa por construccion: el canal sigue diciendo
 * "08:00" con el ancho intercambiado, con las lineas discontinuas y con un slot
 * de menos. De ahi que estas pruebas midan y comparen CLASES, no contenido.
 */

const labels = generateTimeLabels()

/** El `div` raiz que pinta `TimeGrid`, con sus 26 filas dentro. */
function renderChannel(variant: "mobile" | "desktop"): HTMLElement {
  const { container } = render(<TimeGrid variant={variant} />)
  return container.firstElementChild as HTMLElement
}

/** El `div` raiz que pinta `GridRows`: el fondo de una columna de citas. */
function renderRows(variant: "mobile" | "desktop"): HTMLElement {
  const { container } = render(<GridRows variant={variant} />)
  return container.firstElementChild as HTMLElement
}

/** Suma los `height` en linea de una lista de filas. jsdom no maqueta. */
function sumHeights(rows: Element[]): number {
  return rows.reduce((total, row) => total + parseFloat((row as HTMLElement).style.height), 0)
}

describe("TimeGrid · el ancho del canal y la tipografia de su etiqueta", () => {
  /**
   * Los dos anchos son intercambiables sin que se caiga nada: el canal sigue
   * pintando las mismas 13 horas a 46 o a 64 px. La unica forma de fijarlos es
   * comparar el numero contra el artboard, y ADEMAS negar el del otro ancho --
   * si no, un `width` derivado de una constante equivocada pasa igual.
   */
  it("escritorio: canal de 64px con etiquetas de 11px a top -8px", () => {
    const channel = renderChannel("desktop")

    // `design/CalendarioDesktop.dc.html:132`.
    expect(channel).toHaveStyle({ width: "64px" })
    expect(channel).not.toHaveStyle({ width: "46px" })

    // `design/CalendarioDesktop.dc.html:133`.
    const label = screen.getByText("08:00")
    expect(label).toHaveStyle({ fontSize: "11px", top: "-8px" })
    expect(label).not.toHaveStyle({ fontSize: "10px" })
    expect(label).not.toHaveStyle({ top: "-7px" })
    expect(label).toHaveClass("absolute", "text-muted-foreground-2")

    // El canal va dentro de un flex junto a las columnas: sin `shrink-0` los
    // 64px se comprimen y las horas dejan de alinear con la rejilla. jsdom no
    // maqueta, asi que la clase es lo unico observable.
    expect(channel).toHaveClass("shrink-0", "select-none")
  })

  it("modo estrecho en escritorio: canal de 58px (design/DetalleCitaDesktop.dc.html:113,141)", () => {
    const { container } = render(<TimeGrid variant="desktop" narrow />)
    const channel = container.firstElementChild as HTMLElement

    expect(channel).toHaveStyle({ width: "58px" })
    expect(channel).not.toHaveStyle({ width: "64px" })
  })

  it("modo estrecho no tiene efecto en movil: sigue en 46px", () => {
    const { container } = render(<TimeGrid variant="mobile" narrow />)
    const channel = container.firstElementChild as HTMLElement

    expect(channel).toHaveStyle({ width: "46px" })
  })

  it("sin narrow, escritorio se queda en 64px", () => {
    const channel = renderChannel("desktop")
    expect(channel).toHaveStyle({ width: "64px" })
  })

  it("movil: canal de 46px con etiquetas de 10px a top -7px", () => {
    const channel = renderChannel("mobile")

    // `design/Calendario.dc.html:68`.
    expect(channel).toHaveStyle({ width: "46px" })
    expect(channel).not.toHaveStyle({ width: "64px" })

    // `design/Calendario.dc.html:69`.
    const label = screen.getByText("08:00")
    expect(label).toHaveStyle({ fontSize: "10px", top: "-7px" })
    expect(label).not.toHaveStyle({ fontSize: "11px" })
    expect(label).not.toHaveStyle({ top: "-8px" })
  })

  it("el canal no crece ni encoge: 26 filas de 48px en las dos variantes", () => {
    const desktop = Array.from(renderChannel("desktop").children)
    const mobile = Array.from(renderChannel("mobile").children)

    expect(desktop).toHaveLength(TOTAL_SLOTS)
    expect(mobile).toHaveLength(TOTAL_SLOTS)
    for (const row of [...desktop, ...mobile]) {
      expect(row).toHaveStyle({ height: `${SLOT_HEIGHT_PX}px` })
    }
  })

  it("solo la hora en punto lleva etiqueta: 13 horas para 26 medias horas", () => {
    const rows = Array.from(renderChannel("desktop").children)

    const labelled = rows.filter((row) => (row.textContent ?? "") !== "")
    expect(labelled).toHaveLength(TOTAL_SLOTS / 2)
    expect(rows[0]).toHaveTextContent("08:00")
    expect(rows[1]).toHaveTextContent("")
    expect(rows[2]).toHaveTextContent("09:00")
    expect(rows[TOTAL_SLOTS - 1]).toHaveTextContent("")
    expect(labels[TOTAL_SLOTS - 1]).toBe("20:30")
  })
})

/**
 * ---------------------------------------------------------------------------
 * Las lineas horizontales: solidas, y la de la hora mas oscura
 * ---------------------------------------------------------------------------
 * `time-grid.tsx:32-33` deja escrito que las lineas eran discontinuas antes de
 * este cambio. Una regresion ya vivida y corregida sin prueba que la fije se
 * vuelve a colar sola: el artboard pinta `.slot` con `border-top: 1px solid
 * #EFE6DA` (= `--hairline`) y `.slot-hour` con `1px solid #E2D6C6`
 * (= `--hairline-strong`) -- `CalendarioDesktop.dc.html:20-21` y
 * `Calendario.dc.html:18-19`, identicos.
 *
 * `not.toHaveClass("border-dashed")` es la mitad que importa: en Tailwind v4 la
 * utilidad se anade en silencio y ninguna asercion de texto o de geometria se
 * entera.
 */
function expectSolidHairlines(rows: Element[]) {
  rows.forEach((row, i) => {
    const isHour = i % 2 === 0

    expect(row).toHaveClass("border-t")
    expect(row).not.toHaveClass("border-dashed")
    expect(row).not.toHaveClass("border-dotted")

    if (isHour) {
      // La hora en punto va MAS OSCURA que la media hora, no al reves.
      expect(row).toHaveClass("border-hairline-strong")
      expect(row).not.toHaveClass("border-hairline")
    } else {
      expect(row).toHaveClass("border-hairline")
      expect(row).not.toHaveClass("border-hairline-strong")
    }
  })
}

describe("La rejilla horizontal es solida y la hora en punto va mas oscura", () => {
  it("canal de escritorio", () => {
    expectSolidHairlines(Array.from(renderChannel("desktop").children))
  })

  it("canal de movil", () => {
    expectSolidHairlines(Array.from(renderChannel("mobile").children))
  })

  it("fondo de columna de escritorio", () => {
    expectSolidHairlines(Array.from(renderRows("desktop").children))
  })

  it("fondo de columna de movil", () => {
    expectSolidHairlines(Array.from(renderRows("mobile").children))
  })
})

describe("GridRows · el borde izquierdo, la unica diferencia entre las dos variantes", () => {
  it("escritorio lo lleva (CalendarioDesktop.dc.html:152)", () => {
    const rows = renderRows("desktop")

    expect(rows).toHaveClass("relative", "border-l", "border-hairline")
    expect(rows).not.toHaveClass("border-hairline-strong")
  })

  it("movil no lo lleva (Calendario.dc.html:83)", () => {
    const rows = renderRows("mobile")

    expect(rows).toHaveClass("relative")
    expect(rows).not.toHaveClass("border-l")
    // El color sin el `border-l` tampoco vale: el borde se pintaria en cuanto
    // alguien anadiese un ancho por otro lado.
    expect(rows).not.toHaveClass("border-hairline")
  })
})

describe("GridRows · el alto tiene que ser el MISMO que el del canal", () => {
  /**
   * `day-view.tsx` monta los bloques de cita en `position: absolute` sobre este
   * fondo, con un `top` calculado desde `SLOT_HEIGHT_PX`. Si el contenedor mide
   * un slot menos que la rejilla del canal, los bloques siguen pintandose y con
   * el mismo texto: lo unico que pasa es que el fondo y las horas dejan de
   * cuadrar. Ninguna prueba de contenido lo ve; esta lo mide.
   */
  it("26 x 48 = 1248px, y el canal suma exactamente lo mismo", () => {
    const total = TOTAL_SLOTS * SLOT_HEIGHT_PX
    expect(total).toBe(1248)

    const rows = renderRows("desktop")
    expect(rows).toHaveStyle({ height: `${total}px` })

    // El canal no declara alto: lo suma de sus filas. Comparar los dos numeros
    // es lo que fija que las horizontales alineen pixel a pixel.
    const channelHeight = sumHeights(Array.from(renderChannel("desktop").children))
    expect(channelHeight).toBe(total)
    expect(parseFloat(rows.style.height)).toBe(channelHeight)
  })

  it("las filas del fondo suman su propio alto declarado: ni una de menos", () => {
    const rows = renderRows("mobile")
    const children = Array.from(rows.children)

    expect(children).toHaveLength(TOTAL_SLOTS)
    expect(sumHeights(children)).toBe(parseFloat(rows.style.height))
  })

  it("los hijos absolutos se montan encima del fondo, no lo sustituyen", () => {
    const { container } = render(
      <GridRows variant="desktop">
        <div data-testid="absolute-block" />
      </GridRows>
    )
    const rows = container.firstElementChild as HTMLElement

    expect(rows).toHaveClass("relative")
    expect(screen.getByTestId("absolute-block")).toBeInTheDocument()
    // 26 filas de fondo + el bloque, en ese orden.
    expect(rows.children).toHaveLength(TOTAL_SLOTS + 1)
    expect(rows.lastElementChild).toBe(screen.getByTestId("absolute-block"))
    expect(rows).toHaveStyle({ height: `${TOTAL_SLOTS * SLOT_HEIGHT_PX}px` })
  })
})
