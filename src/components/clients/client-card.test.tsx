import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ClientCard } from "./client-card"
import type { Client } from "@/types/client"

const mockClient: Client = {
  id: "cli_1",
  firstName: "Ana",
  lastName: "Lopez",
  email: "ana@test.com",
  phone: "612345678",
  gender: null,
  notes: null,
  source: null,
  totalVisits: 5,
  lastVisitAt: null,
  gdprConsentAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
}

describe("ClientCard", () => {
  it("renders client name and initials", () => {
    render(<ClientCard client={mockClient} index={0} />)
    expect(screen.getByText("Ana Lopez")).toBeInTheDocument()
    expect(screen.getByText("AL")).toBeInTheDocument()
  })

  it("renders phone and email on a single line, phone formatted (D29)", () => {
    render(<ClientCard client={mockClient} index={0} />)
    expect(screen.getByText("612 345 678 · ana@test.com")).toBeInTheDocument()
  })

  it("renders visit count and its label", () => {
    render(<ClientCard client={mockClient} index={0} />)
    expect(screen.getByText("5")).toBeInTheDocument()
    expect(screen.getByText("visitas")).toBeInTheDocument()
  })

  it("shows 'Sin contacto' when no phone or email", () => {
    const noContact = { ...mockClient, email: null, phone: null }
    render(<ClientCard client={noContact} index={0} />)
    expect(screen.getByText("Sin contacto")).toBeInTheDocument()
  })

  it("with only an email, the line does not carry a stray leading separator", () => {
    const emailOnly = { ...mockClient, phone: null }
    render(<ClientCard client={emailOnly} index={0} />)
    expect(screen.getByText("ana@test.com")).toBeInTheDocument()
  })

  it("is a real navigable link to /clients/{id}, not a click handler on a div (D5)", () => {
    render(<ClientCard client={mockClient} index={0} />)
    const link = screen.getByRole("link", { name: /Ana Lopez/ })
    expect(link).toHaveAttribute("href", "/clients/cli_1")
  })
})
