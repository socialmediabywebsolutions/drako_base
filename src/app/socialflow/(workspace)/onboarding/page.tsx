"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const SOCIAL_NETWORKS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "x", label: "X / Twitter" },
];

const COMPETITOR_PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "x", label: "X / Twitter" },
  { value: "other", label: "Otro" },
];

const MIN_COMPETITORS = 3;

type CompetitorDraft = { name: string; handle: string; platform: string };

type FormState = {
  brandName: string;
  websiteUrl: string;
  niche: string;
  toneOfVoice: string;
  audienceDescription: string;
  activeSocialNetworks: string[];
  competitors: CompetitorDraft[];
};

const EMPTY_COMPETITOR: CompetitorDraft = { name: "", handle: "", platform: "instagram" };

type OnboardingProfileResponse = {
  brandName?: string;
  websiteUrl?: string;
  niche?: string;
  toneOfVoice?: string;
  audienceDescription?: string;
  activeSocialNetworks?: string[];
};

type OnboardingCompetitorResponse = { name?: string; handle?: string | null; platform?: string };

type OnboardingGetResponse = {
  ok: boolean;
  profile?: OnboardingProfileResponse;
  competitors?: OnboardingCompetitorResponse[];
  completed?: boolean;
  message?: string;
  error?: string;
};

type OnboardingPostResponse = {
  ok: boolean;
  message?: string;
  error?: string;
};

function buildInitialState(): FormState {
  return {
    brandName: "",
    websiteUrl: "",
    niche: "",
    toneOfVoice: "",
    audienceDescription: "",
    activeSocialNetworks: [],
    competitors: [{ ...EMPTY_COMPETITOR }, { ...EMPTY_COMPETITOR }, { ...EMPTY_COMPETITOR }],
  };
}

const STEPS = [
  { key: "brand", title: "Tu marca" },
  { key: "audience", title: "Tono y audiencia" },
  { key: "competitors", title: "Competidores" },
  { key: "review", title: "Confirmar" },
];

const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20";
const selectCls = "w-full rounded-xl border border-white/10 bg-[#0d0d1e] px-3 py-2 text-sm text-white/70 focus:border-violet-500/50 focus:outline-none";

export default function SocialFlowOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormState>(buildInitialState());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/socialflow/onboarding");
        const json = (await res.json().catch(() => null)) as OnboardingGetResponse | null;
        if (cancelled) return;
        if (json?.ok && json.completed) {
          router.replace("/socialflow");
          return;
        }
        if (json?.ok && json.profile) {
          const profile = json.profile;
          const competitors = Array.isArray(json.competitors) ? json.competitors : [];
          setData((prev) => ({
            ...prev,
            brandName: profile.brandName || prev.brandName,
            websiteUrl: profile.websiteUrl || prev.websiteUrl,
            niche: profile.niche || prev.niche,
            toneOfVoice: profile.toneOfVoice || prev.toneOfVoice,
            audienceDescription: profile.audienceDescription || prev.audienceDescription,
            activeSocialNetworks: profile.activeSocialNetworks?.length ? profile.activeSocialNetworks : prev.activeSocialNetworks,
            competitors: competitors.length
              ? competitors.map((c) => ({ name: c.name || "", handle: c.handle || "", platform: c.platform || "instagram" }))
              : prev.competitors,
          }));
        }
      } catch (err) {
        console.error("SOCIALFLOW_ONBOARDING_LOAD_ERROR", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [router]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function toggleNetwork(value: string) {
    setData((prev) => ({
      ...prev,
      activeSocialNetworks: prev.activeSocialNetworks.includes(value)
        ? prev.activeSocialNetworks.filter((item) => item !== value)
        : [...prev.activeSocialNetworks, value],
    }));
  }

  function updateCompetitor(index: number, patch: Partial<CompetitorDraft>) {
    setData((prev) => ({
      ...prev,
      competitors: prev.competitors.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }

  function addCompetitor() {
    setData((prev) => ({ ...prev, competitors: [...prev.competitors, { ...EMPTY_COMPETITOR }] }));
  }

  function removeCompetitor(index: number) {
    setData((prev) => ({ ...prev, competitors: prev.competitors.filter((_, i) => i !== index) }));
  }

  const filledCompetitors = useMemo(() => data.competitors.filter((c) => c.name.trim().length > 0), [data.competitors]);

  const stepValid = useMemo(() => {
    switch (STEPS[step].key) {
      case "brand": return data.brandName.trim().length > 0 && data.niche.trim().length > 0;
      case "audience": return true;
      case "competitors": return filledCompetitors.length >= MIN_COMPETITORS;
      default: return true;
    }
  }, [step, data.brandName, data.niche, filledCompetitors.length]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/socialflow/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: data.brandName,
          websiteUrl: data.websiteUrl,
          niche: data.niche,
          toneOfVoice: data.toneOfVoice,
          audienceDescription: data.audienceDescription,
          activeSocialNetworks: data.activeSocialNetworks,
          competitors: filledCompetitors,
        }),
      });
      const json = (await res.json().catch(() => null)) as OnboardingPostResponse | null;
      if (!res.ok || !json?.ok) throw new Error(json?.message || json?.error || "ONBOARDING_SAVE_FAILED");
      router.replace("/socialflow/audit");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el onboarding");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-white/45">Cargando onboarding...</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">SocialFlow Onboarding</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Configura tu marca en 2 minutos</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
          Con esta información, SocialFlow construye tu perfil de marca, audita tu presencia social y genera tu primer feed de inteligencia accionable.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, idx) => (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${idx <= step ? "bg-violet-500 text-white" : "bg-white/8 text-white/35"}`}>
              {idx + 1}
            </div>
            <span className={`text-xs font-semibold ${idx === step ? "text-white" : "text-white/35"}`}>{s.title}</span>
            {idx < STEPS.length - 1 && <div className="h-px flex-1 bg-white/10" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {/* Step: Brand */}
      {STEPS[step].key === "brand" && (
        <div className="rounded-2xl border border-white/10 bg-white/4 p-6">
          <div className="space-y-4">
            <StepField label="Nombre de marca" required>
              <input className={inputCls} value={data.brandName} onChange={(e) => update("brandName", e.target.value)} placeholder="Acme Studio" />
            </StepField>
            <StepField label="URL web">
              <input className={inputCls} value={data.websiteUrl} onChange={(e) => update("websiteUrl", e.target.value)} placeholder="https://tumarca.com" />
              <p className="mt-1 text-xs text-white/30">SocialFlow analiza tu web para extraer descripción, productos y palabras clave automáticamente.</p>
            </StepField>
            <StepField label="Nicho / sector" required>
              <input className={inputCls} value={data.niche} onChange={(e) => update("niche", e.target.value)} placeholder="Clínicas estéticas, moda sostenible, software B2B..." />
            </StepField>
          </div>
        </div>
      )}

      {/* Step: Audience */}
      {STEPS[step].key === "audience" && (
        <div className="rounded-2xl border border-white/10 bg-white/4 p-6">
          <div className="space-y-4">
            <StepField label="Tono de comunicación">
              <textarea className={inputCls + " min-h-[80px]"} value={data.toneOfVoice} onChange={(e) => update("toneOfVoice", e.target.value)} placeholder="Cercano y experto, directo, con humor sutil..." />
            </StepField>
            <StepField label="Público objetivo">
              <textarea className={inputCls + " min-h-[80px]"} value={data.audienceDescription} onChange={(e) => update("audienceDescription", e.target.value)} placeholder="Mujeres 25-45, interesadas en bienestar y estética, en ciudades grandes..." />
            </StepField>
            <StepField label="Redes sociales activas">
              <div className="flex flex-wrap gap-2">
                {SOCIAL_NETWORKS.map((network) => {
                  const active = data.activeSocialNetworks.includes(network.value);
                  return (
                    <button
                      key={network.value}
                      type="button"
                      onClick={() => toggleNetwork(network.value)}
                      className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                        active
                          ? "border-violet-500/50 bg-violet-500/15 text-violet-300"
                          : "border-white/10 text-white/45 hover:border-violet-500/30 hover:text-white/65"
                      }`}
                    >
                      {network.label}
                    </button>
                  );
                })}
              </div>
            </StepField>
          </div>
        </div>
      )}

      {/* Step: Competitors */}
      {STEPS[step].key === "competitors" && (
        <div className="rounded-2xl border border-white/10 bg-white/4 p-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-white/85">Competidores principales</p>
              <p className="text-xs text-white/40">Añade al menos {MIN_COMPETITORS} competidores para que el audit pueda comparar tu presencia.</p>
            </div>
            <div className="space-y-3">
              {data.competitors.map((competitor, idx) => (
                <div key={idx} className="grid gap-2 rounded-xl border border-white/8 bg-white/4 p-3 md:grid-cols-[2fr_1fr_1fr_auto]">
                  <input className={inputCls} value={competitor.name} onChange={(e) => updateCompetitor(idx, { name: e.target.value })} placeholder={`Competidor ${idx + 1}`} />
                  <input className={inputCls} value={competitor.handle} onChange={(e) => updateCompetitor(idx, { handle: e.target.value })} placeholder="@handle" />
                  <select className={selectCls} value={competitor.platform} onChange={(e) => updateCompetitor(idx, { platform: e.target.value })}>
                    {COMPETITOR_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeCompetitor(idx)}
                    className="rounded-xl border border-transparent px-3 py-2 text-xs font-semibold text-white/35 transition hover:border-red-500/30 hover:text-red-400"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addCompetitor}
              className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/55 transition hover:border-violet-500/30 hover:bg-violet-500/8 hover:text-violet-300"
            >
              + Añadir competidor
            </button>
          </div>
        </div>
      )}

      {/* Step: Review */}
      {STEPS[step].key === "review" && (
        <div className="rounded-2xl border border-violet-500/25 bg-violet-500/8 p-6">
          <div className="space-y-3 text-sm text-white/65">
            <p className="text-sm font-semibold text-white/90">Revisa tu perfil antes de continuar</p>
            <ReviewRow label="Marca" value={data.brandName} />
            <ReviewRow label="Web" value={data.websiteUrl || "-"} />
            <ReviewRow label="Nicho" value={data.niche} />
            <ReviewRow label="Tono" value={data.toneOfVoice || "-"} />
            <ReviewRow label="Audiencia" value={data.audienceDescription || "-"} />
            <ReviewRow label="Redes activas" value={data.activeSocialNetworks.length ? data.activeSocialNetworks.join(", ") : "-"} />
            <ReviewRow label="Competidores" value={filledCompetitors.map((c) => c.name).join(", ")} />
            <p className="pt-2 text-xs text-white/35">
              Al continuar, SocialFlow analizará tu web, guardará tu perfil de marca y generará tu primera auditoría social.
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold text-white/45 transition hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Atrás
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            disabled={!stepValid}
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Siguiente
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <span className="h-2 w-2 animate-pulse rounded-full bg-white" />}
            {submitting ? "Guardando..." : "Generar mi auditoría"}
          </button>
        )}
      </div>
    </div>
  );
}

function StepField(props: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/40">
        {props.label}
        {props.required && <span className="text-violet-400"> *</span>}
      </span>
      {props.children}
    </label>
  );
}

function ReviewRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/8 pb-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/35">{props.label}</span>
      <span className="max-w-[60%] text-right text-sm text-white/70">{props.value}</span>
    </div>
  );
}
