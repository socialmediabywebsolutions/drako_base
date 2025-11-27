import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Tooltip from "@/components/ui/tooltip";
import Link from "next/link";

const kpiCards = [
  { label: "SaaS activos", value: "4", detail: "2 en despliegue", trend: "+12%" },
  { label: "Alertas abiertas", value: "6", detail: "3 críticas", trend: "-25%" },
  { label: "Mensajes inbox (24h)", value: "41", detail: "Tiempo respuesta 11 min", trend: "↗" },
  { label: "Agentes operativos", value: "18", detail: "Cobertura 24/7", trend: "+2" },
];

const provisioningTimeline = [
  { id: "DNS-041", paso: "DNS + SSL", estado: "en curso", equipo: "Ingeniería", detalle: "Propagando registros CNAME en Cloudflare" },
  { id: "PAY-112", paso: "Pasarela de pagos", estado: "pendiente", equipo: "Contabilidad", detalle: "Esperando credenciales Stripe" },
  { id: "QBR-231", paso: "Runbook Q1", estado: "completado", equipo: "Dirección", detalle: "Checklist firmado por liderazgo" },
];

const inboxHighlights = [
  { id: "MSG-1382", canal: "WhatsApp", remitente: "Lucía (Retail)", preview: "Necesitamos activar el bot de seguimiento...", departamento: "Soporte", hace: "hace 2 min" },
  { id: "MSG-1381", canal: "Email", remitente: "Marcos CFO", preview: "Confirma si la proyección de gasto IA 2024...", departamento: "Contabilidad", hace: "hace 18 min" },
  { id: "MSG-1378", canal: "WhatsApp", remitente: "Comercial LATAM", preview: "Se aprobó la versión beta para el piloto...", departamento: "Ventas", hace: "hace 1 h" },
];

const departmentStatus = [
  { nombre: "Dirección", salud: "estable", agentes: 2, tareas: "Planificación Q1" },
  { nombre: "Contabilidad", salud: "presión media", agentes: 3, tareas: "Cierres mensuales" },
  { nombre: "Soporte", salud: "alerta", agentes: 4, tareas: "9 conversaciones abiertas" },
  { nombre: "Programación", salud: "estable", agentes: 3, tareas: "2 despliegues hoy" },
];

const quickShortcuts = [
  { href: "/saas/create", label: "Crear SaaS", detail: "Provisionar con Cloudflare Pages" },
  { href: "/inbox", label: "Bandeja unificada", detail: "Email + WhatsApp" },
  { href: "/alerts", label: "Alertas críticas", detail: "Coordinar respuesta" },
  { href: "/metrics", label: "Métricas IA", detail: "Tokens y ROI" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <Card
        tone="glass"
        title={<span className="inline-flex items-center gap-2">Campamento Base estratégico</span>}
        subtitle="Controla provisión, agentes e inbox desde un único hub operativo"
        right={(
          <div className="flex items-center gap-2">
            <Link href="/inbox"><Button variant="outline">Ver bandeja</Button></Link>
            <Link href="/saas/create"><Button variant="primary">Crear SaaS</Button></Link>
          </div>
        )}
      >
        <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-4">
            <p className="text-sm text-[var(--muted)]">
              DRĀKO sincroniza provisionamiento, agentes y bandejas para que cada SaaS mantenga gobernanza, métricas y colaboración entre departamentos. Utiliza los accesos directos para ejecutar el siguiente paso.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="list" aria-label="Accesos rápidos">
              {quickShortcuts.map((shortcut) => (
                <Link key={shortcut.href} href={shortcut.href} className="rounded-2xl border border-[var(--border)]/70 bg-[var(--panel)]/70 p-4 hover:border-[var(--brand)]/50 transition" role="listitem">
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Acción</p>
                  <p className="text-base font-semibold text-[var(--foreground)]">{shortcut.label}</p>
                  <p className="text-sm text-[var(--muted)]">{shortcut.detail}</p>
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--brand)]/30 bg-[var(--brand-quiet)]/60 p-5">
            <div className="text-xs uppercase tracking-[0.3em] text-[var(--brand)] mb-3">KPI en vivo</div>
            <dl className="grid gap-3">
              {kpiCards.map((kpi) => (
                <div key={kpi.label} className="space-y-1">
                  <dt className="text-xs text-[var(--muted)] uppercase tracking-wide">{kpi.label}</dt>
                  <Tooltip label={`${kpi.detail} (${kpi.trend})`}>
                    <dd className="text-2xl font-semibold">{kpi.value}</dd>
                  </Tooltip>
                  <p className="text-xs text-[var(--muted)]">{kpi.detail} • {kpi.trend}</p>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title="Timeline de provisión"
          subtitle="Pasos críticos para nuevos despliegues"
        >
          <div className="space-y-3" role="list" aria-label="Timeline de provisión">
            {provisioningTimeline.map((item) => (
              <div key={item.id} className="rounded-2xl border border-[var(--border)]/70 bg-[var(--panel)]/80 p-4" role="listitem">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold">{item.paso}</p>
                    <p className="text-xs text-[var(--muted)]">ID {item.id} • {item.equipo}</p>
                  </div>
                  <Tooltip label={`Última actualización: ${item.detalle}`}>
                    <Badge variant={item.estado === "completado" ? "ok" : item.estado === "en curso" ? "info" : "warn"}>{item.estado}</Badge>
                  </Tooltip>
                </div>
                <p className="mt-2 text-sm text-[var(--foreground)]">{item.detalle}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Bandeja unificada"
          subtitle="Resumen de conversaciones recientes"
          right={<Link href="/inbox"><Button variant="outline" size="sm">Ir a Inbox</Button></Link>}
        >
          <div className="space-y-3">
            {inboxHighlights.map((msg) => (
              <div key={msg.id} className="rounded-2xl border border-[var(--border)]/70 bg-[var(--panel)]/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  <span>{msg.canal}</span>
                  <Tooltip label={`Llegó ${msg.hace}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
                  </Tooltip>
                  <span>{msg.hace}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{msg.remitente}</p>
                    <p className="text-sm text-[var(--muted)]">{msg.preview}</p>
                  </div>
                  <Badge>{msg.departamento}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Salud de departamentos" subtitle="Capacidad operativa y foco por dominio">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {departmentStatus.map((dept) => (
            <section key={dept.nombre} className="rounded-2xl border border-[var(--border)]/70 bg-[var(--panel)]/70 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">{dept.nombre}</h3>
                <Badge variant={dept.salud === "alerta" ? "err" : dept.salud === "presión media" ? "warn" : "ok"}>{dept.salud}</Badge>
              </div>
              <p className="text-sm text-[var(--muted)]">{dept.agentes} agentes asignados</p>
              <p className="text-sm text-[var(--foreground)]">{dept.tareas}</p>
            </section>
          ))}
        </div>
      </Card>
    </div>
  );
}
