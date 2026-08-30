"use client"

import { useRouter } from "next/navigation"
import { useWizardStore } from "@/lib/stores/wizard-store"

export interface WizardNavigation {
  /** Cierra el asistente: limpia el store y vuelve a la pantalla anterior. */
  onClose: () => void
  /** Retrocede un paso. */
  onBack: () => void
}

/**
 * Cierre y retroceso compartidos por los cinco pasos del asistente de nueva
 * cita, para que ninguno reimplemente `reset() + router.back()` por su
 * cuenta (los cinco corren en la misma ola y no se coordinan entre si).
 */
export function useWizardNavigation(): WizardNavigation {
  const router = useRouter()
  const { reset, prevStep } = useWizardStore()

  const onClose = () => {
    reset()
    router.back()
  }

  return { onClose, onBack: prevStep }
}
