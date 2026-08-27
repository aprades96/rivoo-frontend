"use client"

import { useState } from "react"
import { notFound } from "next/navigation"
import { AppointmentCard } from "@/components/appointments/appointment-card"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { StatusBadge } from "@/components/appointments/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { Appointment, AppointmentStatus } from "@/types/appointment"

/**
 * Banco de pruebas visual del sistema de diseno.
 *
 * No toca red, ni sesion, ni backend: datos fijos y componentes reales, para
 * poder juzgar color, tipografia y movimiento con `npm run dev` a secas.
 * Es publica en el middleware y devuelve 404 en produccion.
 */

const STATUSES: AppointmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]

const TOKENS = [
  { name: "background", value: "var(--background)" },
  { name: "card", value: "var(--card)" },
  { name: "muted", value: "var(--muted)" },
  { name: "border", value: "var(--border)" },
  { name: "accent", value: "var(--accent)" },
  { name: "primary", value: "var(--primary)" },
  { name: "foreground", value: "var(--foreground)" },
  { name: "muted-foreground", value: "var(--muted-foreground)" },
  { name: "destructive", value: "var(--destructive)" },
]

const MOTION = [
  { name: "--motion-press", label: "90ms", use: "Pulsar" },
  { name: "--motion-fast", label: "140ms", use: "Color y borde" },
  { name: "--motion-base", label: "220ms", use: "Algo que se desplaza" },
  { name: "--motion-slow", label: "320ms", use: "Superficies que entran" },
]

function appointment(
  id: string,
  overrides: Partial<Appointment> = {}
): Appointment {
  return {
    id,
    tenantId: "demo",
    clientId: "cli_1",
    clientName: "Ana Garcia",
    clientPhone: "612345678",
    clientEmail: "ana@example.com",
    employeeId: "emp_1",
    employeeName: "Laura Martinez",
    serviceId: "svc_1",
    serviceName: "Corte + Tinte",
    servicePrice: 65,
    serviceDurationMinutes: 90,
    startTime: "2026-08-27T10:30:00",
    endTime: "2026-08-27T12:00:00",
    status: "PENDING",
    source: "ONLINE",
    notes: "Alergia al amoniaco. Usar tinte sin amoniaco.",
    reminderSent: true,
    createdAt: "2026-08-27T08:00:00",
    updatedAt: "2026-08-27T08:00:00",
    ...overrides,
  }
}

const APPOINTMENTS: Appointment[] = [
  appointment("a1"),
  appointment("a2", {
    clientName: "Carla Ruiz",
    serviceName: "Corte y secado",
    servicePrice: 35,
    serviceDurationMinutes: 60,
    startTime: "2026-08-27T09:00:00",
    endTime: "2026-08-27T10:00:00",
    status: "CONFIRMED",
    source: "PHONE",
    notes: null,
  }),
  appointment("a3", {
    clientName: "Marta Vidal",
    employeeName: "Marc Oliva",
    serviceName: "Manicura francesa",
    servicePrice: 22,
    serviceDurationMinutes: 30,
    startTime: "2026-08-27T11:30:00",
    endTime: "2026-08-27T12:00:00",
    status: "CANCELLED",
    source: "ONLINE",
    notes: null,
  }),
]

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

export default function DesignPreviewPage() {
  const [range, setRange] = useState<"dia" | "semana">("dia")

  if (process.env.NODE_ENV === "production") notFound()

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-4xl font-semibold tracking-display">
          Sistema de diseno
        </h1>
        <p className="text-sm text-muted-foreground">
          Componentes reales con datos fijos. Sin backend, sin sesion.
        </p>
      </header>

      <Section title="Color" hint="Cada muestra es el token de globals.css.">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {TOKENS.map((t) => (
            <div key={t.name} className="flex flex-col gap-1.5">
              <div
                className="h-14 rounded-lg border"
                style={{ background: t.value }}
              />
              <span className="text-[11px] text-muted-foreground">{t.name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Tipografia"
        hint="Una sola familia. Los titulos se distinguen por peso y tracking."
      >
        <Card className="flex flex-col gap-2 p-4">
          <span className="font-heading text-4xl font-semibold tracking-display">
            Buenas tardes, Maria
          </span>
          <span className="font-heading text-2xl font-semibold tracking-display">
            Martes, 27 de agosto
          </span>
          <span className="text-base">
            Texto corrido a 16px, que es lo que se lee de verdad en la agenda.
          </span>
          <span className="text-sm text-muted-foreground">
            Secundario a 14px sobre muted-foreground.
          </span>
          <span className="text-2xl font-semibold tabular-nums">
            09:00 &middot; 10:30 &middot; 12:00 &middot; 65,00 &euro;
          </span>
          <span className="text-xs text-muted-foreground">
            Los numeros van en tabular-nums: las horas alinean en columna.
          </span>
        </Card>
      </Section>

      <Section title="Botones">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Guardar</Button>
          <Button variant="secondary">Reprogramar</Button>
          <Button variant="outline">Cancelar</Button>
          <Button variant="ghost">Descartar</Button>
          <Button variant="destructive">Borrar</Button>
          <Button disabled>Continuar</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Pequeno</Button>
          <Button size="default">Normal</Button>
          <Button size="lg">Grande</Button>
        </div>
      </Section>

      <Section
        title="Estados de cita"
        hint="Los seis del backend, con sus pares fondo / texto."
      >
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>Nuevo</Badge>
          <Badge variant="secondary">Online</Badge>
          <Badge variant="outline">Manual</Badge>
          <Badge variant="destructive">Impagado</Badge>
        </div>
      </Section>

      <Section
        title="Cita"
        hint="AppointmentCard real, el mismo componente que usa /today."
      >
        <div className="flex flex-col gap-2">
          {APPOINTMENTS.map((a) => (
            <AppointmentCard key={a.id} appointment={a} />
          ))}
        </div>
      </Section>

      <Section title="Campos">
        <Card className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-name">Nombre del cliente</Label>
            <Input id="p-name" placeholder="Ana Garcia" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-phone">Telefono</Label>
            <Input id="p-phone" defaultValue="612 345 678" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-notes">Notas</Label>
            <Textarea
              id="p-notes"
              defaultValue="Alergia al amoniaco. Usar tinte sin amoniaco."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="p-off">Campo deshabilitado</Label>
            <Input id="p-off" disabled placeholder="No editable" />
          </div>
        </Card>
      </Section>

      <Section
        title="Movimiento"
        hint="Pasa el raton por la barra para comparar duraciones."
      >
        <Card className="flex flex-col gap-3 p-4">
          {MOTION.map((m) => (
            <div key={m.name} className="flex items-center gap-4">
              <span className="w-36 shrink-0 font-mono text-xs text-muted-foreground">
                {m.name}
              </span>
              <span className="w-14 shrink-0 font-mono text-xs font-bold tabular-nums">
                {m.label}
              </span>
              <div className="group relative h-7 w-44 shrink-0 rounded-lg bg-muted">
                <div
                  className="absolute top-1 left-1 size-5 rounded-md bg-primary ease-out group-hover:translate-x-[136px]"
                  style={{ transitionDuration: `var(${m.name})` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{m.use}</span>
            </div>
          ))}
          <Separator />
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              aria-label="Rango del calendario"
              options={[
                { value: "dia", label: "Dia" },
                { value: "semana", label: "Semana" },
              ]}
              value={range}
              onChange={setRange}
            />
            <span className="text-xs text-muted-foreground">
              Se desliza la pastilla, no se repinta el fondo de cada opcion.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button>Pulsame</Button>
            <span className="text-xs text-muted-foreground">
              El hundido sale de serie en Button, no hay que anadirlo.
            </span>
          </div>
        </Card>
      </Section>

      <Section title="Cargando" hint="Esqueleto con la altura de lo que llega.">
        <Card className="flex flex-col gap-3 p-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-10 w-14 shrink-0" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </Card>
      </Section>
    </main>
  )
}
