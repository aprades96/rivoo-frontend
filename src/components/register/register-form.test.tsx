import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RegisterForm } from "./register-form"
import { salonsApi } from "@/lib/api/salons"
import { ApiError } from "@/lib/api/client"

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}))

vi.mock("@/lib/api/salons", () => ({
  salonsApi: { register: vi.fn() },
}))

const registerMock = vi.mocked(salonsApi.register)

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <RegisterForm selectedPlan="FREE_TRIAL" onBack={() => {}} />
    </QueryClientProvider>
  )
}

function fillValidForm() {
  fireEvent.change(screen.getByPlaceholderText("Carlos"), { target: { value: "Ana" } })
  fireEvent.change(screen.getByPlaceholderText("Garcia"), { target: { value: "Lopez" } })
  fireEvent.change(screen.getByPlaceholderText("tu@email.com"), {
    target: { value: "ana@example.com" },
  })
  fireEvent.change(screen.getByPlaceholderText("Min. 8 caracteres"), {
    target: { value: "supersecret" },
  })
  fireEvent.change(screen.getByPlaceholderText("Repetir contraseña"), {
    target: { value: "supersecret" },
  })
  fireEvent.change(screen.getByPlaceholderText("Mi Peluqueria"), {
    target: { value: "Demo Salon" },
  })
  fireEvent.change(screen.getByPlaceholderText("+34 612 345 678"), {
    target: { value: "+34600000000" },
  })
  fireEvent.change(screen.getByPlaceholderText("Calle Gran Via 123"), {
    target: { value: "Carrer Demo 1" },
  })
  fireEvent.change(screen.getByPlaceholderText("08001"), { target: { value: "08001" } })
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Crear cuenta gratuita" }))
}

describe("RegisterForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("lands on the check-your-email screen instead of navigating to login", async () => {
    // The server now answers identically whether or not the address already had an account, so
    // there is no longer any outcome that justifies sending the user onward: Keycloak will not
    // let them log in until the address is confirmed.
    registerMock.mockResolvedValue({ message: "Hemos recibido tu solicitud." })

    renderForm()
    fillValidForm()

    // Proves the form really was on screen first, so its disappearance below means something.
    expect(screen.getByText("Crea tu cuenta")).toBeInTheDocument()

    submit()

    // findBy* polls on real timers, which is what actually flushes react-query's notifyManager
    // macrotask; a synchronous assertion here would pass no matter what the component did.
    expect(await screen.findByText("Revisa tu correo")).toBeInTheDocument()
    expect(screen.queryByText("Crea tu cuenta")).not.toBeInTheDocument()
    expect(screen.getByText("ana@example.com")).toBeInTheDocument()

    expect(push).not.toHaveBeenCalled()
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it("sends the address the user typed and shows that same address back", async () => {
    // A different address from the test above: a component that hardcoded one, or that read the
    // address from the response instead of from the form, would pass one of the two and not both.
    registerMock.mockResolvedValue({ message: "Hemos recibido tu solicitud." })

    renderForm()
    fillValidForm()
    fireEvent.change(screen.getByPlaceholderText("tu@email.com"), {
      target: { value: "otra.persona@example.com" },
    })
    submit()

    expect(await screen.findByText("Revisa tu correo")).toBeInTheDocument()
    expect(screen.getByText("otra.persona@example.com")).toBeInTheDocument()
    expect(registerMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "otra.persona@example.com" })
    )
  })

  it("keeps the user on the form when the request genuinely fails", async () => {
    // The success path stopped being conditional; the failure path did not. A dependency outage
    // must NOT look like "check your email", or the user waits forever for a mail nobody sent.
    registerMock.mockRejectedValue(
      new ApiError({
        type: "https://rivoo.com/errors/auth-service-error",
        title: "Auth Service Error",
        status: 502,
        detail: "Salon registration is temporarily unavailable. Please try again in a few minutes.",
        instance: "/api/v1/salons",
        timestamp: "2026-08-28T10:00:00Z",
        correlationId: "abc-123",
      })
    )

    renderForm()
    fillValidForm()
    submit()

    await vi.waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(screen.getByText("Crea tu cuenta")).toBeInTheDocument()
    expect(screen.queryByText("Revisa tu correo")).not.toBeInTheDocument()
  })

  it("does not submit at all when the form is invalid", () => {
    renderForm()

    submit()

    expect(registerMock).not.toHaveBeenCalled()
    expect(screen.getByText("Crea tu cuenta")).toBeInTheDocument()
  })
})
