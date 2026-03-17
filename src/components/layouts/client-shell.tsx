'use client';

import Link from 'next/link';
import React, { useMemo } from 'react';
import type { StrategicDossier } from '@/lib/orchestrator/types';
import RightPanel from '@/components/right-panel';

interface ClientShellProps {
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

function formatCompactDate(value: string | null | undefined): string {
  if (!value) return "Not scheduled";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

export default function ClientShell({
  children,
  dossier,
  instance,
  entryMode,
  workspaceKind,
  contentWidth = "standard",
  workspaceSummary,
}: ClientShellProps) {
  const isHoldingMode = entryMode === "holding_operator";
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
    { href: "/client", label: "Workspace", description: isHoldingMode ? "Factory output, provisioning, and active SaaS" : "Product dashboard and operator flow" },
    { href: "/client/settings/account", label: "Account", description: "Identity, session and workspace switching" },
    { href: "/client/settings/team", label: "Team", description: "Members, roles and pending invites" },
    { href: "/client/settings/billing", label: "Billing", description: "Plan, subscription and Stripe portal" },
  ];

  return (
    <div
      className="flex min-h-screen w-full bg-[linear-gradient(180deg,#eff6ff_0%,#f8fafc_22%,#ffffff_100%)] text-slate-900"
      data-shell="tenant-workspace"
      data-entry-mode={entryMode ?? "product_operator"}
      data-workspace-kind={workspaceKind ?? "owned_saas"}
    >
      <aside className="hidden w-[292px] flex-shrink-0 border-r border-slate-200 bg-white/90 p-6 backdrop-blur xl:flex xl:flex-col">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">Campamento Base</div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            {isHoldingMode ? "Owner control center" : "Tenant workspace"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            {isHoldingMode
              ? "Holding-side shell for owner auth, factory oversight, billing context and child SaaS registry visibility."
              : "Shared SaaS core for auth, team access, billing, onboarding and child product entry."}
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_20px_60px_rgba(15,23,42,0.24)]">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-200">Workspace status</div>
          <div className="mt-3 text-lg font-black">{workspaceSummary?.tenantName ?? "Tenant workspace"}</div>
          <div className="mt-2 text-sm text-slate-300">{trialSummary.message}</div>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Plan</div>
              <div className="mt-1 text-sm font-semibold text-white">{workspaceSummary?.plan ?? "STARTER"}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Role</div>
              <div className="mt-1 text-sm font-semibold text-white">{workspaceSummary?.currentUserRole ?? "Member"}</div>
            </div>
          </div>
        </div>

        <nav className="mt-8 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-2xl border border-transparent px-4 py-3 transition-all hover:border-slate-200 hover:bg-slate-50"
            >
              <div className="text-sm font-semibold text-slate-900">{item.label}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500">{item.description}</div>
            </Link>
          ))}
        </nav>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Connected products</div>
          <div className="mt-4 space-y-3">
            {(workspaceSummary?.connectedProducts.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-500">No child products connected yet.</p>
            ) : workspaceSummary?.connectedProducts.map((product) => (
              <div key={product.id} className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">{product.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {product.slug} · {formatLabel(product.status)}
                </div>
              </div>
            ))}
          </div>
        </div>

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
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">Workspace control center</div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-black tracking-tight text-slate-950">
                    {workspaceSummary?.tenantName ?? instance?.name ?? "Tenant workspace"}
                  </h1>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] ${isHoldingMode ? "border border-sky-200 bg-sky-50 text-sky-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                    {isHoldingMode ? "Owner mode" : "Product mode"}
                  </span>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  {isHoldingMode
                    ? "Campamento Base authenticates owner operators only. Child SaaS users sign in on their product hosts while Drako provisions and tracks the factory output here."
                    : "Auth, team operations, billing and child SaaS entry now live inside one canonical workspace shell."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                  Plan: {workspaceSummary?.plan ?? "STARTER"}
                </div>
                <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                  Role: {workspaceSummary?.currentUserRole ?? "Member"}
                </div>
                <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                  Billing: {formatLabel(workspaceSummary?.billingStatus)}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Surface</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{isHoldingMode ? "Owner control center" : "Product workspace"}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Workspace kind</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{formatLabel(workspaceKind)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Connected products</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{workspaceSummary?.connectedProducts.length ?? 0}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Onboarding</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">
                  {workspaceSummary?.onboardingNextStep ? `Next: ${formatLabel(workspaceSummary.onboardingNextStep)}` : "Complete"}
                </div>
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

          <aside className="hidden w-[360px] flex-shrink-0 border-l border-slate-200 bg-white/70 backdrop-blur lg:block">
            {isHoldingMode ? (
              <RightPanel />
            ) : (
              <div className="space-y-5 p-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-600">Onboarding</div>
                  <div className="mt-3 text-3xl font-black text-slate-950">{workspaceSummary?.onboardingProgress ?? 0}%</div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-sky-500 transition-all"
                      style={{ width: `${workspaceSummary?.onboardingProgress ?? 0}%` }}
                    />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {workspaceSummary?.onboardingNextStep
                      ? `Next step: ${formatLabel(workspaceSummary.onboardingNextStep)}`
                      : "Workspace onboarding is complete."}
                  </p>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Current product</div>
                  <div className="mt-3 text-lg font-black text-slate-950">{instance?.name ?? "No active product selected"}</div>
                  <div className="mt-2 text-sm text-slate-500">
                    {instance
                      ? `${formatLabel(instance.status)} · ${instance.slug}`
                      : "Connect or activate a child SaaS to operate from this workspace."}
                  </div>
                  {instance ? (
                    <dl className="mt-4 space-y-3 text-sm text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <dt>Primary domain</dt>
                        <dd className="text-right font-medium text-slate-900">{instance.custom_domain ?? instance.trial_domain ?? "Pending"}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt>Last update</dt>
                        <dd className="text-right font-medium text-slate-900">{formatCompactDate(instance.updated_at)}</dd>
                      </div>
                      {trialSummary.daysLeft != null ? (
                        <div className="flex items-center justify-between gap-3">
                          <dt>Trial window</dt>
                          <dd className="text-right font-medium text-slate-900">{trialSummary.daysLeft} days left</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Workspace contract</div>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                    <li>Campamento Base owns auth, team, billing and onboarding.</li>
                    <li>`/client` is the authenticated tenant workspace.</li>
                    <li>Child SaaS products inherit access from this shell.</li>
                  </ul>
                </div>

                {dossier ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Strategic context</div>
                    <div className="mt-3 text-sm text-slate-600">
                      Dossier available for <span className="font-semibold text-slate-900">{dossier.form_data.business.sector}</span>.
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
