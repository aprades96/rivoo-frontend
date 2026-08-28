"use client"

import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { WorkingHoursEditor } from "@/components/staff/working-hours-editor"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { salonsApi } from "@/lib/api/salons"
import { useAuth } from "@/hooks/use-auth"
import type { BusinessHoursRequest } from "@/types/salon"

export default function BusinessHoursSettingsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()

  const { data: hours } = useQuery({
    queryKey: ["salon-business-hours"],
    queryFn: () => salonsApi.getBusinessHours(accessToken!),
    enabled: !!accessToken,
  })

  const mutation = useMutation({
    mutationFn: (data: BusinessHoursRequest[]) =>
      salonsApi.updateBusinessHours(data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salon-business-hours"] })
      toast.success("Horarios guardados")
    },
    onError: () => toast.error("Error al guardar horarios"),
  })

  // Derived from the absence of data, not from the query's `isLoading`: a
  // disabled query (no accessToken yet) reports `isLoading: false` in React
  // Query v5, so a hard load of this page could mount the editor on its
  // defaults with the internal "Guardar horarios" button enabled -- see
  // business-hours/page.tsx (onboarding) for the full writeup of the window.
  const hoursNotReady = !accessToken || hours === undefined

  return (
    <div className="p-4 md:py-6 space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-sm font-semibold">Horarios del salon</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Configura los dias y horas de apertura de tu salon.
      </p>

      {hoursNotReady ? (
        <LoadingSkeleton count={7} />
      ) : (
        <WorkingHoursEditor
          hours={hours}
          onSave={(h) => mutation.mutateAsync(h)}
          isSaving={mutation.isPending}
        />
      )}
    </div>
  )
}
