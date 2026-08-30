"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogPortal, DialogOverlay, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetTitle, SheetClose } from "@/components/ui/sheet"
import { useMediaQuery } from "@/hooks/use-media-query"

const DESKTOP_QUERY = "(min-width: 1024px)"

/**
 * Scrim unificado a `rgba(42,35,32,0.42)` (D17, T3): los doce artboards dan
 * 0.42 en la hoja movil y en el modal de cliente, y 0.34 una unica vez en el
 * modal de empleado (`FormularioEmpleadoDesktop.dc.html:297`). Una sola
 * aparicion frente a las otras tres -- mismo criterio que el radio del modal
 * (D17) -- asi que se unifica en 0.42. `bg-foreground/42` es exactamente
 * `rgba(42,35,32,0.42)` porque `--foreground` es `#2a2320` (`globals.css:121`),
 * mismo patron ya usado en `appointment-detail-sheet.tsx:77`.
 */
const SCRIM_CLASS = "bg-foreground/42"

export interface ResponsiveFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: React.ReactNode
  /** El CTA; cambia de alto por familia (D17), asi que este contenedor no le impone tamano. */
  footer: React.ReactNode
  /**
   * D17: el boton de cerrar SI es consistente en los dos anchos de cada
   * familia -- "plain" (empleado: sin borde ni fondo, X 18px) o "bordered"
   * (cliente: con borde y fondo, X 15px).
   *
   * Hallazgo: el dato crudo de `FormularioEmpleadoDesktop.dc.html:301-304`
   * dibuja el cerrar de escritorio de EMPLEADO con `border` + `bg` y X de
   * 16px (es decir, como "bordered"), lo que contradice la lectura de "plain
   * consistente en los dos anchos" para esa familia. Se implementa tal como
   * lo fija esta interfaz (una unica variante por modal, sin ramificar por
   * ancho) porque es un punto ya decidido por el plan (D17) y explicitamente
   * marcado como "no reabrir"; queda anotado para quien pueda revisar esa
   * lectura contra el artboard.
   */
  closeButtonVariant: "plain" | "bordered"
  /** La nota de edicion del formulario de empleado (D18); no existe en alta ni en cliente. */
  note?: React.ReactNode
}

function CloseIcon({ variant }: { variant: "plain" | "bordered" }) {
  return (
    <>
      <XIcon className={variant === "bordered" ? "size-[15px]" : "size-[18px]"} strokeWidth={1.75} />
      <span className="sr-only">Cerrar</span>
    </>
  )
}

/**
 * Contenedor unico de formulario de alta/edicion (T3, D17): hoja inferior en
 * movil, modal de 512px en escritorio. Montaje condicional en JS via
 * `useMediaQuery` -- nunca `lg:hidden` (regla del repo, `page-shell.tsx:110-112`):
 * con CSS los dos arboles quedarian montados a la vez en jsdom.
 */
export function ResponsiveFormModal({
  open,
  onOpenChange,
  title,
  children,
  footer,
  closeButtonVariant,
  note,
}: ResponsiveFormModalProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPortal>
          <DialogOverlay className={SCRIM_CLASS} />
          <DialogPrimitive.Popup
            data-slot="responsive-form-modal-dialog"
            data-testid="responsive-form-modal-dialog"
            className="fixed top-1/2 left-1/2 z-50 flex w-full max-w-[512px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border border-border bg-background p-6 outline-none"
          >
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="text-[23px] leading-[1.1] font-semibold tracking-display">
                {title}
              </DialogTitle>
              <DialogClose
                render={
                  <Button
                    variant={closeButtonVariant === "bordered" ? "outline" : "ghost"}
                    size="icon"
                  />
                }
              >
                <CloseIcon variant={closeButtonVariant} />
              </DialogClose>
            </div>

            {children}
            {footer}
            {note}
          </DialogPrimitive.Popup>
        </DialogPortal>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        overlayClassName={SCRIM_CLASS}
        className="max-h-[85vh] overflow-y-auto rounded-t-2xl pt-[10px] pr-4 pb-5 pl-4"
      >
        <div className="flex justify-center">
          <div data-testid="responsive-form-modal-grabber" className="h-1 w-9 rounded-full bg-grabber" />
        </div>

        <div className="flex items-center justify-between gap-3">
          <SheetTitle className="text-[23px] leading-[1.1] font-semibold tracking-display">
            {title}
          </SheetTitle>
          <SheetClose
            render={
              <Button
                variant={closeButtonVariant === "bordered" ? "outline" : "ghost"}
                size="icon"
              />
            }
          >
            <CloseIcon variant={closeButtonVariant} />
          </SheetClose>
        </div>

        {children}
        {footer}
        {note}
      </SheetContent>
    </Sheet>
  )
}
