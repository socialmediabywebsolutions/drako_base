"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users2,
  Bot,
  Activity,
  BellRing,
  Share2,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

type Item = { href: string; label: string; icon: ReactNode; description?: string };

const grupos: { titulo: string; items: Item[] }[] = [
  {
    titulo: "Holding",
    items: [
      {
        href: "/operator",
        label: "Dashboard",
        description: "Finanzas · Fiscal · KPIs",
        icon: <LayoutDashboard className="h-4 w-4" />,
      },
      {
        href: "/clients",
        label: "Clientes",
        description: "Gestión de cuentas",
        icon: <Users2 className="h-4 w-4" />,
      },
    ],
  },
  {
    titulo: "SaaS",
    items: [
      {
        href: "/operator/socialflow",
        label: "Socialcors",
        description: "Redes · IA · Campañas",
        icon: <Share2 className="h-4 w-4" />,
      },
      {
        href: "/metrics",
        label: "Métricas",
        description: "Costes y ROI",
        icon: <TrendingUp className="h-4 w-4" />,
      },
    ],
  },
  {
    titulo: "Sistema",
    items: [
      {
        href: "/agents",
        label: "Agentes IA",
        description: "Estado y modelos",
        icon: <Bot className="h-4 w-4" />,
      },
      {
        href: "/alerts",
        label: "Alertas",
        description: "Incidencias activas",
        icon: <BellRing className="h-4 w-4" />,
      },
      {
        href: "/admin",
        label: "Admin",
        description: "Multi-tenant · Accesos",
        icon: <ShieldCheck className="h-4 w-4" />,
      },
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
    // exact match for /operator to avoid matching /operator/socialflow
    if (href === "/operator") return pathname === "/operator" || pathname === "/operator/";
    return pathname.startsWith(href);
  };

  async function logout() {
    await fetch("/api/operator-logout", { method: "POST" }).catch(() => null);
    window.location.assign("/operator-login");
  }

  return (
    <aside
      style={innerStyle}
      className="hidden lg:flex h-full shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6"
    >
      {/* Logo */}
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="h-8 w-8 rounded-xl bg-sky-500 text-white font-black text-base flex items-center justify-center shadow-lg shadow-sky-500/20">
          Δ
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-[0.3em] text-slate-400">Drāko</p>
          <p className="text-sm font-bold text-slate-900 leading-tight">Operator</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="space-y-6 flex-1 overflow-y-auto pr-1" aria-label="Navegación principal">
        {grupos.map((g) => (
          <div key={g.titulo} className="space-y-1">
            <div className="px-3 text-[10px] uppercase font-black tracking-[0.3em] text-slate-400 mb-2">
              {g.titulo}
            </div>
            {g.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:rounded-xl"
                  aria-current={active ? "page" : undefined}
                >
                  <div
                    className={[
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
                      active
                        ? "bg-sky-50 text-sky-900"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "rounded-lg p-1.5 transition-colors",
                        active
                          ? "bg-sky-500 text-white shadow-sm shadow-sky-500/30"
                          : "bg-slate-100 text-slate-400",
                      ].join(" ")}
                    >
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{item.label}</p>
                      {item.description && (
                        <p className="text-[10px] text-slate-400 truncate">{item.description}</p>
                      )}
                    </div>
                    {active && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={logout}
          className="w-full text-left text-[11px] text-slate-400 hover:text-slate-600 transition-colors px-2"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
