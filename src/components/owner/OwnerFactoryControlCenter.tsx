"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/input";
import Select from "@/components/ui/select";
import type { CanonicalFactoryOverview } from "@/lib/saas/canonical-registry";
import { buildSocialFlowBlueprintDraft } from "@/lib/catalog/products/socialflow";

type JobTimelineEntry = {
  type: string;
  step: string;
  state: string;
  status: string;
  timestamp?: string;
  details: string | null;
};

type JobStatusPayload = {
  ok: boolean;
  job: {
    jobId: string;
    saasId: string;
    state: string;
    rawState: string;
    timeline: JobTimelineEntry[];
  };
};

type Props = {
  tenantName: string;
  tenantRole: string;
  initialOverview: CanonicalFactoryOverview;
  workspaceSummary: {
    plan: string;
    billingStatus: string;
    onboardingProgress: number;
    onboardingNextStep: string | null;
    connectedProductsCount: number;
  };
};

type CreateFormState = {
  name: string;
  slug: string;
  blueprint: "GENERIC" | "SOCIALFLOW";
  verticalId: string;
  customDomainRequested: string;
};

function createEmptyForm(): CreateFormState {
  return {
    name: "",
    slug: "",
    blueprint: "GENERIC",
    verticalId: "OTHER",
    customDomainRequested: "",
  };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not available";
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function buildProductEntryHref(domain: string | null | undefined): string | null {
  if (!domain) return null;
  if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    return `/socialflow?__drako_host=${encodeURIComponent(domain)}`;
  }
  return `https://${domain}/socialflow`;
}

const TERMINAL_STATES = new Set(["SUCCESS", "DEGRADED", "FAILED"]);

function formatLabel(value: string | null | undefined): string {
  if (!value) return "Not configured";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStateTone(state: string | null | undefined) {
  const normalized = (state ?? "").toUpperCase();
  if (normalized === "SUCCESS" || normalized === "ACTIVE") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "DEGRADED" || normalized === "PENDING" || normalized === "VERIFYING" || normalized === "RUNNING") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (normalized === "FAILED" || normalized === "ERROR") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function OwnerFactoryControlCenter({
  tenantName,
  tenantRole,
  initialOverview,
  workspaceSummary,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<CreateFormState>(createEmptyForm);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [job, setJob] = useState<JobStatusPayload["job"] | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isPolling, setIsPolling] = useState(false);
  const overview = initialOverview;
  const readiness = useMemo(() => {
    const healthySaas = overview.saases.filter((item) => item.instanceStatus === "active" && item.domainStatus === "active").length;
    const attentionSaas = overview.saases.filter((item) => item.instanceStatus !== "active" || item.domainStatus !== "active").length;
    const failedJobs = overview.jobs.filter((item) => item.state === "FAILED").length;
    const posture =
      failedJobs > 0 || overview.counts.degradedJobs > 0
        ? "Attention required"
        : overview.counts.provisioningRunning > 0
          ? "Factory active"
          : healthySaas > 0
            ? "Operationally stable"
            : "Ready to launch";

    return {
      healthySaas,
      attentionSaas,
      failedJobs,
      posture,
    };
  }, [overview]);
  const timelineHeadline = job?.rawState ? formatLabel(job.rawState) : "Queued";
  const feedbackToneClass = feedback?.includes("queued")
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : feedback?.toLowerCase().includes("unable")
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-slate-200 bg-slate-50 text-slate-700";

  useEffect(() => {
    if (!jobId) return;
    if (job && TERMINAL_STATES.has(job.rawState)) return;

    let cancelled = false;
    setIsPolling(true);

    const tick = async () => {
      try {
        const response = await fetch(`/api/factory/provisioning/jobs/${jobId}`, { cache: "no-store" });
        const payload = (await response.json()) as JobStatusPayload;
        if (!response.ok || !payload.ok) {
          throw new Error("Unable to refresh provisioning job");
        }
        if (cancelled) return;
        setJob(payload.job);
        if (TERMINAL_STATES.has(payload.job.rawState)) {
          setIsPolling(false);
          router.refresh();
          return;
        }
        window.setTimeout(tick, 2000);
      } catch (error) {
        if (cancelled) return;
        setFeedback(error instanceof Error ? error.message : "Unable to refresh provisioning status.");
        setIsPolling(false);
      }
    };

    void tick();

    return () => {
      cancelled = true;
    };
  }, [job, jobId, router]);

  const nextEntryHref = useMemo(() => {
    if (!job?.saasId) return null;
    const matchingSaas = overview.saases.find((item) => item.id === job.saasId);
    return buildProductEntryHref(matchingSaas?.domain);
  }, [job?.saasId, overview.saases]);

  const submitCreate = () => {
    startTransition(async () => {
      setFeedback(null);
      setJob(null);
      setJobId(null);

      try {
        const blueprintDraft =
          form.blueprint === "SOCIALFLOW"
            ? buildSocialFlowBlueprintDraft({
                customDomainRequested: form.customDomainRequested.trim() || null,
              })
            : {
                verticalId: form.verticalId,
                proposedSlug: form.slug,
                saasName: form.name,
                provisioning: {
                  domains: {
                    primarySubdomain: form.slug,
                    customDomainRequested: form.customDomainRequested.trim() || null,
                  },
                },
              };

        const response = await fetch("/api/factory/provisioning/create-saas", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            slug: form.slug,
            blueprintDraft,
          }),
        });
        const payload = (await response.json()) as { ok?: boolean; jobId?: string; message?: string; code?: string };
        if (!response.ok || !payload.ok || !payload.jobId) {
          throw new Error(payload.message ?? payload.code ?? "Unable to create SaaS.");
        }

        setFeedback(`Provisioning job ${payload.jobId} queued.`);
        setJobId(payload.jobId);
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "Unable to create SaaS.");
      }
    });
  };

  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="max-w-4xl space-y-4">
            <div className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-sky-700">
              Operator
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950">Operator control center</h1>
            <p className="text-sm leading-7 text-slate-500">
              Control the real Drako ecosystem from one place: create SaaS through the canonical factory, track runtime and domain readiness, and enter only products that exist in the canonical runtime tables.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-700">Factory posture</div>
                <div className="mt-2 text-xl font-black text-slate-950">{readiness.posture}</div>
                <div className="mt-1 text-sm text-slate-600">
                  {readiness.healthySaas} healthy SaaS · {overview.counts.provisioningRunning} job{overview.counts.provisioningRunning === 1 ? "" : "s"} moving
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Workspace onboarding</div>
                <div className="mt-2 text-xl font-black text-slate-950">{workspaceSummary.onboardingProgress}%</div>
                <div className="mt-1 text-sm text-slate-600">
                  {workspaceSummary.onboardingNextStep ? `Next: ${formatLabel(workspaceSummary.onboardingNextStep)}` : "Workspace onboarding complete"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Workspace billing</div>
                <div className="mt-2 text-xl font-black text-slate-950">{formatLabel(workspaceSummary.plan)}</div>
                <div className="mt-1 text-sm text-slate-600">
                  Subscription {formatLabel(workspaceSummary.billingStatus)} · {workspaceSummary.connectedProductsCount} product link{workspaceSummary.connectedProductsCount === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] px-6 py-5 text-white shadow-[0_24px_80px_-44px_rgba(15,23,42,0.72)]">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-200">Operator context</div>
            <div className="mt-2 text-2xl font-black text-white">{tenantName}</div>
            <div className="mt-1 text-sm text-slate-300">{tenantRole} access</div>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Readiness board</div>
                <div className="mt-1 text-sm text-white">{readiness.healthySaas} active + domain-ready</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Needs attention</div>
                <div className="mt-1 text-sm text-white">{readiness.attentionSaas + overview.counts.degradedJobs + readiness.failedJobs} ecosystem signal{readiness.attentionSaas + overview.counts.degradedJobs + readiness.failedJobs === 1 ? "" : "s"}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Commercial posture</div>
                <div className="mt-1 text-sm text-white">Plan {formatLabel(workspaceSummary.plan)} · Billing {formatLabel(workspaceSummary.billingStatus)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-5 md:grid-cols-2">
        <Card title="Active SaaS">
          <div className="text-4xl font-black text-slate-950">{overview.counts.activeSaas}</div>
          <p className="mt-2 text-sm text-slate-500">Provisioned child products currently active.</p>
        </Card>
        <Card title="Ready to Enter" tone={readiness.healthySaas > 0 ? "success" : "default"}>
          <div className="text-4xl font-black text-slate-950">{readiness.healthySaas}</div>
          <p className="mt-2 text-sm text-slate-500">SaaS with active runtime and active primary domain.</p>
        </Card>
        <Card title="Provisioning Running">
          <div className="text-4xl font-black text-slate-950">{overview.counts.provisioningRunning}</div>
          <p className="mt-2 text-sm text-slate-500">Jobs currently moving through the canonical factory.</p>
        </Card>
        <Card title="Degraded Jobs" tone={overview.counts.degradedJobs > 0 ? "danger" : "success"}>
          <div className="text-4xl font-black text-slate-950">{overview.counts.degradedJobs}</div>
          <p className="mt-2 text-sm text-slate-500">Provisioning runs requiring operator follow-up.</p>
        </Card>
        <Card title="Primary Domains">
          <div className="text-4xl font-black text-slate-950">{overview.counts.activeDomains}</div>
          <p className="mt-2 text-sm text-slate-500">Canonical primary domains active on Workers custom domains.</p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <Card
          title="Create SaaS"
          subtitle="Canonical factory flow"
          actions={<Button onClick={submitCreate} loading={isPending} disabled={!form.name.trim() || !form.slug.trim()}>Queue provisioning</Button>}
        >
          <div className="mb-5 grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Contract</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">Queue → Orchestrator → Runtime</div>
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Activation</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">Domain + bootstrap + consistency</div>
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Output</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">Real SaaS only, no registry bypass</div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Field label="SaaS name">
              <TextInput value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Socialcors" />
            </Field>
            <Field label="Slug">
              <TextInput value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))} placeholder="socialflows" />
            </Field>
            <Field label="Blueprint">
              <Select value={form.blueprint} onChange={(event) => setForm((current) => ({ ...current, blueprint: event.target.value as CreateFormState["blueprint"] }))}>
                <option value="GENERIC">Generic SaaS</option>
                <option value="SOCIALFLOW">Socialcors pilot blueprint</option>
              </Select>
            </Field>
            <Field label="Vertical">
              <Select value={form.verticalId} onChange={(event) => setForm((current) => ({ ...current, verticalId: event.target.value }))} disabled={form.blueprint === "SOCIALFLOW"}>
                <option value="OTHER">Other</option>
                <option value="MARKETING">Marketing</option>
                <option value="OPERATIONS">Operations</option>
                <option value="FINANCE">Finance</option>
              </Select>
            </Field>
            <div className="xl:col-span-2">
              <Field label="Requested custom domain">
                <TextInput value={form.customDomainRequested} onChange={(event) => setForm((current) => ({ ...current, customDomainRequested: event.target.value }))} placeholder="app.socialflow.example.com" />
              </Field>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
            This form calls the live canonical route `/api/factory/provisioning/create-saas`. It does not bypass the queue, orchestrator, runtime activation, bootstrap, or domain provisioning contract.
          </div>

          {feedback ? <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm font-medium ${feedbackToneClass}`}>{feedback}</div> : null}
        </Card>

        <Card
          title="Provisioning timeline"
          subtitle={jobId ? `Job ${jobId}` : "Queued, running, success, degraded or failed"}
          actions={nextEntryHref && job?.rawState === "SUCCESS" ? <a className="rounded-full bg-slate-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white" href={nextEntryHref}>Open SaaS</a> : null}
        >
          {!jobId ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-600">
              Queue a SaaS and the canonical factory timeline will appear here.
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`rounded-2xl border px-5 py-4 ${getStateTone(job?.rawState)}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-black">{timelineHeadline}</div>
                  <div className="text-xs font-semibold">{isPolling ? "Refreshing" : "Stable snapshot"}</div>
                </div>
                <div className="mt-2 text-sm">
                  {job?.saasId ? `Canonical SaaS id ${job.saasId}` : "Waiting for SaaS allocation."}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.18em]">
                  <span className="rounded-full border border-current/15 bg-white/70 px-3 py-1">Queued</span>
                  <span className="rounded-full border border-current/15 bg-white/70 px-3 py-1">Runtime aware</span>
                  <span className="rounded-full border border-current/15 bg-white/70 px-3 py-1">Bootstrap gated</span>
                  <span className="rounded-full border border-current/15 bg-white/70 px-3 py-1">Domain validated</span>
                </div>
              </div>

              <div className="space-y-3">
                {(job?.timeline ?? []).map((entry, index) => (
                  <div key={`${entry.step}-${index}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">{entry.step}</div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStateTone(entry.state)}`}>
                        {entry.state}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{entry.details ?? "No extra details."}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Card title="Provisioned SaaS" subtitle="Canonical registry view only">
          <div className="space-y-4">
            {overview.saases.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-600">
                No active child SaaS exists for this owner tenant yet.
              </div>
            ) : overview.saases.map((saas) => {
              const href = buildProductEntryHref(saas.domain);
              const readinessLabel = saas.instanceStatus === "active" && saas.domainStatus === "active"
                ? "Ready"
                : saas.provisioningStatus === "DEGRADED" || saas.domainStatus === "failed"
                  ? "Needs review"
                  : "Provisioning";
              return (
                <div key={saas.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-lg font-black tracking-tight text-slate-950">{saas.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{saas.slug}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <span className={`rounded-full border px-3 py-1 ${getStateTone(saas.instanceStatus ?? saas.saasStatus)}`}>{saas.instanceStatus ?? saas.saasStatus}</span>
                      <span className={`rounded-full border px-3 py-1 ${getStateTone(saas.domainStatus ?? "pending")}`}>{saas.domainStatus ?? "pending"}</span>
                      {saas.provisioningStatus ? (
                        <span className={`rounded-full border px-3 py-1 ${getStateTone(saas.provisioningStatus)}`}>{saas.provisioningStatus}</span>
                      ) : null}
                      <span className={`rounded-full border px-3 py-1 ${getStateTone(readinessLabel === "Ready" ? "ACTIVE" : readinessLabel === "Needs review" ? "DEGRADED" : "RUNNING")}`}>
                        {readinessLabel}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-3 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
                    <span>{saas.domain ?? "Primary domain pending"}</span>
                    <div className="flex items-center gap-3">
                      <span>Updated {formatDate(saas.updatedAt)}</span>
                      {href ? <a className="font-semibold text-sky-700" href={href}>Enter SaaS</a> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Factory signals" subtitle="Health, jobs, and operator follow-up">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Workspace state</div>
                <div className="mt-2 text-base font-black text-slate-950">{formatLabel(workspaceSummary.billingStatus)}</div>
                <div className="mt-1 text-sm text-slate-600">Billing {formatLabel(workspaceSummary.plan)} · onboarding {workspaceSummary.onboardingProgress}%</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Operator next step</div>
                <div className="mt-2 text-base font-black text-slate-950">
                  {workspaceSummary.onboardingNextStep ? formatLabel(workspaceSummary.onboardingNextStep) : "Review factory output"}
                </div>
                <div className="mt-1 text-sm text-slate-600">Use this panel to spot degraded jobs, pending domains, and SaaS ready to enter.</div>
              </div>
            </div>

            {overview.jobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-600">
                No provisioning jobs recorded yet.
              </div>
            ) : overview.jobs.map((entry) => (
              <div key={entry.jobId} className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-slate-950">{entry.jobId}</div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStateTone(entry.state)}`}>{entry.state}</span>
                </div>
                <div className="mt-2 text-sm text-slate-500">SaaS: {entry.saasId ?? "pending allocation"}</div>
                <div className="mt-1 text-xs text-slate-400">Updated {formatDate(entry.updatedAt)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
