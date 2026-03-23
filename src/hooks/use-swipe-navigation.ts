"use client"

import { useCallback, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"

const TABS = ["/today", "/calendar", "/staff", "/settings"] as const
const SWIPE_THRESHOLD = 50
const MAX_VERTICAL_RATIO = 0.75

export function useSwipeNavigation() {
  const router = useRouter()
  const pathname = usePathname()
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const currentIndex = TABS.findIndex((t) => pathname.startsWith(t))

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current || currentIndex === -1) return

      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - touchStart.current.x
      const deltaY = touch.clientY - touchStart.current.y
      touchStart.current = null

      const absX = Math.abs(deltaX)
      const absY = Math.abs(deltaY)

      if (absX < SWIPE_THRESHOLD) return
      if (absY > absX * MAX_VERTICAL_RATIO) return

      if (deltaX < 0 && currentIndex < TABS.length - 1) {
        router.push(TABS[currentIndex + 1])
      } else if (deltaX > 0 && currentIndex > 0) {
        router.push(TABS[currentIndex - 1])
      }
    },
    [router, currentIndex]
  )

  return { onTouchStart, onTouchEnd }
}
