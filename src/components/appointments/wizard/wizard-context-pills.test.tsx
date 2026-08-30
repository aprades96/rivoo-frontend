import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { WizardContextPills } from "./wizard-context-pills"
import { useWizardStore } from "@/lib/stores/wizard-store"
import { useEmployees } from "@/hooks/use-staff"
import { employeeFallbackAvatarClassName } from "@/lib/utils/avatar"
import type { Employee } from "@/types/employee"
import type { ServiceOffering } from "@/types/service"

vi.mock("@/hooks/use-staff", () => ({ useEmployees: vi.fn() }))

const useEmployeesMock = vi.mocked(useEmployees)

const employee: Employee = {
  id: "emp_1",
  firstName: "Laura",
  lastName: "Martinez",
  email: "laura@example.com",
  phone: null,
  jobTitle: "Estilista",
  colorHex: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00",
}

const service: ServiceOffering = {
  id: "svc_1",
  name: "Corte + Tinte",
  description: null,
  durationMinutes: 90,
  price: 65,
  category: null,
  isActive: true,
}

describe("WizardContextPills", () => {
  beforeEach(() => {
    useWizardStore.getState().reset()
    useEmployeesMock.mockReturnValue({ data: { content: [employee] } } as unknown as ReturnType<
      typeof useEmployees
    >)
  })

  it("no pinta nada sin ninguna eleccion", () => {
    const { container } = render(<WizardContextPills />)
    expect(container).toBeEmptyDOMElement()
  })

  it("con solo profesional elegido pinta una unica pildora", () => {
    useWizardStore.setState({ step: 2, selectedEmployee: employee })
    render(<WizardContextPills />)

    expect(screen.getByText("Laura")).toBeInTheDocument()
    expect(screen.queryByText(/Corte \+ Tinte/)).not.toBeInTheDocument()
  })

  // D32: la variante sale del PASO, no de si ya hay fecha/hora elegida.
  // `NuevaCitaPaso2.dc.html:49-54` dibuja UNA sola pildora (profesional), a
  // 32px y gap:7px -- volviendo de 3->2 el store conserva servicio/fecha/hora
  // (`wizard-store.ts` solo los limpia al ELEGIR de nuevo, no al retroceder),
  // asi que este es justo el caso que rompia la version derivada de
  // `hasDateTime`: con servicio y hueco ya elegidos, pintaba de mas.
  it("paso 2: aunque el store conserve servicio y hueco de una visita anterior al paso 3, solo pinta la pildora de profesional (NuevaCitaPaso2)", () => {
    useWizardStore.setState({
      step: 2,
      selectedEmployee: employee,
      selectedService: service,
      selectedDate: "2026-08-28",
      selectedSlot: "2026-08-28T11:00:00",
    })
    render(<WizardContextPills />)

    const pill = screen.getByText("Laura")
    expect(pill).toBeInTheDocument()
    expect(pill.className).toContain("h-[32px]")
    expect(pill.className).toContain("gap-[7px]")
    expect(screen.queryByText(/Corte \+ Tinte/)).not.toBeInTheDocument()
    expect(screen.queryByText("28 · 11:00")).not.toBeInTheDocument()
  })

  // `NuevaCitaPaso3.dc.html:49-58`: 2 pildoras (profesional + servicio CON
  // tijeras+duracion), NUNCA una tercera de fecha/hora -- ni siquiera en el
  // frame que el propio artboard retrata, con el hueco de las 11:00 YA
  // elegido en esa misma pantalla. Ese es justo el frame que la version
  // derivada de `hasDateTime` no reproducia (mutaba a la forma del paso 4).
  it("paso 3: pinta profesional + servicio con tijeras y duracion, y NUNCA la pildora de fecha/hora aunque ya haya hueco elegido en la propia pantalla (NuevaCitaPaso3)", () => {
    useWizardStore.setState({
      step: 3,
      selectedEmployee: employee,
      selectedService: service,
      selectedDate: "2026-08-28",
      selectedSlot: "2026-08-28T11:00:00",
    })
    render(<WizardContextPills />)

    const employeePill = screen.getByText("Laura")
    expect(employeePill.className).toContain("h-[32px]")
    expect(employeePill.className).toContain("gap-[7px]")
    expect(screen.getByText("Corte + Tinte · 1h 30min")).toBeInTheDocument()
    expect(screen.queryByText("28 · 11:00")).not.toBeInTheDocument()
  })

  // `NuevaCitaPaso4.dc.html:51-58`: 3 pildoras a 30px, la de servicio SIN
  // tijeras ni duracion, y una tercera "dia · hora".
  it("paso 4: pinta las tres pildoras, la de servicio SIN duracion y a 30px (NuevaCitaPaso4)", () => {
    useWizardStore.setState({
      step: 4,
      selectedEmployee: employee,
      selectedService: service,
      selectedDate: "2026-08-28",
      selectedSlot: "2026-08-28T11:00:00",
    })
    render(<WizardContextPills />)

    const employeePill = screen.getByText("Laura")
    expect(employeePill.className).toContain("h-[30px]")
    expect(employeePill.className).toContain("gap-1.5")
    expect(employeePill.className).not.toContain("gap-[7px]")

    const servicePill = screen.getByText("Corte + Tinte")
    expect(servicePill.className).toContain("h-[30px]")
    expect(screen.queryByText(/1h 30min/)).not.toBeInTheDocument()

    expect(screen.getByText("28 · 11:00")).toBeInTheDocument()
  })

  it("con un empleado sin colorHex que ya no esta en la lista activa, cae en el indice de paleta 0", () => {
    useEmployeesMock.mockReturnValue({ data: { content: [] } } as unknown as ReturnType<
      typeof useEmployees
    >)
    useWizardStore.setState({ step: 2, selectedEmployee: employee })
    render(<WizardContextPills />)

    expect(screen.getByText("LM")).toBeInTheDocument()
  })

  // El fallback `-1 -> 0` de `employeePaletteIndex` no es un no-op: la propia
  // `employeeFallbackAvatarClassName` normaliza cualquier indice con modulo,
  // y modulo de -1 cae en el ULTIMO color de la paleta (`(-1 % 5 + 5) % 5 ===
  // 4`), no en el primero. Sin el `rawIndex === -1 ? 0 : rawIndex` del
  // componente, un empleado que "todavia no esta en la lista" saldria del
  // ultimo color de la paleta en vez del primero.
  it("el -1 de employeePaletteIndex cae en el indice de paleta 0, NO en el ultimo por modulo negativo", () => {
    useEmployeesMock.mockReturnValue({ data: { content: [] } } as unknown as ReturnType<
      typeof useEmployees
    >)
    useWizardStore.setState({ step: 2, selectedEmployee: employee })
    render(<WizardContextPills />)

    const avatar = screen.getByText("LM")
    for (const expectedClass of employeeFallbackAvatarClassName(0).split(" ")) {
      expect(avatar.className).toContain(expectedClass)
    }
    for (const lastColorClass of employeeFallbackAvatarClassName(-1).split(" ")) {
      expect(avatar.className).not.toContain(lastColorClass)
    }
  })

  // Trampa 2 del repo: la preflight impone `line-height: 1.5` y los artboards
  // no declaran ninguno (~1.25) -- cada `text-[Npx]` necesita un `leading-*`
  // DETRAS suyo dentro de `cn()` (trampa 1: `tailwind-merge` descarta un
  // `leading-*` escrito ANTES de un `text-[Npx]`).
  it("las iniciales de la pildora de profesional llevan leading-none detras de text-[9px]", () => {
    useWizardStore.setState({ step: 2, selectedEmployee: employee })
    render(<WizardContextPills />)

    const avatar = screen.getByText("LM")
    expect(avatar.className).toContain("leading-none")
  })
})
