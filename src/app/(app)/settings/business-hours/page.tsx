"use client"

import { useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageShell } from "@/components/layout/page-shell"
import {
  WorkingHoursEditor,
  type WorkingHoursEditorHandle,
} from "@/components/staff/working-hours-editor"
import { LoadingSkeleton } from "@/components/shared/loading-skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { salonsApi } from "@/lib/api/salons"
import { useAuth } from "@/hooks/use-auth"
import { useMediaQuery } from "@/hooks/use-media-query"
import type { BusinessHoursRequest } from "@/types/salon"

export default function BusinessHoursSettingsPage() {
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()
  const editorRef = useRef<WorkingHoursEditorHandle>(null)
  // Horario.dc.html:37 puts the only "Guardar" in the mobile header;
  // HorarioDesktop.dc.html:126 puts the only "Guardar cambios" in the
  // desktop body. Mutually exclusive by design, not a duplicate to merge:
  // one save action per width, matching PageShell's own breakpoint
  // ((min-width: 1024px), same query it uses internally).
  const isDesktop = useMediaQuery("(min-width: 1024px)")

  const { data: hours, isError: hoursFetchFailed, refetch: refetchHours } = useQuery({
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

  // Same terminal case as the onboarding step (business-hours/page.tsx):
  // `retry: failureCount < 1` caps retries at one, so after that `hours`
  // stays undefined forever and `hoursNotReady` alone would leave the
  // skeleton on screen with no way out. The back arrow in the header above
  // already lets the owner leave this page regardless.
  const hoursFailed = !!accessToken && hoursFetchFailed

  // Header shortcut for the mobile "Guardar" action (mobileActions, see
  // page-shell.tsx): saves through the same imperative handle the onboarding
  // step uses ((onboarding)/business-hours/page.tsx). The editor's own
  // internal button is hidden on mobile via `showSaveButton={isDesktop}`
  // below -- see the comment on `isDesktop` for why the two are mutually
  // exclusive. Errors are already toasted by the mutation's onError;
  // nothing else to do here on rejection.
  const handleSaveFromHeader = async () => {
    try {
      await editorRef.current?.save()
    } catch {
      // no-op
    }
  }

  return (
    <PageShell
      title="Horario de apertura"
      back
      // `max-w-[860px]` = `HorarioDesktop.dc.html:114`; sin ella `PageShell`
      // estira el contenido a los 1084px de listas/tablas.
      contentClassName="max-w-[860px] space-y-4"
      mobileActions={
        <Button
          // `size="lg"` (h-9, 36px) = `Horario.dc.html:37`: este "Guardar" es
          // 36px, no los 38px del resto de controles de cabecera (esos usan
          // `size="action"`).
          size="lg"
          onClick={handleSaveFromHeader}
          disabled={hoursNotReady || mutation.isPending}
        >
          {mutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          Guardar
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground">
        Configura los dias y horas de apertura de tu salon.
      </p>

      {hoursFailed ? (
        <EmptyState
          title="No se ha podido cargar el horario"
          description="Comprueba tu conexion e intentalo de nuevo."
          action={<Button onClick={() => refetchHours()}>Reintentar</Button>}
        />
      ) : hoursNotReady ? (
        <LoadingSkeleton count={7} />
      ) : (
        <WorkingHoursEditor
          ref={editorRef}
          hours={hours}
          onSave={(h) => mutation.mutateAsync(h)}
          isSaving={mutation.isPending}
          showSaveButton={isDesktop}
        />
      )}
    </PageShell>
  )
}
