import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { StatusBadge, statusConfig } from "./status-badge"
import type { AppointmentStatus } from "@/types/appointment"

const statuses: { status: AppointmentStatus; label: string }[] = [
  { status: "PENDING", label: "Pendiente" },
  { status: "CONFIRMED", label: "Confirmada" },
  { status: "IN_PROGRESS", label: "En curso" },
  { status: "COMPLETED", label: "Completada" },
  { status: "CANCELLED", label: "Cancelada" },
  { status: "NO_SHOW", label: "No asistió" },
]

describe("StatusBadge", () => {
  statuses.forEach(({ status, label }) => {
    it(`renders "${label}" for status ${status}`, () => {
      render(<StatusBadge status={status} />)
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })
})

describe("statusConfig", () => {
  it("is exported so it can be reused instead of forked (appointment-detail-facts)", () => {
    expect(statusConfig).toBeDefined()
  })

  it("keeps every short label exactly as it was before exporting the map", () => {
    statuses.forEach(({ status, label }) => {
      expect(statusConfig[status].label).toBe(label)
    })
  })

  it("adds the desktop long variant only for PENDING ('Pendiente de confirmar')", () => {
    expect(statusConfig.PENDING.longLabel).toBe("Pendiente de confirmar")
  })

  it("does not add a long variant to statuses the artboards never draw as a badge", () => {
    const statusesOtherThanPending = statuses
      .map((s) => s.status)
      .filter((status) => status !== "PENDING")
    statusesOtherThanPending.forEach((status) => {
      expect(statusConfig[status].longLabel).toBeUndefined()
    })
  })
})
