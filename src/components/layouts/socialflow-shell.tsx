'use client';

import Link from 'next/link';
import React, { useMemo } from 'react';
import type { StrategicDossier } from '@/lib/orchestrator/types';

interface SocialFlowShellProps {
  children: React.ReactNode;
  dossier?: StrategicDossier;
  instance?: any;
  entryMode?: string;
  workspaceKind?: string;
  contentWidth?: "standard" | "wide";
  workspaceSummary?: {
    tenantName: string;
    tenantSlug: string;
    plan: string;
    billingStatus: string;
    onboardingProgress: number;
    onboardingNextStep: string | null;
    currentUserRole: string;
    connectedProducts: Array<{
      id: string;
      slug: string;
      name: string;
      status: string;
    }>;
  };
}

function formatLabel(value: string | null | undefined): string {
  if (!value) return "Not configured";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function SocialFlowShell({
  children,
  dossier,
  instance,
  entryMode,
  workspaceKind,
  contentWidth = "standard",
  workspaceSummary,
}: SocialFlowShellProps) {
  const layoutWidthClass = contentWidth === "wide" ? "max-w-[88rem]" : "max-w-6xl";
  const trialSummary = useMemo(() => {
    if (!instance?.trial_started_at) {
      return { status: "stable", message: "Workspace shell active", daysLeft: null as number | null };
    }

    const startedAt = new Date(instance.trial_started_at).getTime();
    if (Number.isNaN(startedAt)) {
      return { status: "stable", message: "Workspace shell active", daysLeft: null as number | null };
    }

    const elapsedDays = Math.floor((Date.now() - startedAt) / (1000 * 60 * 60 * 24));
    const daysLeft = Math.max(0, 30 - elapsedDays);
    if (instance.status === "active") {
      return { status: "active", message: "Product runtime active", daysLeft };
    }
    if (daysLeft <= 7) {
      return { status: "attention", message: `Trial window with ${daysLeft} days left`, daysLeft };
    }
    return { status: "stable", message: `Trial active with ${daysLeft} days left`, daysLeft };
  }, [instance]);

  const navItems = [
    { href: "/socialflow", label: "Workspace", description: "Product dashboard and publishing surface" },
    { href: "/socialflow/settings/account", label: "Account", description: "Identity, session and workspace switching" },
    { href: "/socialflow/settings/team", label: "Team", description: "Members, roles and pending invites" },
    { href: "/socialflow/settings/billing", label: "Billing", description: "Product-native billing boundary and status" },
  ];

  return (
    <div
      className="flex min-h-screen w-full bg-[linear-gradient(180deg,#eff6ff_0%,#f8fafc_22%,#ffffff_100%)] text-slate-900"
      data-shell="socialflow-workspace"
      data-entry-mode={entryMode ?? "product_operator"}
      data-workspace-kind={workspaceKind ?? "owned_saas"}
    >
      <aside className="hidden w-[292px] flex-shrink-0 border-r border-slate-200 bg-white/90 p-6 backdrop-blur xl:flex xl:flex-col">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">SocialFlow</div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            Product workspace shell
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            This shell stays inside the SocialFlow product boundary for auth, team access, billing status
            and workspace navigation.
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_20px_60px_rgba(15,23,42,0.24)]">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200">Workspace status</div>
          <div className="mt-3 text-lg font-black">{workspaceSummary?.tenantName ?? "Tenant workspace"}</div>
          <div className="mt-2 text-sm text-slate-300">{trialSummary.message}</div>
        </div>

        <nav className="mt-8 space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="block rounded-2xl border border-transparent px-4 py-3 transition-all hover:border-slate-200 hover:bg-slate-50">
              <div className="text-sm font-semibold text-slate-900">{item.label}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">{item.description}</div>
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-6 text-xs text-slate-400">
          <div>{workspaceSummary?.tenantSlug ?? "tenant-workspace"}.drako.systems</div>
          <div className="mt-1 uppercase tracking-[0.2em]">
            {formatLabel(entryMode)} · {formatLabel(workspaceKind)}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white/80 px-6 py-5 backdrop-blur lg:px-10">
          <div className={`mx-auto flex ${layoutWidthClass} flex-col gap-4`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">Product workspace</div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-black tracking-tight text-slate-950">
                    {workspaceSummary?.tenantName ?? instance?.name ?? "Tenant workspace"}
                  </h1>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  SocialFlow signs users in on the product host and keeps product navigation inside the
                  canonical `/socialflow/*` surface.
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto px-6 py-8 lg:px-10">
            <div className={`${contentWidth === "wide" ? "max-w-[88rem]" : "max-w-5xl"} mx-auto`}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
