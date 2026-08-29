import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EmployeeFilter } from "./employee-filter"
import { employeeFallbackAvatarClassName } from "./employee-column-header"
import type { Employee } from "@/types/employee"

const DAY = "2026-08-27"

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "emp_1",
    firstName: "Laura",
    lastName: "Martinez",
    email: "laura@bellavista.test",
    phone: null,
    jobTitle: null,
    colorHex: "#B4522F",
    isActive: true,
    createdAt: `${DAY}T08:00:00`,
    ...overrides,
  }
}

/** Los dos del artboard, los dos sin color propio: caen en la paleta de reserva. */
const employees = [
  makeEmployee({ id: "emp_1", firstName: "Laura", lastName: "Martinez", colorHex: null }),
  makeEmployee({ id: "emp_2", firstName: "Sofia", lastName: "Puig", colorHex: null }),
]

function pill(name: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(name) })
}

/**
 * `src/test/setup.ts` no toca `testIdAttribute`, asi que Testing Library busca
 * `data-testid` y NO `data-slot`. Los avatares del filtro solo llevan lo
 * segundo (lo pone la primitiva), asi que se localizan por `querySelector`.
 */
function avatars(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll("[data-slot=avatar]"))
}

function fallbacks(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll("[data-slot=avatar-fallback]"))
}

describe("EmployeeFilter · la pildora en reposo", () => {
  it("la pildora en reposo es BLANCA, no del color de la pagina", () => {
    render(<EmployeeFilter employees={employees} selectedId={null} onSelect={vi.fn()} />)

    // `Calendario.dc.html:51,56,60`: background #FFFFFF sobre una hoja #FBF7F2.
    // `bg-background` ES el #FBF7F2 de la hoja: la pildora se volvia invisible.
    const idle = pill("Laura")
    expect(idle).toHaveClass("bg-card")
    expect(idle).not.toHaveClass("bg-background")

    // La seleccionada sigue siendo la teja de marca, no la blanca.
    const selected = pill("Todos")
    expect(selected).toHaveClass("bg-primary")
    expect(selected).not.toHaveClass("bg-card")
  })

  it("en reposo lleva el contorno y el peso normales, no los de la seleccionada", () => {
    render(<EmployeeFilter employees={employees} selectedId={null} onSelect={vi.fn()} />)

    const idle = pill("Sofia")
    expect(idle).toHaveClass("border-border", "font-medium", "hover:bg-muted")
    expect(idle).not.toHaveClass("border-primary")
    expect(idle).not.toHaveClass("font-semibold")
    expect(idle).not.toHaveClass("text-primary-foreground")
  })

  it("34px de alto, redonda y con borde: la geometria del artboard", () => {
    render(<EmployeeFilter employees={employees} selectedId={null} onSelect={vi.fn()} />)

    // `Calendario.dc.html:51-62`: 34px de alto y radio 999px.
    for (const name of ["Todos", "Laura", "Sofia"]) {
      const el = pill(name)
      expect(el).toHaveClass("h-[34px]", "rounded-full", "border", "shrink-0", "text-xs")
    }

    // El sangrado NO es el mismo en las dos: "Todos" no lleva avatar y va a
    // 14px por lado (`:51`); la del empleado abre hueco a la izquierda para el
    // avatar -- 0 12px 0 5px con 7px de separacion (`:52`).
    expect(pill("Todos")).toHaveClass("px-3.5")
    expect(pill("Laura")).toHaveClass("gap-[7px]", "pr-3", "pl-[5px]")
    expect(pill("Laura")).not.toHaveClass("px-3.5")
  })
})

describe("EmployeeFilter · la fila que sostiene las pildoras", () => {
  it("lleva el padding y la separacion del artboard, no otros cualesquiera", () => {
    render(<EmployeeFilter employees={employees} selectedId={null} onSelect={vi.fn()} />)

    // `Calendario.dc.html:50`: `display: flex; gap: 6px; padding: 12px 16px`.
    // Los tres valores estaban sin fijar: cambiarlos a `px-1 py-8` o el gap a
    // `gap-4` dejaba la suite entera verde y la fila descuadrada respecto al
    // canvas -- pildoras pegadas al borde y sin aire entre ellas, o al reves.
    // La fila no lleva testid propio: es el padre de las pildoras.
    const row = pill("Todos").parentElement!

    expect(row).toHaveClass("flex")
    expect(row).toHaveClass("gap-1.5") // 6px
    expect(row).toHaveClass("px-4") // 16px
    expect(row).toHaveClass("py-3") // 12px
    // Y las tres pildoras cuelgan de ELLA, o el padding no las alcanzaria.
    for (const name of ["Todos", "Laura", "Sofia"]) {
      expect(pill(name).parentElement).toBe(row)
    }
  })
})

describe("EmployeeFilter · el color de reserva tiene que cuadrar con el de escritorio", () => {
  /**
   * El reparto es por POSICION en la lista, y la lista de la que se cuenta es
   * la de los ACTIVOS -- que es la que arma `groupByEmployee` para las columnas
   * de escritorio. Si aqui se contase sobre la lista sin filtrar, un empleado
   * de baja en medio correria el indice de los que van detras y el mismo
   * empleado saldria de un color en su columna y de otro en su pildora: el
   * defecto que ya se vivio (coloreado arriba, gris abajo) con otra cara.
   *
   * Con la baja al final el fallo no se ve; tiene que ir EN MEDIO.
   */
  it("un empleado de baja en medio no corre el color de los que van detras", () => {
    const { container } = render(
      <EmployeeFilter
        employees={[
          makeEmployee({ id: "emp_1", firstName: "Laura", colorHex: null }),
          makeEmployee({ id: "emp_9", firstName: "Marc", colorHex: null, isActive: false }),
          makeEmployee({ id: "emp_2", firstName: "Sofia", colorHex: null }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />
    )

    const found = fallbacks(container)
    expect(found).toHaveLength(2)

    // Sofia es la SEGUNDA activa: le toca el indice 1, no el 2.
    for (const className of employeeFallbackAvatarClassName(1).split(" ")) {
      expect(found[1]).toHaveClass(className)
    }
    for (const className of employeeFallbackAvatarClassName(2).split(" ")) {
      expect(found[1]).not.toHaveClass(className)
    }
  })
})

describe("EmployeeFilter · el avatar de la pildora", () => {
  it("el avatar de la pildora no lleva el aro de la primitiva", () => {
    const { container } = render(
      <EmployeeFilter employees={employees} selectedId={null} onSelect={vi.fn()} />
    )

    // `ui/avatar.tsx` pinta un `after:border after:border-border` permanente; el
    // artboard dibuja estos avatares de 24px sin borde (`Calendario.dc.html:53`).
    // En Tailwind v4 la utilidad que falta se descarta EN SILENCIO: sin esta
    // asercion de clase, el aro vuelve y ninguna prueba de texto lo ve.
    const found = avatars(container)
    expect(found).toHaveLength(2)
    for (const avatar of found) {
      expect(avatar).toHaveClass("after:hidden")
      expect(avatar).toHaveClass("size-6")
    }
  })

  it("un empleado sin colorHex se colorea con la MISMA paleta que en escritorio", () => {
    const { container } = render(
      <EmployeeFilter employees={employees} selectedId={null} onSelect={vi.fn()} />
    )

    const found = fallbacks(container)
    expect(found).toHaveLength(2)

    found.forEach((fallback, index) => {
      for (const className of employeeFallbackAvatarClassName(index).split(" ")) {
        expect(fallback).toHaveClass(className)
      }
      // Sin reserva mandaba el gris por defecto de `AvatarFallback`.
      expect(fallback).not.toHaveClass("bg-muted")
      expect(fallback).not.toHaveClass("text-muted-foreground")
    })
  })

  it("con colorHex manda el color propio y no la paleta de reserva", () => {
    const { container } = render(
      <EmployeeFilter
        employees={[makeEmployee({ colorHex: "#B4522F" })]}
        selectedId={null}
        onSelect={vi.fn()}
      />
    )

    // jsdom normaliza: `#B4522F20` sale como `rgba(...)` al 12,5%.
    const fallback = fallbacks(container)[0] as HTMLElement
    expect(fallback.style.backgroundColor).toBe("rgba(180, 82, 47, 0.125)")
    expect(fallback.style.color).toBe("rgb(180, 82, 47)")
    for (const className of employeeFallbackAvatarClassName(0).split(" ")) {
      expect(fallback).not.toHaveClass(className)
    }
    expect(fallback).toHaveClass("text-[9px]", "font-bold")
    expect(fallback).toHaveTextContent("LM")
  })

  it("la pildora seleccionada manda sobre la paleta de reserva", () => {
    const { container } = render(
      <EmployeeFilter employees={employees} selectedId="emp_1" onSelect={vi.fn()} />
    )

    const fallback = fallbacks(container)[0]
    expect(fallback).toHaveClass("bg-white/22", "text-primary-foreground")
    expect(fallback).not.toHaveClass("bg-chart-1/12")
  })

  it("la seleccionada tampoco deja pasar su colorHex al avatar interior", () => {
    const { container } = render(
      <EmployeeFilter
        employees={[makeEmployee({ colorHex: "#B4522F" })]}
        selectedId="emp_1"
        onSelect={vi.fn()}
      />
    )

    // `Calendario.dc.html:53`: rgba(255,255,255,0.22) sobre la teja, no el color
    // del empleado -- que sobre #B4522F no se leeria.
    const fallback = fallbacks(container)[0] as HTMLElement
    expect(fallback).toHaveClass("bg-white/22", "text-primary-foreground")
    expect(fallback.getAttribute("style")).toBeNull()
  })
})

describe("EmployeeFilter · el estado seleccionado", () => {
  it("fondo de marca, texto blanco y contorno a juego", () => {
    render(<EmployeeFilter employees={employees} selectedId="emp_2" onSelect={vi.fn()} />)

    // `Calendario.dc.html:52`: border #B4522F, background #B4522F, color #FFFFFF.
    const selected = pill("Sofia")
    expect(selected).toHaveClass(
      "border-primary",
      "bg-primary",
      "font-semibold",
      "text-primary-foreground"
    )
    expect(selected).not.toHaveClass("bg-card")
    expect(selected).not.toHaveClass("border-border")

    // Y solo una a la vez: "Todos" vuelve a reposo cuando hay empleado elegido.
    const todos = pill("Todos")
    expect(todos).toHaveClass("bg-card", "border-border", "font-medium")
    expect(todos).not.toHaveClass("bg-primary")
  })

  it("'Todos' es la seleccionada cuando no hay empleado elegido", () => {
    render(<EmployeeFilter employees={employees} selectedId={null} onSelect={vi.fn()} />)

    expect(pill("Todos")).toHaveClass("bg-primary", "text-primary-foreground")
    expect(pill("Laura")).not.toHaveClass("bg-primary")
    expect(pill("Sofia")).not.toHaveClass("bg-primary")
  })
})

describe("EmployeeFilter · que pildoras se pintan y que avisan", () => {
  it("los empleados de baja no salen en el filtro", () => {
    render(
      <EmployeeFilter
        employees={[
          ...employees,
          makeEmployee({ id: "emp_3", firstName: "Marc", lastName: "Oliva", isActive: false }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getAllByRole("button")).toHaveLength(3) // Todos + los dos activos
    expect(screen.queryByRole("button", { name: /Marc/ })).not.toBeInTheDocument()
  })

  it("avisa con el id del empleado al pulsar su pildora, y con null en 'Todos'", async () => {
    const onSelect = vi.fn()
    render(<EmployeeFilter employees={employees} selectedId={null} onSelect={onSelect} />)

    await userEvent.click(pill("Sofia"))
    expect(onSelect).toHaveBeenCalledWith("emp_2")

    await userEvent.click(pill("Todos"))
    expect(onSelect).toHaveBeenLastCalledWith(null)
    expect(onSelect).toHaveBeenCalledTimes(2)
  })

  it("la pildora escribe solo el nombre de pila, como el artboard", () => {
    render(<EmployeeFilter employees={employees} selectedId={null} onSelect={vi.fn()} />)

    // `Calendario.dc.html:54`: "Laura", no "Laura Martinez".
    expect(pill("Laura")).toHaveTextContent(/^LMLaura$/)
    expect(pill("Laura").textContent).not.toContain("Martinez")
  })
})
