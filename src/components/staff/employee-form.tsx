"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2, KeyRound } from "lucide-react"
import { ResponsiveFormModal } from "@/components/shared/responsive-form-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { EmployeeColor } from "@/components/staff/employee-color"
import { staffApi } from "@/lib/api/staff"
import { ApiError } from "@/lib/api/client"
import { useAuth } from "@/hooks/use-auth"
import { useMediaQuery } from "@/hooks/use-media-query"
import type { Employee, CreateEmployeeRequest, UpdateEmployeeRequest } from "@/types/employee"

interface EmployeeFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: Employee | null // null = create mode
}

// Mismo breakpoint que `ResponsiveFormModal` (D17): el formulario necesita
// conocer el ancho por su cuenta porque, a diferencia del contenedor, sus
// metricas SI difieren entre movil y escritorio dentro de la MISMA familia
// (alto de campo 44/40, CTA 48px 15px/600 frente a 42px 14px/600, y el boton
// de cerrar -- ver comentario de `closeButtonVariant` mas abajo).
const DESKTOP_QUERY = "(min-width: 1024px)"

const LABEL_CLASS = "text-[12px] leading-tight font-semibold text-muted-foreground"

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  jobTitle: "",
  colorHex: "",
  createAccount: false,
  password: "",
}

function formStateFrom(employee: Employee | null) {
  if (!employee) return EMPTY_FORM
  return {
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone ?? "",
    jobTitle: employee.jobTitle ?? "",
    colorHex: employee.colorHex ?? "",
    createAccount: false,
    password: "",
  }
}

// D30: el `detail` del ProblemDetail que `apiFetch` propaga como `ApiError`
// (`src/lib/api/client.ts:96`) llega al toast; sin el (o si el fallo no es un
// `ApiError`, p.ej. de red) se cae al mensaje generico.
function reportMutationError(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    toast.error(error.problem.detail || fallback)
  } else {
    toast.error("Error de conexion. Intentalo de nuevo.")
  }
}

export function EmployeeFormSheet({ open, onOpenChange, employee }: EmployeeFormSheetProps) {
  const isEditing = !!employee
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const queryClient = useQueryClient()
  const { accessToken } = useAuth()

  const [form, setForm] = useState(() => formStateFrom(employee))

  // Re-populate only when the sheet is (re)opened or points at a different
  // employee. Keying on the id instead of the object identity means a background
  // refetch (new object, same employee) no longer wipes out what the user typed.
  const syncKey = `${open}:${employee?.id ?? "new"}`
  const [syncedKey, setSyncedKey] = useState(syncKey)
  if (syncKey !== syncedKey) {
    setSyncedKey(syncKey)
    setForm(formStateFrom(employee))
  }

  const createMutation = useMutation({
    mutationFn: (data: CreateEmployeeRequest) =>
      staffApi.createEmployee(data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      toast.success(form.createAccount ? "Empleado creado con cuenta de acceso" : "Empleado creado")
      onOpenChange(false)
    },
    onError: (error) => reportMutationError(error, "Error al crear empleado"),
  })

  const updateMutation = useMutation({
    mutationFn: (data: UpdateEmployeeRequest) =>
      staffApi.updateEmployee(employee!.id, data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      queryClient.invalidateQueries({ queryKey: ["employee", employee!.id] })
      toast.success("Empleado actualizado")
      onOpenChange(false)
    },
    onError: (error) => reportMutationError(error, "Error al actualizar empleado"),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  // D31: `trim()` antes de validar y de enviar -- un nombre de solo espacios
  // ya no pasa el guard ni llega a la mutacion.
  const trimmedFirstName = form.firstName.trim()
  const trimmedLastName = form.lastName.trim()
  const trimmedEmail = form.email.trim()
  const trimmedPhone = form.phone.trim()
  const trimmedJobTitle = form.jobTitle.trim()

  const isValid = Boolean(trimmedFirstName && trimmedLastName && trimmedEmail) &&
    (!form.createAccount || form.password.length >= 8)

  const handleSubmit = () => {
    if (!trimmedFirstName || !trimmedLastName || !trimmedEmail) return
    if (form.createAccount && (!form.password || form.password.length < 8)) return

    if (isEditing) {
      updateMutation.mutate({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: trimmedEmail,
        phone: trimmedPhone || undefined,
        jobTitle: trimmedJobTitle || undefined,
        colorHex: form.colorHex || undefined,
      })
    } else {
      createMutation.mutate({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: trimmedEmail,
        phone: trimmedPhone || undefined,
        jobTitle: trimmedJobTitle || undefined,
        colorHex: form.colorHex || undefined,
        createKeycloakAccount: form.createAccount || undefined,
        password: form.createAccount ? form.password : undefined,
      })
    }
  }

  const update = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  // D17: alto y padding de campo difieren entre anchos DENTRO de la misma
  // familia (44/14px en movil, 40/12px en escritorio) -- no es un desliz, se
  // conserva (§2.5 D17 "salvo que").
  const inputClass = isDesktop ? "h-10 px-3 text-[14px]" : "h-11 px-[14px] text-[14px]"
  const nameGridGap = isDesktop ? "gap-3" : "gap-[10px]"

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar empleado" : "Nuevo empleado"}
      /**
       * D17 corregido: el hallazgo de disenio marca que, a diferencia de
       * cliente, el cerrar de EMPLEADO no es la misma variante en los dos
       * anchos -- `FormularioEmpleado.dc.html:99` (movil) dibuja el boton
       * sin borde ni fondo, `FormularioEmpleadoDesktop.dc.html:301-304`
       * (escritorio) lo dibuja CON borde y fondo. Comprobado en los dos
       * artboards. `ResponsiveFormModal` solo admite una variante fija por
       * modal (no ramifica por ancho), asi que aqui se elige la variante en
       * el propio consumidor segun `isDesktop`, sin tocar el contenedor
       * compartido.
       *
       * Hallazgo pendiente (no se puede cerrar desde este fichero): la
       * variante "bordered" del contenedor fija la X en 15px
       * (`responsive-form-modal.tsx` `CloseIcon`), pero el artboard de
       * escritorio de empleado pide 16px. Arreglarlo exige tocar
       * `responsive-form-modal.tsx`, que es de T3 y esta fuera del alcance
       * de T7.
       */
      closeButtonVariant={isDesktop ? "bordered" : "plain"}
      footer={
        <Button
          className={isDesktop ? "h-[42px] w-full text-[14px] font-semibold" : "h-[48px] w-full text-[15px] font-semibold"}
          onClick={handleSubmit}
          disabled={isPending || !isValid}
        >
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? "Guardar cambios" : "Crear empleado"}
        </Button>
      }
      // D18: la nota de "la cuenta de acceso solo se crea al dar de alta"
      // solo existe en el modo edicion.
      note={
        isEditing ? (
          <p className="text-[11px] leading-[1.45] text-muted-foreground-2">
            La cuenta de acceso solo se crea al dar de alta al empleado.
          </p>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3">
        <div className={`grid grid-cols-2 ${nameGridGap}`}>
          <div className="flex flex-col gap-1.5">
            <Label className={LABEL_CLASS}>Nombre *</Label>
            <Input
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
              placeholder="Nombre"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className={LABEL_CLASS}>Apellidos *</Label>
            <Input
              value={form.lastName}
              onChange={(e) => update("lastName", e.target.value)}
              placeholder="Apellidos"
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className={LABEL_CLASS}>Email *</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="email@ejemplo.com"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className={LABEL_CLASS}>Telefono</Label>
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="612 345 678"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className={LABEL_CLASS}>Puesto</Label>
          <Input
            value={form.jobTitle}
            onChange={(e) => update("jobTitle", e.target.value)}
            placeholder="Barbero, Estilista..."
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={LABEL_CLASS}>Color identificativo</span>
          {/* D14: la muestra es el componente compartido `EmployeeColor`
              (cuadrado 32x32 con hex al lado); un `<input type="color">`
              nativo, oculto, anidado dentro del `<label>` sigue permitiendo
              elegirlo -- es HTML nativo, no la primitiva `Checkbox` de
              base-ui, asi que no aplica el problema de doble-click que
              justifica NO anidar esa primitiva dentro de un `<label>`
              (ver bloque de cuenta de acceso, mas abajo).
              Sin el `#3B82F6` literal: el valor inicial del input nativo,
              oculto y nunca visible, es neutro (`#000000`) -- el campo vacio
              lo muestra `EmployeeColor` con el fondo `--muted` de reserva,
              nunca con un azul que el backend no puso. */}
          <label className="inline-flex w-fit cursor-pointer items-center gap-2.5">
            <input
              type="color"
              value={form.colorHex || "#000000"}
              onChange={(e) => update("colorHex", e.target.value)}
              className="sr-only"
              aria-label="Color identificativo"
            />
            <EmployeeColor colorHex={form.colorHex || null} shape="square" showHex />
            {!form.colorHex && (
              <span className="text-[12px] leading-tight text-muted-foreground-2">Por defecto</span>
            )}
          </label>
        </div>

        {!isEditing && (
          <>
            <div className="h-px bg-border" />

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="employee-create-account"
                  checked={form.createAccount}
                  onCheckedChange={(checked) => update("createAccount", checked === true)}
                />
                <KeyRound className="size-3.5 text-muted-foreground-2" strokeWidth={1.75} />
                <label htmlFor="employee-create-account" className="cursor-pointer text-sm">
                  Crear cuenta de acceso
                </label>
              </div>
              <p className="pl-[27px] text-[11px] leading-[1.45] text-muted-foreground-2">
                Permite al empleado iniciar sesion y gestionar sus citas
              </p>
            </div>

            {form.createAccount && (
              <div className="flex flex-col gap-1.5">
                <Label className={LABEL_CLASS}>Contraseña temporal *</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="Min. 8 caracteres"
                  className={inputClass}
                />
                <p className="text-[11px] leading-[1.45] text-muted-foreground-2">
                  El empleado podra cambiarla despues
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </ResponsiveFormModal>
  )
}
