import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Switch } from "./switch"

describe("Switch", () => {
  it("reflects the checked state via aria-checked", () => {
    const { rerender } = render(<Switch checked readOnly />)
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true")

    rerender(<Switch checked={false} readOnly />)
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false")
  })

  it("calls onCheckedChange when clicked", async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(<Switch checked={false} onCheckedChange={onCheckedChange} />)

    await user.click(screen.getByRole("switch"))

    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything())
  })

  it("calls onCheckedChange when activated with the space key", async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(<Switch checked={false} onCheckedChange={onCheckedChange} />)

    await user.tab()
    expect(screen.getByRole("switch")).toHaveFocus()

    await user.keyboard(" ")

    expect(onCheckedChange).toHaveBeenCalledTimes(1)
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything())
  })

  it("does not call onCheckedChange when disabled", async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(<Switch checked={false} disabled onCheckedChange={onCheckedChange} />)

    const control = screen.getByRole("switch")
    expect(control).toHaveAttribute("aria-disabled", "true")

    await user.click(control)

    expect(onCheckedChange).not.toHaveBeenCalled()
  })
})
