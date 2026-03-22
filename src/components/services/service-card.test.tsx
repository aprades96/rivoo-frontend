import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ServiceCard } from "./service-card"
import type { ServiceOffering } from "@/types/service"

const activeService: ServiceOffering = {
  id: "svc_1",
  name: "Corte hombre",
  description: "Corte clasico",
  durationMinutes: 30,
  price: 15,
  category: "Corte",
  isActive: true,
}

const inactiveService: ServiceOffering = {
  ...activeService,
  id: "svc_2",
  name: "Tinte completo",
  isActive: false,
}

describe("ServiceCard", () => {
  it("renders service name and price", () => {
    render(<ServiceCard service={activeService} />)
    expect(screen.getByText("Corte hombre")).toBeInTheDocument()
    expect(screen.getByText(/15/)).toBeInTheDocument()
  })

  it("renders duration and category", () => {
    render(<ServiceCard service={activeService} />)
    expect(screen.getByText(/30 min/)).toBeInTheDocument()
    expect(screen.getByText(/· Corte/)).toBeInTheDocument()
  })

  it("shows 'Inactivo' badge for inactive service", () => {
    render(<ServiceCard service={inactiveService} />)
    expect(screen.getByText("Inactivo")).toBeInTheDocument()
  })

  it("does not show inactive badge for active service", () => {
    render(<ServiceCard service={activeService} />)
    expect(screen.queryByText("Inactivo")).not.toBeInTheDocument()
  })

  it("calls onTap when clicked", () => {
    const onTap = vi.fn()
    render(<ServiceCard service={activeService} onTap={onTap} />)
    fireEvent.click(screen.getByText("Corte hombre"))
    expect(onTap).toHaveBeenCalledWith(activeService)
  })
})
