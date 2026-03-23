"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { ApiError } from "@/lib/api/client"

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            retry: (failureCount, error) => {
              // apiFetch handles 401 refresh+retry internally — don't duplicate
              if (error instanceof ApiError && error.problem.status === 401) return false
              // 403 = authorization error, retry won't help
              if (error instanceof ApiError && error.problem.status === 403) return false
              return failureCount < 1
            },
            refetchOnWindowFocus: true,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
{/* DevTools: open with keyboard shortcut only, no floating button */}
    </QueryClientProvider>
  )
}
