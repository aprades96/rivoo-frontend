import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ClientCard } from "./client-card"
import type { Client } from "@/types/client"

const mockClient: Client = {
  id: "cli_1",
  firstName: "Ana",
  lastName: "Lopez",
  email: "ana@test.com",
  phone: "612345678",
  gender: null,
  dateOfBirth: null,
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
    render(<ClientCard client={mockClient} />)
    expect(screen.getByText("Ana Lopez")).toBeInTheDocument()
    expect(screen.getByText("AL")).toBeInTheDocument()
  })

  it("renders contact info", () => {
    render(<ClientCard client={mockClient} />)
    expect(screen.getByText(/612345678/)).toBeInTheDocument()
    expect(screen.getByText(/ana@test.com/)).toBeInTheDocument()
  })

  it("renders visit count", () => {
    render(<ClientCard client={mockClient} />)
    expect(screen.getByText("5")).toBeInTheDocument()
    expect(screen.getByText("visitas")).toBeInTheDocument()
  })

  it("shows 'Sin contacto' when no phone or email", () => {
    const noContact = { ...mockClient, email: null, phone: null }
    render(<ClientCard client={noContact} />)
    expect(screen.getByText("Sin contacto")).toBeInTheDocument()
  })

  it("calls onTap when clicked", () => {
    const onTap = vi.fn()
    render(<ClientCard client={mockClient} onTap={onTap} />)
    fireEvent.click(screen.getByText("Ana Lopez"))
    expect(onTap).toHaveBeenCalledWith(mockClient)
  })
})
