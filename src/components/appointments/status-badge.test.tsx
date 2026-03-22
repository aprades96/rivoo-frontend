import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { StatusBadge } from "./status-badge"
import type { AppointmentStatus } from "@/types/appointment"

const statuses: { status: AppointmentStatus; label: string }[] = [
  { status: "PENDING", label: "Pendiente" },
  { status: "CONFIRMED", label: "Confirmada" },
  { status: "IN_PROGRESS", label: "En curso" },
  { status: "COMPLETED", label: "Completada" },
  { status: "CANCELLED", label: "Cancelada" },
  { status: "NO_SHOW", label: "No asistio" },
]

describe("StatusBadge", () => {
  statuses.forEach(({ status, label }) => {
    it(`renders "${label}" for status ${status}`, () => {
      render(<StatusBadge status={status} />)
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })
})
