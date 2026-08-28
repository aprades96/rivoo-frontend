import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { CheckEmailNotice } from "./check-email-notice"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

/**
 * Props-driven and fully synchronous on purpose: no query client, no mutation, so there is no
 * notifyManager macrotask that could let an assertion run before the component re-rendered (see
 * AGENTS.md). What passes here passes because the component really rendered it.
 */
describe("CheckEmailNotice", () => {
  it("tells the user an email was sent, to the address they typed", () => {
    render(<CheckEmailNotice email="ana@example.com" />)

    expect(screen.getByText("Revisa tu correo")).toBeInTheDocument()
    expect(screen.getByText("ana@example.com")).toBeInTheDocument()
  })

  it("renders whichever address it is given", () => {
    // Second, DIFFERENT address. Without this a hardcoded string in the component would satisfy
    // the test above and prove nothing about the prop being used.
    render(<CheckEmailNotice email="otra.persona@example.com" />)

    expect(screen.getByText("otra.persona@example.com")).toBeInTheDocument()
    expect(screen.queryByText("ana@example.com")).not.toBeInTheDocument()
  })

  it("reveals nothing about whether the account already existed", () => {
    render(<CheckEmailNotice email="ana@example.com" />)

    const copy = document.body.textContent ?? ""
    // The backend deliberately answers identically for a free address and a taken one. Any of
    // these phrasings would hand that distinction straight back to the person at the keyboard.
    for (const forbidden of [
      "Cuenta creada",
      "cuenta creada",
      "ya tienes una cuenta",
      "Ya existe",
      "ya existe",
      "ya esta registrado",
      "no existe",
      "nueva cuenta",
      "activar tu cuenta",
    ]) {
      expect(copy).not.toContain(forbidden)
    }
  })

  it("does not imply the user can already sign in, but leaves the way there", () => {
    render(<CheckEmailNotice email="ana@example.com" />)

    // Keycloak blocks login until the address is verified, so this screen must not announce
    // success or auto-advance; a plain link the user may follow later is fine.
    expect(screen.getByRole("link", { name: "Ir a iniciar sesion" })).toHaveAttribute(
      "href",
      "/login"
    )
    expect(document.body.textContent).not.toContain("Cuenta creada correctamente")
  })
})
