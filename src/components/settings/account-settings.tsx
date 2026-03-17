"use client";

import React, { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Select from "@/components/ui/select";

type Membership = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
};

type AccountSettingsProps = {
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
};

function RoleBadge({ role }: { role: Membership["role"] }) {
  const styles =
    role === "OWNER"
      ? "bg-slate-950 text-white"
      : role === "ADMIN"
        ? "bg-sky-100 text-sky-700"
        : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${styles}`}>{role}</span>;
}

export default function AccountSettings({ user, workspace, memberships }: AccountSettingsProps) {
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
        setMessage(data.code ?? "Unable to switch workspace");
        return;
      }
      setMessage("Workspace switched successfully.");
      router.refresh();
    });
  };

  const handleSignOut = () => {
    startSignOut(async () => {
      await signOut({ callbackUrl: "/auth/login" });
    });
  };

  return (
    <div className="space-y-6">
      <Card
        title="Operator profile"
        subtitle="Authenticated workspace identity"
        tone="glass"
        right={<RoleBadge role={user.role} />}
      >
        <div className="grid gap-4 lg:grid-cols-[1.3fr,1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Identity</div>
            <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">{user.name ?? "Workspace operator"}</div>
            <div className="mt-2 text-sm text-slate-500">{user.email}</div>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                Active role: {user.role}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                Session: database-backed
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Active workspace</div>
            <div className="mt-3 text-xl font-black tracking-tight text-slate-950">{workspace.tenantName}</div>
            <div className="mt-2 text-sm text-slate-500">{workspace.tenantSlug}.drako.systems</div>
            <dl className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <dt>Plan</dt>
                <dd className="font-semibold text-slate-900">{workspace.plan}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Billing</dt>
                <dd className="font-semibold text-slate-900">{workspace.billingStatus}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt>Onboarding</dt>
                <dd className="font-semibold text-slate-900">{workspace.onboardingProgress}%</dd>
              </div>
            </dl>
          </div>
        </div>
      </Card>

      <Card
        title="Workspace access"
        subtitle="Switch the active tenant safely"
        actions={(
          <>
            <Button variant="outline" onClick={handleSignOut} loading={isSigningOut}>
              Sign out
            </Button>
            <Button onClick={switchTenant} loading={isPending} disabled={tenantId === user.currentTenantId}>
              Switch workspace
            </Button>
          </>
        )}
      >
        <div className="grid gap-5 lg:grid-cols-[1.2fr,1fr]">
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Memberships</label>
            <Select value={tenantId} onChange={(event) => setTenantId(event.target.value)}>
              {memberships.map((membership) => (
                <option key={membership.tenantId} value={membership.tenantId}>
                  {membership.tenantName} · {membership.role}
                </option>
              ))}
            </Select>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Canonical session model</div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              `/client` uses the active tenant resolved from the real workspace session. Local demo bypass stays isolated to localhost.
            </p>
          </div>
        </div>

        {message ? <p className="mt-4 text-sm font-medium text-slate-600">{message}</p> : null}
      </Card>

      <Card title="Workspace memberships" subtitle="Every workspace you can operate">
        <div className="grid gap-4 md:grid-cols-2">
          {memberships.map((membership) => (
            <div key={membership.tenantId} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-black tracking-tight text-slate-950">{membership.tenantName}</div>
                  <div className="mt-1 text-sm text-slate-500">{membership.tenantSlug}.drako.systems</div>
                </div>
                <RoleBadge role={membership.role} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
