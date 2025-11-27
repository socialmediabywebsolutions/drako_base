import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import { Shield, Layers, Users, Megaphone, MessageCircle, Cpu, Scale, Lock, Sparkles } from "lucide-react";

const departamentos = [
  { nombre: "Dirección y Estrategia", icono: Shield, resumen: "Define foco trimestral y métricas clave", salud: "estable" },
  { nombre: "Contabilidad", icono: Layers, resumen: "Controla facturas, cobros y cashflow", salud: "presión media" },
  { nombre: "Marketing y Redes", icono: Megaphone, resumen: "Activa campañas omnicanal", salud: "estable" },
  { nombre: "Ventas y Atención", icono: Users, resumen: "Gestiona demos y soporte comercial", salud: "alerta" },
  { nombre: "Soporte Técnico", icono: MessageCircle, resumen: "Resuelve incidencias y runbooks", salud: "presión media" },
  { nombre: "Programación / Desarrollo", icono: Cpu, resumen: "Coordina despliegues y calidad", salud: "estable" },
  { nombre: "Ciberseguridad", icono: Lock, resumen: "Audita accesos y riesgos", salud: "estable" },
  { nombre: "Legal y Cumplimiento", icono: Scale, resumen: "Contratos y normativa sectorial", salud: "estable" },
  { nombre: "Subvenciones y Ayudas", icono: Sparkles, resumen: "Detecta convocatorias públicas", salud: "estable" },
];

const variantByHealth = (salud: string) => {
  if (salud === "alerta") return "err" as const;
  if (salud === "presión media") return "warn" as const;
  return "ok" as const;
};

export default function DepartmentsPage() {
  return (
    <div className="space-y-6">
      <Card tone="glass" title="Departamentos base" subtitle="Áreas que sostienen el Campamento Base">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list" aria-label="Departamentos base">
          {departamentos.map((d) => {
            const Icon = d.icono;
            return (
              <section key={d.nombre} className="rounded-2xl border border-[var(--border)]/70 bg-[var(--panel)]/70 p-4 space-y-3" role="listitem" aria-live="polite">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-9 w-9 rounded-2xl bg-[var(--brand-quiet)]/80 text-[var(--brand)] flex items-center justify-center"><Icon className="h-4 w-4" /></span>
                    <h3 className="text-base font-semibold">{d.nombre}</h3>
                  </div>
                  <Badge variant={variantByHealth(d.salud)}>{d.salud}</Badge>
                </div>
                <p className="text-sm text-[var(--muted)]">{d.resumen}</p>
                <p className="text-xs text-[var(--muted)] uppercase tracking-[0.3em]">Agentes activos: 1 • Alertas: 0</p>
              </section>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
