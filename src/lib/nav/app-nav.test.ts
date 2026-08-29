import { describe, expect, it } from "vitest"
import {
  CalendarCheck,
  LayoutGrid,
  User,
  Users,
  Scissors,
  Settings,
} from "lucide-react"
import { APP_NAV_ITEMS } from "./app-nav"

function activeLabels(pathname: string, search = "") {
  const params = new URLSearchParams(search)
  return APP_NAV_ITEMS.filter((item) => item.isActive(pathname, params)).map(
    (item) => item.label
  )
}

describe("APP_NAV_ITEMS", () => {
  it("defines exactly six destinations, in artboard order", () => {
    expect(APP_NAV_ITEMS.map((item) => item.label)).toEqual([
      "Hoy",
      "Citas",
      "Clientes",
      "Equipo",
      "Servicios",
      "Ajustes",
    ])
  })

  it("wires the six lucide-react icons in the same order as the destinations", () => {
    expect(APP_NAV_ITEMS.map((item) => item.icon)).toEqual([
      CalendarCheck,
      LayoutGrid,
      User,
      Users,
      Scissors,
      Settings,
    ])
  })

  it("activates Equipo (not Servicios) on /staff without a query", () => {
    expect(activeLabels("/staff")).toEqual(["Equipo"])
  })

  it("activates Servicios (not Equipo) on /staff?tab=services", () => {
    expect(activeLabels("/staff", "tab=services")).toEqual(["Servicios"])
  })

  it("keeps Equipo active on an employee detail page", () => {
    expect(activeLabels("/staff/emp_1")).toEqual(["Equipo"])
  })

  it.each([
    ["/today", "", "Hoy"],
    ["/calendar", "", "Citas"],
    ["/clients", "", "Clientes"],
    ["/clients/cli_1", "", "Clientes"],
    ["/staff", "", "Equipo"],
    ["/staff/emp_1", "", "Equipo"],
    ["/settings", "", "Ajustes"],
    ["/settings/salon", "", "Ajustes"],
    ["/appointments/new", "", "Citas"],
  ])(
    "activates exactly one destination for %s?%s (%s)",
    (pathname, search, expectedLabel) => {
      expect(activeLabels(pathname, search)).toEqual([expectedLabel])
    }
  )
})
