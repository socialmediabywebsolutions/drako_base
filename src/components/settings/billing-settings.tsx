"use client";

import React, { useState, useTransition } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";

type BillingSettingsProps = {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  stripeConfigured: boolean;
};

const PLAN_COPY: Record<"STARTER" | "PRO" | "ENTERPRISE", string> = {
  STARTER: "Best for the first workspace team and one active child SaaS.",
  PRO: "Adds more room for operators, growth and heavier daily usage.",
  ENTERPRISE: "For larger operating teams that need premium support and governance.",
};

export default function BillingSettings({ plan, status, currentPeriodEnd, stripeConfigured }: BillingSettingsProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const startCheckout = (nextPlan: "STARTER" | "PRO" | "ENTERPRISE") => {
    startTransition(async () => {
      setMessage(null);
      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: nextPlan }),
      });
      const data = (await res.json().catch(() => ({}))) as { code?: string; url?: string };
      if (!res.ok || !data.url) {
        setMessage(data.code ?? "Unable to open checkout");
        return;
      }
      window.location.href = data.url;
    });
  };

  const openPortal = () => {
    startTransition(async () => {
      setMessage(null);
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { code?: string; url?: string };
      if (!res.ok || !data.url) {
        setMessage(data.code ?? "Unable to open billing portal");
        return;
      }
      window.location.href = data.url;
    });
  };

  return (
    <div className="space-y-6">
      <Card title="Subscription snapshot" subtitle="Current commercial state" tone="glass">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Plan</div>
            <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">{plan}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</div>
            <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">{status}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Current period end</div>
            <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">
              {currentPeriodEnd ? new Date(currentPeriodEnd).toLocaleDateString() : "Not active"}
            </div>
          </div>
        </div>
        {!stripeConfigured ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Stripe is not configured in this environment yet. Checkout and portal routes remain guarded and will return a clear configuration error instead of failing open.
          </div>
        ) : null}
        {message ? <p className="mt-4 text-sm font-medium text-slate-600">{message}</p> : null}
      </Card>

      <Card title="Upgrade workspace plan" subtitle="Choose the right commercial tier">
        <div className="grid gap-4 lg:grid-cols-3">
          {(["STARTER", "PRO", "ENTERPRISE"] as const).map((tier) => {
            const isCurrent = tier === plan;
            return (
              <div key={tier} className={`rounded-3xl border p-5 shadow-sm ${isCurrent ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-black tracking-tight text-slate-950">{tier}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{PLAN_COPY[tier]}</p>
                  </div>
                  {isCurrent ? (
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">Current</span>
                  ) : null}
                </div>
                <Button
                  className="mt-6 w-full"
                  variant={isCurrent ? "secondary" : tier === "ENTERPRISE" ? "outline" : "primary"}
                  onClick={() => startCheckout(tier)}
                  loading={isPending}
                  disabled={!stripeConfigured && tier !== plan}
                >
                  {isCurrent ? "Current plan" : `Select ${tier}`}
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Stripe customer portal" subtitle="Self-service billing operations">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm leading-6 text-slate-600">
              Update payment methods, invoices and subscription details in Stripe without leaving the canonical workspace billing model.
            </p>
          </div>
          <Button onClick={openPortal} loading={isPending} variant="outline" disabled={!stripeConfigured}>
            Open Stripe portal
          </Button>
        </div>
      </Card>
    </div>
  );
}
