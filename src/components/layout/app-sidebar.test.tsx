import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { AppSidebar } from "./app-sidebar"
import type { AuthUser } from "@/hooks/use-auth"

const usePathnameMock = vi.fn()
const useSearchParamsMock = vi.fn()

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
  useSearchParams: () => useSearchParamsMock(),
}))

const useSalonMock = vi.fn()

vi.mock("@/hooks/use-salon", () => ({
  useSalon: () => useSalonMock(),
}))

const useAuthMock = vi.fn()

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => useAuthMock(),
}))

function authUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "usr_1",
    name: "Maria Gil",
    email: "maria@example.com",
    tenantId: "tenant_1",
    role: "ROLE_SALON_OWNER",
    subscriptionPlan: "BASIC",
    ...overrides,
  }
}

function setRoute(pathname: string, search = "") {
  usePathnameMock.mockReturnValue(pathname)
  useSearchParamsMock.mockReturnValue(new URLSearchParams(search))
}

describe("AppSidebar", () => {
  beforeEach(() => {
    setRoute("/staff")
    useSalonMock.mockReturnValue({ data: { name: "Bella Vista" } })
    useAuthMock.mockReturnValue({ user: authUser() })
  })

  it("renders the six destinations as links, in the artboard order", () => {
    render(<AppSidebar />)

    const links = screen.getAllByRole("link")

    expect(links.map((link) => link.textContent)).toEqual([
      "Hoy",
      "Citas",
      "Clientes",
      "Equipo",
      "Servicios",
      "Ajustes",
    ])
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/today",
      "/calendar",
      "/clients",
      "/staff",
      "/staff?tab=services",
      "/settings",
    ])
  })

  it("takes the salon name from useSalon instead of a hardcoded string", () => {
    useSalonMock.mockReturnValue({ data: { name: "Studio Aurora" } })

    render(<AppSidebar />)

    expect(screen.getByText("Studio Aurora")).toBeInTheDocument()
    expect(screen.queryByText("Bella Vista")).not.toBeInTheDocument()
  })

  it("marks Equipo as the active destination on /staff without a query, and leaves Servicios inactive", () => {
    setRoute("/staff")

    render(<AppSidebar />)

    expect(screen.getByRole("link", { name: /Equipo/ })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(
      screen.getByRole("link", { name: /Servicios/ })
    ).not.toHaveAttribute("aria-current")
  })

  it("marks Servicios as the active destination on /staff?tab=services, and leaves Equipo inactive", () => {
    setRoute("/staff", "tab=services")

    render(<AppSidebar />)

    expect(screen.getByRole("link", { name: /Servicios/ })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.getByRole("link", { name: /Equipo/ })).not.toHaveAttribute(
      "aria-current"
    )
  })

  it("mounts the user card", () => {
    render(<AppSidebar />)

    expect(screen.getByText("Maria Gil")).toBeInTheDocument()
  })
})
