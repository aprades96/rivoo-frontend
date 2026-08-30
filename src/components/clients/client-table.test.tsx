import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { ClientTable } from "./client-table"
import type { Client } from "@/types/client"

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "cli_1",
    firstName: "Ana",
    lastName: "Garcia",
    email: "ana@test.com",
    phone: "612345678",
    gender: null,
    notes: null,
    source: null,
    totalVisits: 14,
    lastVisitAt: "2026-08-12T10:00:00Z",
    gdprConsentAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("ClientTable", () => {
  it("renders a role=table with the five columns of §1.6, the last one headerless for the chevron", () => {
    render(<ClientTable clients={[makeClient()]} totalElements={1} pageSize={50} />)

    expect(screen.getByRole("table", { name: "Clientes" })).toBeInTheDocument()
    const headers = screen.getAllByRole("columnheader")
    expect(headers).toHaveLength(5)
    expect(headers.map((h) => h.textContent)).toEqual([
      "Cliente",
      "Contacto",
      "Última visita",
      "Visitas",
      "",
    ])
  })

  it("formats the last visit with formatDate, and falls back to — when it is null (D21)", () => {
    const { rerender } = render(
      <ClientTable clients={[makeClient({ lastVisitAt: "2026-08-12T10:00:00Z" })]} totalElements={1} pageSize={50} />
    )
    expect(screen.getByText("12 ago 2026")).toBeInTheDocument()

    rerender(<ClientTable clients={[makeClient({ lastVisitAt: null })]} totalElements={1} pageSize={50} />)
    expect(screen.getByText("—")).toBeInTheDocument()
  })

  it("right-aligns the Visitas column, header and cell alike", () => {
    render(<ClientTable clients={[makeClient({ totalVisits: 14 })]} totalElements={1} pageSize={50} />)

    expect(screen.getByRole("columnheader", { name: "Visitas" })).toHaveClass("text-right")
    expect(screen.getByText("14").closest('[role="cell"]')).toHaveClass("text-right")
  })

  it("shows email + formatted phone when both exist (D29)", () => {
    render(
      <ClientTable
        clients={[makeClient({ email: "ana@test.com", phone: "612345678" })]}
        totalElements={1}
        pageSize={50}
      />
    )
    expect(screen.getByText("ana@test.com")).toBeInTheDocument()
    expect(screen.getByText("612 345 678")).toBeInTheDocument()
  })

  it("shows phone + 'Sin correo' when there is no email", () => {
    render(
      <ClientTable
        clients={[makeClient({ email: null, phone: "612345678" })]}
        totalElements={1}
        pageSize={50}
      />
    )
    expect(screen.getByText("612 345 678")).toBeInTheDocument()
    expect(screen.getByText("Sin correo")).toBeInTheDocument()
  })

  it("shows 'Sin contacto' when there is neither phone nor email", () => {
    render(
      <ClientTable clients={[makeClient({ email: null, phone: null })]} totalElements={1} pageSize={50} />
    )
    expect(screen.getByText("Sin contacto")).toBeInTheDocument()
  })

  it("each row is a link to /clients/{id} (D5)", () => {
    const { container } = render(
      <ClientTable
        clients={[makeClient({ id: "cli_1" }), makeClient({ id: "cli_2", firstName: "Marc" })]}
        totalElements={2}
        pageSize={50}
      />
    )
    // The row keeps role="row" (A1); getByRole("link") no longer finds it,
    // so the target is asserted via the anchor's href attribute.
    const links = container.querySelectorAll("a[href]")
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute("href", "/clients/cli_1")
    expect(links[1]).toHaveAttribute("href", "/clients/cli_2")
  })

  it("prints the pagination line with real numbers OUTSIDE the table (D22)", () => {
    render(<ClientTable clients={[makeClient(), makeClient({ id: "cli_2" })]} totalElements={248} pageSize={50} />)

    const table = screen.getByRole("table")
    expect(within(table).queryByText(/Mostrando/)).not.toBeInTheDocument()
    expect(screen.getByText("Mostrando 2 de 248 · la lista pide 50 por página")).toBeInTheDocument()
  })
})
