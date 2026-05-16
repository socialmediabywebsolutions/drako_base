"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type AccountSettingsClientProps = {
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
};

export default function AccountSettingsClient({ user, workspace }: AccountSettingsClientProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isSigningOut, startSignOut] = useTransition();

  function handleSignOut() {
    startSignOut(async () => {
      setMessage(null);
      await fetch("/api/socialflow/auths/logouts", { method: "POST" });
      router.push("/socialflow/auth");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.3fr,1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Identity</div>
          <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">{user.name ?? "Workspace operator"}</div>
          <div className="mt-2 text-sm text-slate-500">{user.email}</div>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
              Active role: {user.role}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
              Session: isolated socialflow session
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
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Workspace access</div>
            <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">Product-native account boundary</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              This account view now lives fully inside the SocialFlow runtime. Workspace switching stays disabled until a
              dedicated product workflow lands in the isolated app.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 disabled:opacity-60"
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>

        {message ? <p className="mt-4 text-sm font-medium text-slate-600">{message}</p> : null}
      </section>
    </div>
  );
}
