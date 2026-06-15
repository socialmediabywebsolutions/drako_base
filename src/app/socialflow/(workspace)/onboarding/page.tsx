"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";

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
              ? competitors.map((c) => ({
                  name: c.name || "",
                  handle: c.handle || "",
                  platform: c.platform || "instagram",
                }))
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
    return () => {
      cancelled = true;
    };
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
      case "brand":
        return data.brandName.trim().length > 0 && data.niche.trim().length > 0;
      case "audience":
        return true;
      case "competitors":
        return filledCompetitors.length >= MIN_COMPETITORS;
      default:
        return true;
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
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || json?.error || "ONBOARDING_SAVE_FAILED");
      }
      router.replace("/socialflow/audit");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el onboarding");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">Cargando onboarding...</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">SocialFlow Onboarding</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Configura tu marca en 2 minutos</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Con esta informacion, SocialFlow construye tu perfil de marca, audita tu presencia social y genera tu primer feed de
          inteligencia accionable.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {STEPS.map((s, idx) => (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                idx <= step ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-400"
              }`}
            >
              {idx + 1}
            </div>
            <span className={`text-xs font-semibold ${idx === step ? "text-slate-950" : "text-slate-400"}`}>{s.title}</span>
            {idx < STEPS.length - 1 && <div className="h-px flex-1 bg-slate-200" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {STEPS[step].key === "brand" && (
        <Card tone="default" className="p-6">
          <div className="space-y-4">
            <Field label="Nombre de marca" required>
              <input
                className="w-full rounded-xl border-2 border-sky-100 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                value={data.brandName}
                onChange={(e) => update("brandName", e.target.value)}
                placeholder="Acme Studio"
              />
            </Field>
            <Field label="URL web">
              <input
                className="w-full rounded-xl border-2 border-sky-100 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                value={data.websiteUrl}
                onChange={(e) => update("websiteUrl", e.target.value)}
                placeholder="https://tumarca.com"
              />
              <p className="mt-1 text-xs text-slate-400">
                SocialFlow analiza tu web para extraer descripcion, productos y palabras clave automaticamente.
              </p>
            </Field>
            <Field label="Nicho / sector" required>
              <input
                className="w-full rounded-xl border-2 border-sky-100 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                value={data.niche}
                onChange={(e) => update("niche", e.target.value)}
                placeholder="Clinicas esteticas, moda sostenible, software B2B..."
              />
            </Field>
          </div>
        </Card>
      )}

      {STEPS[step].key === "audience" && (
        <Card tone="default" className="p-6">
          <div className="space-y-4">
            <Field label="Tono de comunicacion">
              <textarea
                className="min-h-[80px] w-full rounded-xl border-2 border-sky-100 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                value={data.toneOfVoice}
                onChange={(e) => update("toneOfVoice", e.target.value)}
                placeholder="Cercano y experto, directo, con humor sutil..."
              />
            </Field>
            <Field label="Publico objetivo">
              <textarea
                className="min-h-[80px] w-full rounded-xl border-2 border-sky-100 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                value={data.audienceDescription}
                onChange={(e) => update("audienceDescription", e.target.value)}
                placeholder="Mujeres 25-45, interesadas en bienestar y estetica, en ciudades grandes..."
              />
            </Field>
            <Field label="Redes sociales activas">
              <div className="flex flex-wrap gap-2">
                {SOCIAL_NETWORKS.map((network) => {
                  const active = data.activeSocialNetworks.includes(network.value);
                  return (
                    <button
                      key={network.value}
                      type="button"
                      onClick={() => toggleNetwork(network.value)}
                      className={`rounded-full border-2 px-4 py-1.5 text-xs font-semibold transition ${
                        active ? "border-sky-400 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-500 hover:border-sky-200"
                      }`}
                    >
                      {network.label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        </Card>
      )}

      {STEPS[step].key === "competitors" && (
        <Card tone="default" className="p-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Competidores principales</p>
              <p className="text-xs text-slate-500">Anade al menos {MIN_COMPETITORS} competidores para que el audit pueda comparar tu presencia.</p>
            </div>
            <div className="space-y-3">
              {data.competitors.map((competitor, idx) => (
                <div key={idx} className="grid gap-2 rounded-2xl border-2 border-sky-50 bg-sky-50/40 p-3 md:grid-cols-[2fr_1fr_1fr_auto]">
                  <input
                    className="rounded-xl border-2 border-sky-100 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                    value={competitor.name}
                    onChange={(e) => updateCompetitor(idx, { name: e.target.value })}
                    placeholder={`Competidor ${idx + 1}`}
                  />
                  <input
                    className="rounded-xl border-2 border-sky-100 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                    value={competitor.handle}
                    onChange={(e) => updateCompetitor(idx, { handle: e.target.value })}
                    placeholder="@handle"
                  />
                  <select
                    className="rounded-xl border-2 border-sky-100 px-3 py-2 text-sm focus:border-sky-400 focus:outline-none"
                    value={competitor.platform}
                    onChange={(e) => updateCompetitor(idx, { platform: e.target.value })}
                  >
                    {COMPETITOR_PLATFORMS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeCompetitor(idx)}
                    className="rounded-xl border-2 border-transparent px-3 py-2 text-xs font-semibold text-slate-400 hover:border-red-200 hover:text-red-600"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addCompetitor}>
              + Anadir competidor
            </Button>
          </div>
        </Card>
      )}

      {STEPS[step].key === "review" && (
        <Card tone="brand" className="p-6">
          <div className="space-y-3 text-sm text-slate-700">
            <p className="text-sm font-semibold text-slate-900">Revisa tu perfil antes de continuar</p>
            <ReviewRow label="Marca" value={data.brandName} />
            <ReviewRow label="Web" value={data.websiteUrl || "-"} />
            <ReviewRow label="Nicho" value={data.niche} />
            <ReviewRow label="Tono" value={data.toneOfVoice || "-"} />
            <ReviewRow label="Audiencia" value={data.audienceDescription || "-"} />
            <ReviewRow label="Redes activas" value={data.activeSocialNetworks.length ? data.activeSocialNetworks.join(", ") : "-"} />
            <ReviewRow label="Competidores" value={filledCompetitors.map((c) => c.name).join(", ")} />
            <p className="pt-2 text-xs text-slate-500">
              Al continuar, SocialFlow analizara tu web, guardara tu perfil de marca y generara tu primera auditoria social.
            </p>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          Atras
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" disabled={!stepValid} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
            Siguiente
          </Button>
        ) : (
          <Button type="button" loading={submitting} disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Guardando..." : "Generar mi auditoria"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Field(props: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {props.label}
        {props.required && <span className="text-sky-500"> *</span>}
      </span>
      {props.children}
    </label>
  );
}

function ReviewRow(props: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-sky-100 pb-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{props.label}</span>
      <span className="max-w-[60%] text-right text-sm text-slate-800">{props.value}</span>
    </div>
  );
}
