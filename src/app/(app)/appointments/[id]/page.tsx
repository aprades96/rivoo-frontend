import { PageShell } from "@/components/layout/page-shell"

// Sigue siendo un stub ("En desarrollo"): montar la pantalla completa es del
// bloque del detalle de cita. Esto solo le da cabecera y salida propias
// (`back`/`desktopBack`), coherente con el resto de rutas de `(app)` -- sin
// esto, el `<main>` de escritorio (sin ancho maximo) la estiraba a ~1190px.
export default function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PageShell title="Detalle de cita" back desktopBack="plain">
      <p className="text-sm text-muted-foreground">En desarrollo</p>
    </PageShell>
  )
}
