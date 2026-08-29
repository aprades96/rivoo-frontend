"use client"

import { useSyncExternalStore } from "react"

function subscribe(query: string, onChange: () => void): () => void {
  const mediaQueryList = window.matchMedia(query)
  mediaQueryList.addEventListener("change", onChange)
  return () => mediaQueryList.removeEventListener("change", onChange)
}

/**
 * SSR-safe media query match, built on `useSyncExternalStore` (the React 19
 * primitive meant for exactly this: an external, mutable source that differs
 * between server and client).
 *
 * `getServerSnapshot` returns `false` unconditionally -- there is no `window`
 * during the server render, so it cannot know the real viewport, and picking
 * anything else here would be a guess. `false` also matches how every other
 * breakpoint in this codebase is written: base Tailwind classes target
 * mobile, `md:`/`lg:`/`xl:` layer desktop on top. The first client render
 * reuses that same `false` so it matches the server-rendered markup exactly
 * (no hydration-mismatch warning); `useSyncExternalStore` then re-renders
 * synchronously once `getSnapshot` can read the real `matchMedia` result, so
 * the correct layout lands before the user can interact with the page.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribe(query, onChange),
    () => window.matchMedia(query).matches,
    () => false
  )
}
