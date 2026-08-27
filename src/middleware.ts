import { auth } from "@/auth"
import { NextResponse } from "next/server"

// /dev = banco de pruebas visual del sistema de diseno (404 en produccion)
const PUBLIC_PATHS = ["/login", "/register", "/book", "/api/auth", "/dev"]

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  // Public routes — no auth required
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    // If logged in and visiting /login, redirect to /today
    if (isLoggedIn && pathname === "/login") {
      return NextResponse.redirect(new URL("/today", req.url))
    }
    const response = NextResponse.next()
    // Disable bfcache on login page so the button works after browser back
    if (pathname === "/login") {
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate")
    }
    return response
  }

  // Not logged in → redirect to login
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Root redirect → /today
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/today", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
