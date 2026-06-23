"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Membership = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
};

type SocialFlowAccountSettingsProps = {
  user: {
    name: string | null;
    email: string;
    currentTenantId: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
  };
  workspace: {
    tenantName: string;
    tenantSlug: string;
    plan: string;
    billingStatus: string;
    onboardingProgress: number;
  };
  memberships: Membership[];
  allowWorkspaceSwitch?: boolean;
  logoutEndpoint: string;
  logoutRedirectTo?: string;
  sessionLabel?: string;
};

function RoleBadge({ role }: { role: Membership["role"] }) {
  const cls =
    role === "OWNER"
      ? "bg-violet-500/15 text-violet-300 border border-violet-500/25"
      : role === "ADMIN"
        ? "bg-sky-500/15 text-sky-300 border border-sky-500/25"
        : "bg-white/8 text-white/45 border border-white/10";
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${cls}`}>
      {role}
    </span>
  );
}

const panelCls = "rounded-xl border border-white/8 bg-white/4 p-5";
const labelSmCls = "text-[11px] font-bold uppercase tracking-[0.2em] text-white/35";

export default function SocialFlowAccountSettings({
  user,
  workspace,
  memberships,
  allowWorkspaceSwitch = false,
  logoutEndpoint,
  logoutRedirectTo = "/socialflow/auth",
  sessionLabel = "sesión aislada SocialFlow",
}: SocialFlowAccountSettingsProps) {
  const router = useRouter();
  const [tenantId, setTenantId] = useState(user.currentTenantId);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSigningOut, startSignOut] = useTransition();

  const switchTenant = () => {
    startTransition(async () => {
      setMessage(null);
      const res = await fetch("/api/tenants/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const data = (await res.json().catch(() => ({}))) as { code?: string };
      if (!res.ok) {
        setMessage(data.code ?? "No se pudo cambiar el workspace");
        return;
      }
      setMessage("Workspace cambiado correctamente.");
      router.refresh();
    });
  };

  const handleSignOut = () => {
    startSignOut(async () => {
      await fetch(logoutEndpoint, { method: "POST" });
      router.push(logoutRedirectTo);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Perfil */}
      <section className="rounded-2xl border border-white/10 bg-white/4">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">Perfil del operador</p>
            <h2 className="mt-1 text-lg font-black uppercase italic tracking-tight text-white">Identidad del workspace</h2>
          </div>
          <RoleBadge role={user.role} />
        </header>
        <div className="px-6 py-6">
          <div className="grid gap-4 lg:grid-cols-[1.3fr,1fr]">
            <div className={panelCls}>
              <div className={labelSmCls}>Identidad</div>
              <div className="mt-3 text-2xl font-black tracking-tight text-white">{user.name ?? "Operador del workspace"}</div>
              <div className="mt-2 text-sm text-white/45">{user.email}</div>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold text-white/55">
                  Rol activo: {user.role}
                </span>
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold text-white/55">
                  Sesión: {sessionLabel}
                </span>
              </div>
            </div>
            <div className={panelCls}>
              <div className={labelSmCls}>Workspace activo</div>
              <div className="mt-3 text-xl font-black tracking-tight text-white">{workspace.tenantName}</div>
              <div className="mt-2 text-sm text-white/45">{workspace.tenantSlug}.drako.systems</div>
              <dl className="mt-5 space-y-3 text-sm text-white/45">
                <div className="flex items-center justify-between gap-3">
                  <dt>Plan</dt>
                  <dd className="font-semibold text-white/80">{workspace.plan}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Facturación</dt>
                  <dd className="font-semibold text-white/80">{workspace.billingStatus}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Onboarding</dt>
                  <dd className="font-semibold text-white/80">{workspace.onboardingProgress}%</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* Acceso al workspace */}
      <section className="rounded-2xl border border-white/10 bg-white/4">
        <header className="border-b border-white/8 px-6 py-5">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">Acceso al workspace</p>
          <h2 className="mt-1 text-lg font-black uppercase italic tracking-tight text-white">Cambiar de tenant de forma segura</h2>
        </header>
        <div className="px-6 py-6">
          <div className="grid gap-5 lg:grid-cols-[1.2fr,1fr]">
            <div>
              <label className={`mb-2 block ${labelSmCls}`}>Membresías</label>
              <select
                className="w-full rounded-lg border border-white/10 bg-[#0d0d1e] px-3 py-2 text-sm text-white/70 focus:border-violet-500/50 focus:outline-none"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
              >
                {memberships.map((m) => (
                  <option key={m.tenantId} value={m.tenantId}>
                    {m.tenantName} · {m.role}
                  </option>
                ))}
              </select>
            </div>
            <div className={panelCls}>
              <div className={labelSmCls}>Modelo de sesión canónico</div>
              <p className="mt-3 text-sm leading-6 text-white/45">
                `/socialflow` usa el tenant activo resuelto desde la sesión real del workspace. El bypass demo local se mantiene aislado en localhost.
              </p>
            </div>
          </div>
          {message && <p className="mt-4 text-sm font-medium text-white/50">{message}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/8 px-6 py-5">
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-red-500/30 hover:bg-red-500/8 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningOut && <span className="h-2 w-2 animate-pulse rounded-full bg-current" />}
            Cerrar sesión
          </button>
          {allowWorkspaceSwitch && (
            <button
              onClick={switchTenant}
              disabled={isPending || tenantId === user.currentTenantId}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending && <span className="h-2 w-2 animate-pulse rounded-full bg-current" />}
              Cambiar workspace
            </button>
          )}
        </div>
      </section>

      {/* Membresías */}
      <section className="rounded-2xl border border-white/10 bg-white/4">
        <header className="border-b border-white/8 px-6 py-5">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">Membresías del workspace</p>
          <h2 className="mt-1 text-lg font-black uppercase italic tracking-tight text-white">Todos los workspaces a los que puedes operar</h2>
        </header>
        <div className="px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            {memberships.map((membership) => (
              <div key={membership.tenantId} className={panelCls}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-black tracking-tight text-white/90">{membership.tenantName}</div>
                    <div className="mt-1 text-sm text-white/40">{membership.tenantSlug}.drako.systems</div>
                  </div>
                  <RoleBadge role={membership.role} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
