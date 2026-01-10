"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Layers, Users2, Bot, Activity, BellRing, Landmark, Inbox, Sparkles, Code2, Stethoscope, Building2 } from "lucide-react";

type Item = { href: string; label: string; icon: ReactNode; description?: string };

const grupos: { titulo: string; items: Item[] }[] = [
  {
    titulo: "General",
    items: [
      { href: "/admin", label: "Panel DRĀKO", description: "Admin multi-tenant", icon: <LayoutDashboard className="h-4 w-4" /> },
      { href: "/", label: "Campamento base", description: "Indicadores y accesos", icon: <LayoutDashboard className="h-4 w-4" /> },
      { href: "/saas", label: "Proyectos SaaS", description: "Provisiona y supervisa", icon: <Layers className="h-4 w-4" /> },
      { href: "/inbox", label: "Bandeja unificada", description: "Mensajería central", icon: <Inbox className="h-4 w-4" /> },
    ],
  },
  {
    titulo: "Administración",
    items: [
      { href: "/owner", label: "Owner / Datos fiscales", description: "Configuración tributaria", icon: <Landmark className="h-4 w-4" /> },
      { href: "/clients", label: "Clientes", description: "Relaciones y SaaS", icon: <Users2 className="h-4 w-4" /> },
    ],
  },
  {
    titulo: "Operación",
    items: [
      { href: "/companies", label: "Companies", description: "Vista compat read-only", icon: <Building2 className="h-4 w-4" /> },
      { href: "/departments", label: "Departamentos", description: "Salud y cargas", icon: <Users2 className="h-4 w-4" /> },
      { href: "/agents", label: "Agentes IA", description: "Roles y modelos", icon: <Bot className="h-4 w-4" /> },
      { href: "/dev-architects", label: "DevArchitect", description: "Staff técnico IA", icon: <Code2 className="h-4 w-4" /> },
      { href: "/clinic/dashboard", label: "Clinic", description: "Vertical salud Drako", icon: <Stethoscope className="h-4 w-4" /> },
      { href: "/metrics", label: "Métricas", description: "Costes y ROI", icon: <Activity className="h-4 w-4" /> },
      { href: "/alerts", label: "Alertas", description: "Incidencias", icon: <BellRing className="h-4 w-4" /> },
    ],
  },
  {
    titulo: "Crecimiento",
    items: [
      { href: "/grants", label: "Ayudas y Subvenciones", description: "Pipeline público", icon: <Landmark className="h-4 w-4" /> },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname() ?? "/";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside className="hidden lg:flex h-full w-72 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--panel)]/80 backdrop-blur-xl px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="mb-7 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-strong)] text-white font-black text-lg flex items-center justify-center shadow-[0_12px_35px_rgba(76,201,240,0.4)]">
            Δ
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Drāko</p>
            <p className="text-lg font-semibold">Campamento base</p>
          </div>
        </div>
        <Sparkles className="h-4 w-4 text-[var(--brand)]" />
      </div>

      <div className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--background)]/80 p-4 text-xs text-[var(--muted)]">
        <p className="font-semibold text-[var(--foreground)] mb-1">Estado de misión</p>
        Orquesta SaaS, agentes y bandejas desde un único núcleo operativo.
      </div>

      <nav className="space-y-6 flex-1 overflow-y-auto pr-1" aria-label="Navegación principal">
        {grupos.map((g) => (
          <div key={g.titulo} className="space-y-2">
            <div className="px-2 text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">{g.titulo}</div>
            <div className="space-y-1.5">
              {g.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:rounded-2xl"
                    aria-current={active ? "page" : undefined}
                  >
                    <div
                      className={[
                        "flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-all",
                        active
                          ? "border-[var(--brand)]/60 bg-[var(--brand-quiet)] text-[var(--foreground)] shadow-[0_10px_30px_rgba(76,201,240,0.25)]"
                          : "border-transparent bg-transparent text-[var(--muted)] hover:border-[var(--border)] hover:bg-[var(--panel)]/70 hover:text-[var(--foreground)]",
                      ].join(" ")}
                    >
                      <span className="rounded-xl border border-[var(--border)]/60 bg-[var(--panel)]/60 p-2 text-[var(--brand)]">
                        {item.icon}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{item.label}</p>
                        {item.description && <p className="text-xs text-[var(--muted)]">{item.description}</p>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-6">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)] mb-2">Acciones rápidas</p>
        <div className="grid gap-2">
          <Link href="/saas/create" className="rounded-2xl bg-gradient-to-r from-[var(--brand)] to-[var(--brand-strong)] px-4 py-3 text-sm font-semibold text-white text-center shadow-[0_18px_40px_rgba(76,201,240,0.45)] hover:shadow-[0_22px_45px_rgba(76,201,240,0.55)] transition">Crear SaaS</Link>
          <Link href="/alerts" className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] text-center hover:border-[var(--brand)]/40 hover:text-[var(--brand)] transition">Revisar alertas</Link>
        </div>
      </div>
    </aside>
  );
}
