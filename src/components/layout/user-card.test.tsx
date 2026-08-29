import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { UserCard } from "./user-card"
import type { AuthUser } from "@/hooks/use-auth"

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

describe("UserCard", () => {
  beforeEach(() => {
    useAuthMock.mockReset()
  })

  it("renders the initials, the name and the neutral role label for a salon owner", () => {
    useAuthMock.mockReturnValue({
      user: authUser({ name: "Maria Gil", role: "ROLE_SALON_OWNER" }),
    })

    render(<UserCard />)

    expect(screen.getByText("MG")).toBeInTheDocument()
    expect(screen.getByText("Maria Gil")).toBeInTheDocument()
    expect(screen.getByText("Titular del salon")).toBeInTheDocument()
  })

  it("derives the label from the role, never from the name: ROLE_EMPLOYEE shows 'Equipo', not anything starting with 'Propietari'", () => {
    useAuthMock.mockReturnValue({
      user: authUser({ name: "Maria Gil", role: "ROLE_EMPLOYEE" }),
    })

    render(<UserCard />)

    expect(screen.getByText("Equipo")).toBeInTheDocument()
    expect(screen.queryByText(/^Propietari/i)).not.toBeInTheDocument()
  })

  it("gives a one-word name a single initial without crashing", () => {
    useAuthMock.mockReturnValue({
      user: authUser({ name: "Ada", role: "ROLE_PLATFORM_ADMIN" }),
    })

    render(<UserCard />)

    expect(screen.getByText("A")).toBeInTheDocument()
    expect(screen.getByText("Plataforma")).toBeInTheDocument()
  })

  it("renders nothing (empty container) when there is no user, instead of a hollow card", () => {
    useAuthMock.mockReturnValue({ user: null })

    const { container } = render(<UserCard />)

    expect(container).toBeEmptyDOMElement()
  })
})
