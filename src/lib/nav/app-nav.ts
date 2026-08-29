import type { LucideIcon } from "lucide-react"
import {
  CalendarCheck,
  LayoutGrid,
  User,
  Users,
  Scissors,
  Settings,
} from "lucide-react"

export interface AppNavItem {
  href: string
  label: string
  icon: LucideIcon
  isActive: (pathname: string, params: URLSearchParams) => boolean
}

// Equipo y Servicios comparten la ruta `/staff` (Servicios es una pestana
// dentro de esa pagina, seleccionada con `?tab=services`; no existe `/services`).
// Una comparacion de cadenas compartida como `pathname.startsWith(href)` -que es
// lo que usa la barra inferior movil- no ve la query string, asi que ambos
// destinos se encenderian a la vez en `/staff?tab=services`. Por eso cada
// destino trae su propio predicado en vez de derivarse de una regla comun.
const isStaffTeamTab = (pathname: string, params: URLSearchParams) =>
  pathname.startsWith("/staff") && params.get("tab") !== "services"

const isStaffServicesTab = (pathname: string, params: URLSearchParams) =>
  pathname.startsWith("/staff") && params.get("tab") === "services"

export const APP_NAV_ITEMS: readonly AppNavItem[] = [
  {
    href: "/today",
    label: "Hoy",
    icon: CalendarCheck,
    isActive: (pathname) => pathname.startsWith("/today"),
  },
  {
    href: "/calendar",
    label: "Citas",
    icon: LayoutGrid,
    // "Citas" cubre tanto el calendario como el flujo de alta/edicion de citas.
    isActive: (pathname) =>
      pathname.startsWith("/calendar") || pathname.startsWith("/appointments"),
  },
  {
    href: "/clients",
    label: "Clientes",
    icon: User,
    isActive: (pathname) => pathname.startsWith("/clients"),
  },
  {
    href: "/staff",
    label: "Equipo",
    icon: Users,
    isActive: isStaffTeamTab,
  },
  {
    href: "/staff?tab=services",
    label: "Servicios",
    icon: Scissors,
    isActive: isStaffServicesTab,
  },
  {
    href: "/settings",
    label: "Ajustes",
    icon: Settings,
    isActive: (pathname) => pathname.startsWith("/settings"),
  },
]
