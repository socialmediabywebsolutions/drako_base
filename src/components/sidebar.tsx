"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users2, Bot, Activity, BellRing, Landmark, Inbox, Sparkles, Code2, Stethoscope, Building2, Share2 } from "lucide-react";

type Item = { href: string; label: string; icon: ReactNode; description?: string };

const grupos: { titulo: string; items: Item[] }[] = [
  {
    titulo: "General",
    items: [
      { href: "/admin", label: "Panel DRĀKO", description: "Admin multi-tenant", icon: <LayoutDashboard className="h-4 w-4" /> },
      { href: "/inbox", label: "Bandeja unificada", description: "Mensajería central", icon: <Inbox className="h-4 w-4" /> },
    ],
  },
  {
    titulo: "Administración",
    items: [
      { href: "/operator", label: "Operator / Datos fiscales", description: "Configuración tributaria", icon: <Landmark className="h-4 w-4" /> },
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
      { href: "/operator/socialflow", label: "SocialFlow", description: "Redes y campañas", icon: <Share2 className="h-4 w-4" /> },
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

interface SidebarProps {
  innerStyle?: React.CSSProperties;
}

export default function Sidebar({ innerStyle }: SidebarProps) {
  const pathname = usePathname() ?? "/";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside style={innerStyle} className="hidden lg:flex h-full shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6">
      <div className="mb-7 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-sky-500 text-white font-black text-base flex items-center justify-center shadow-lg shadow-sky-500/20">
            Δ
          </div>
          <div className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.3em] text-slate-400 truncate">Drāko</p>
            <p className="text-base font-bold text-slate-900 leading-tight truncate">Operator</p>
          </div>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-sky-100 bg-sky-50/50 p-4 text-xs text-slate-600">
        <p className="font-bold text-slate-900 mb-1">Estado de misión</p>
        Orquesta SaaS, agentes y bandejas desde un único núcleo operativo.
      </div>

      <nav className="space-y-6 flex-1 overflow-y-auto pr-1" aria-label="Navegación principal">
        {grupos.map((g) => (
          <div key={g.titulo} className="space-y-2">
            <div className="px-2 text-[10px] uppercase font-black tracking-[0.3em] text-slate-400">{g.titulo}</div>
            <div className="space-y-1.5">
              {g.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:rounded-2xl"
                    aria-current={active ? "page" : undefined}
                  >
                    <div
                      className={[
                        "flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-all",
                        active
                          ? "border-sky-200 bg-sky-50 text-sky-900 shadow-sm"
                          : "border-transparent bg-transparent text-slate-500 hover:border-slate-100 hover:bg-slate-50 hover:text-slate-900",
                      ].join(" ")}
                    >
                      <span className={[
                        "rounded-xl p-2 transition-colors",
                        active ? "bg-white text-sky-500 shadow-sm" : "bg-slate-50 text-slate-400"
                      ].join(" ")}>
                        {item.icon}
                      </span>
                      <div>
                        <p className="text-sm font-bold">{item.label}</p>
                        {item.description && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.description}</p>}
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
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-2">Acciones rápidas</p>
        <div className="grid gap-2">
          <Link href="/saas/create" className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-black uppercase tracking-widest text-white text-center shadow-lg shadow-sky-500/20 hover:bg-sky-600 transition-all">Crear SaaS</Link>
          <Link href="/alerts" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 text-center hover:bg-slate-50 transition-all">Revisar alertas</Link>
        </div>
      </div>
    </aside>
  );
}
