import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { Sheet, SheetContent } from "./sheet"

// The Dialog primitive portals its content to `document.body` (see
// `@base-ui/react/dialog/portal/DialogPortal`), so the overlay and the popup
// live as siblings of the render container, not nested inside it. `baseElement`
// (which defaults to `document.body`) covers both.
function renderBottomSheet(overlayClassName?: string) {
  const { baseElement } = render(
    <Sheet open onOpenChange={() => {}}>
      <SheetContent side="bottom" overlayClassName={overlayClassName}>
        <p>content</p>
      </SheetContent>
    </Sheet>
  )
  return {
    overlay: baseElement.querySelector('[data-slot="sheet-overlay"]'),
    content: baseElement.querySelector('[data-slot="sheet-content"]'),
  }
}

describe("SheetContent overlayClassName", () => {
  it("reaches the overlay and not the content", () => {
    const { overlay, content } = renderBottomSheet("bg-[rgba(42,35,32,0.42)]")

    expect(overlay).not.toBeNull()
    expect(content).not.toBeNull()
    expect(overlay).toHaveClass("bg-[rgba(42,35,32,0.42)]")
    expect(content).not.toHaveClass("bg-[rgba(42,35,32,0.42)]")
  })

  it("leaves the overlay unstyled by the veil class when overlayClassName is not passed", () => {
    const { overlay } = renderBottomSheet()

    expect(overlay).not.toBeNull()
    expect(overlay).not.toHaveClass("bg-[rgba(42,35,32,0.42)]")
  })
})

describe("SheetContent bottom side breakpoint", () => {
  it("carries the lg: promotion variants and no md: ones", () => {
    const { content } = renderBottomSheet()

    expect(content).not.toBeNull()
    const className = content!.className

    const lgBottomVariants = className.match(/data-\[side=bottom\]:lg:/g) ?? []
    const mdBottomVariants = className.match(/data-\[side=bottom\]:md:/g) ?? []

    expect(lgBottomVariants).toHaveLength(14)
    expect(mdBottomVariants).toHaveLength(0)

    expect(className).toContain("data-[side=bottom]:lg:inset-auto")
    expect(className).toContain("data-[side=bottom]:lg:bottom-auto")
    expect(className).toContain("data-[side=bottom]:lg:left-1/2")
    expect(className).toContain("data-[side=bottom]:lg:top-1/2")
    expect(className).toContain("data-[side=bottom]:lg:-translate-x-1/2")
    expect(className).toContain("data-[side=bottom]:lg:-translate-y-1/2")
    expect(className).toContain("data-[side=bottom]:lg:w-full")
    expect(className).toContain("data-[side=bottom]:lg:max-w-lg")
    expect(className).toContain("data-[side=bottom]:lg:rounded-xl")
    expect(className).toContain("data-[side=bottom]:lg:border")
    expect(className).toContain("data-[side=bottom]:lg:data-ending-style:translate-y-0")
    expect(className).toContain("data-[side=bottom]:lg:data-starting-style:translate-y-0")
    expect(className).toContain("data-[side=bottom]:lg:data-ending-style:scale-95")
    expect(className).toContain("data-[side=bottom]:lg:data-starting-style:scale-95")
  })

  it("does not touch the top/left/right side variants", () => {
    const { baseElement } = render(
      <Sheet open onOpenChange={() => {}}>
        <SheetContent side="left">
          <p>content</p>
        </SheetContent>
      </Sheet>
    )
    const content = baseElement.querySelector('[data-slot="sheet-content"]')

    expect(content).not.toBeNull()
    const className = content!.className
    expect(className).toContain("data-[side=left]:sm:max-w-sm")
    expect(className).not.toMatch(/data-\[side=left\]:lg:/)
  })
})
