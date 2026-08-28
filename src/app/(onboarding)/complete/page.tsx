"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { WandSparkles, Globe } from "lucide-react"
import { useSalon } from "@/hooks/use-salon"
import { useAuth } from "@/hooks/use-auth"
import { salonsApi } from "@/lib/api/salons"
import { useOnboardingStore } from "@/lib/stores/onboarding-store"
import { OnboardingFooter } from "../_components/onboarding-footer"

export default function OnboardingCompletePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()
  const { data: salon } = useSalon()
  const { setCurrentStep, reset } = useOnboardingStore()
  const [isCompleting, setIsCompleting] = useState(false)

  useEffect(() => {
    setCurrentStep(5)
  }, [setCurrentStep])

  const handleGoToDashboard = async () => {
    if (!accessToken) return

    setIsCompleting(true)
    try {
      const updated = await salonsApi.completeOnboarding(accessToken)

      // Mata cualquier refetch en vuelo antes de escribir: refetchOnWindowFocus
      // esta en true global (query-provider.tsx:21) y esta pantalla monta
      // useSalon(), asi que uno podria resolver DESPUES con el payload viejo y
      // pisar la escritura de abajo.
      await queryClient.cancelQueries({ queryKey: ["salon", "me"] })
      // Clave EXACTA que lee useSalon (use-salon.ts:12). ["salon"] solo vale
      // como prefijo de invalidateQueries, no como clave real de cache.
      queryClient.setQueryData(["salon", "me"], updated)
      reset()
      router.push("/today")
    } catch {
      // La unica escritura que decide si el usuario puede entrar: si falla, se
      // queda en esta pantalla, nunca navega con el flag todavia en null.
      toast.error("No se pudo completar el alta. Intentalo de nuevo.")
      setIsCompleting(false)
    }
  }

  const bookingUrl = salon
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/book/${salon.slug}`
    : null

  return (
    <>
      <div className="flex flex-col items-center gap-[22px] text-center">
        <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-success-soft md:h-[88px] md:w-[88px]">
          <WandSparkles strokeWidth={1.75} className="size-[34px] text-success md:size-10" />
        </div>

        <div className="flex flex-col gap-[7px]">
          <h1 className="font-heading text-[27px] font-semibold leading-[1.1] tracking-display md:text-[32px]">
            Tu salon esta listo
          </h1>
          <p className="max-w-[340px] text-[13px] leading-[1.5] text-muted-foreground md:text-[14px]">
            Ya puedes empezar a gestionar tus citas y atender a tus clientes.
          </p>
        </div>

        {bookingUrl && (
          <div className="flex w-full max-w-[320px] flex-col gap-[7px] rounded-[12px] border border-border bg-white p-4 text-left md:max-w-[420px]">
            <div className="flex items-center gap-2">
              <Globe size={15} strokeWidth={1.75} className="text-muted-foreground" />
              <span className="text-xs font-semibold">Tu pagina de reservas</span>
            </div>
            <span className="break-all text-[13px] text-primary">{bookingUrl}</span>
            <span className="text-[11px] leading-[1.45] text-muted-foreground-2">
              Comparte este enlace con tus clientes para que reserven online.
            </span>
          </div>
        )}
      </div>

      <OnboardingFooter
        ctaLabel="Ir al dashboard"
        onCta={handleGoToDashboard}
        ctaDisabled={isCompleting}
        ctaLoading={isCompleting}
      />
    </>
  )
}
