"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuditLoadingGraph from "./AuditLoadingGraph";
import AuditScoreGauge from "./AuditScoreGauge";

type AuditAreaScore = { area: string; score: number; notes: string };
type AuditRecommendation = { title: string; description: string; impact: "high" | "medium" | "low"; how?: string[] };
type AuditCompetitorComparison = {
  competitor: string;
  comparison: string;
  followers?: number | null;
  engagementRate?: string | null;
  postingFrequency?: string | null;
  vsAccount?: { direction: "up" | "down" | "equal"; diff: string } | null;
};

type SocialAudit = {
  id: string;
  score: number;
  areaScores: AuditAreaScore[];
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  recommendations: AuditRecommendation[];
  competitorComparison: AuditCompetitorComparison[];
  summary: string;
  createdAt: string;
  updatedAt: string;
};

type AuditResponse = { ok: boolean; audit?: SocialAudit; message?: string; error?: string };

type TabId = "resumen" | "fortalezas" | "recomendaciones" | "competidores";

const TABS: { id: TabId; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "fortalezas", label: "Fortalezas y debilidades" },
  { id: "recomendaciones", label: "Recomendaciones" },
  { id: "competidores", label: "Competidores" },
];

const IMPACT_LABEL: Record<AuditRecommendation["impact"], string> = {
  high: "Alto impacto",
  medium: "Impacto medio",
  low: "Impacto bajo",
};

const IMPACT_CLS: Record<AuditRecommendation["impact"], string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-gray-100 text-gray-500 border-gray-200",
};

const IMPACT_ORDER: Record<AuditRecommendation["impact"], number> = { high: 0, medium: 1, low: 2 };

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600";
  if (score >= 40) return "text-amber-600";
  return "text-rose-600";
}

function barColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-400";
  return "bg-rose-400";
}

function pickArea(areas: AuditAreaScore[], keywords: string[]): AuditAreaScore | undefined {
  return areas.find((a) => keywords.some((k) => a.area.toLowerCase().includes(k)));
}

function recTitle(rec: AuditRecommendation): string {
  return rec.title.replace(/^(Falta|Detectado):\s*/i, "");
}

function recSteps(rec: AuditRecommendation): string[] {
  if (rec.how && rec.how.length > 0) return rec.how;
  const subject = recTitle(rec);
  return [
    `Revisa "${subject}" en tu perfil de SocialFlow.`,
    "Actualiza la información con datos reales y específicos de tu marca.",
    "Guarda los cambios y regenera la auditoría para confirmar la mejora.",
  ];
}

function vsAccountCls(direction: "up" | "down" | "equal"): string {
  if (direction === "up") return "text-emerald-600";
  if (direction === "down") return "text-rose-600";
  return "text-gray-500";
}

export default function SocialFlowAuditPage() {
  const [audit, setAudit] = useState<SocialAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("resumen");
  const [openRecs, setOpenRecs] = useState<Set<number>>(new Set());

  function toggleRec(idx: number) {
    setOpenRecs((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/socialflow/audit");
      const json = (await res.json().catch(() => null)) as AuditResponse | null;
      if (!res.ok || !json?.ok || !json.audit) {
        throw new Error(json?.message || json?.error || "AUDIT_LOAD_FAILED");
      }
      setAudit(json.audit);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la auditoría");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function regenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/socialflow/audit", { method: "POST" });
      const json = (await res.json().catch(() => null)) as AuditResponse | null;
      if (!res.ok || !json?.ok || !json.audit) {
        throw new Error(json?.message || json?.error || "AUDIT_REGENERATE_FAILED");
      }
      setAudit(json.audit);
      setActiveTab("resumen");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo regenerar la auditoría");
    } finally {
      setRegenerating(false);
    }
  }

  const heroAreas = useMemo(() => {
    if (!audit) return [];
    const identidad = pickArea(audit.areaScores, ["identidad"]);
    const audiencia = pickArea(audit.areaScores, ["audiencia"]);
    const presencia = pickArea(audit.areaScores, ["presencia"]);
    const picked = [identidad, audiencia, presencia].filter((a): a is AuditAreaScore => Boolean(a));
    return picked.length > 0 ? picked : audit.areaScores.slice(0, 3);
  }, [audit]);

  const sortedRecommendations = useMemo(() => {
    if (!audit) return [];
    return [...audit.recommendations].sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact]);
  }, [audit]);

  if (loading) {
    return <AuditLoadingGraph />;
  }

  if (error && !audit) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-[#3b82f6]/30 hover:bg-[#3b82f6]/5 hover:text-[#3b82f6]"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!audit) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#3b82f6]">Socialcors Audit</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">Auditoría de presencia social</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">{audit.summary}</p>
        </div>
        <button
          onClick={() => void regenerate()}
          disabled={regenerating}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-[#3b82f6]/30 hover:bg-[#3b82f6]/5 hover:text-[#3b82f6] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {regenerating && <span className="h-2 w-2 animate-pulse rounded-full bg-current" />}
          {regenerating ? "Regenerando..." : "Regenerar auditoría"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Tab nav */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`min-w-[140px] flex-1 rounded-lg px-4 py-2.5 text-xs font-black uppercase tracking-wide transition ${
              activeTab === tab.id
                ? "bg-[#3b82f6] text-white shadow-md shadow-[#3b82f6]/25"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Resumen */}
      {activeTab === "resumen" && (
        <div className="sf-fade-in space-y-6">
          <div className="rounded-2xl border border-[#3b82f6]/20 bg-[#3b82f6]/5 p-8">
            <AuditScoreGauge score={audit.score} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {heroAreas.map((area) => (
              <div key={area.area} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
                  <span>{area.area}</span>
                  <span className={scoreColor(area.score)}>{area.score}</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                  <div className={`h-2 rounded-full ${barColor(area.score)}`} style={{ width: `${area.score}%` }} />
                </div>
                <p className="mt-2 text-xs leading-5 text-gray-500">{area.notes}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Fortalezas y debilidades */}
      {activeTab === "fortalezas" && (
        <div className="sf-fade-in grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <h3 className="mb-3 text-sm font-black uppercase italic tracking-tight text-emerald-700">Fortalezas</h3>
            <div className="space-y-3">
              {audit.strengths.map((item, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-emerald-600">✓</span>
                  <p className="text-sm leading-6 text-gray-600">{item}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
            <h3 className="mb-3 text-sm font-black uppercase italic tracking-tight text-rose-700">Debilidades</h3>
            <div className="space-y-3">
              {audit.weaknesses.map((item, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-rose-600">✕</span>
                  <p className="text-sm leading-6 text-gray-600">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Recomendaciones */}
      {activeTab === "recomendaciones" && (
        <div className="sf-fade-in rounded-2xl border border-gray-200 bg-white shadow-sm">
          <header className="border-b border-gray-200 px-6 py-5">
            <h2 className="text-lg font-black uppercase italic tracking-tight text-gray-900">Recomendaciones priorizadas</h2>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Alto impacto primero</p>
          </header>
          <div className="space-y-3 px-6 py-5">
            {sortedRecommendations.map((rec, idx) => {
              const isOpen = openRecs.has(idx);
              return (
                <div key={idx} className="rounded-xl border border-gray-200 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => toggleRec(idx)}
                    className="flex w-full flex-wrap items-start justify-between gap-3 p-4 text-left"
                    aria-expanded={isOpen}
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>
                        ▸
                      </span>
                      <p className="text-sm font-bold text-gray-900">{rec.title}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${IMPACT_CLS[rec.impact]}`}>
                      {IMPACT_LABEL[rec.impact]}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="sf-fade-in space-y-3 border-t border-gray-200 px-4 py-4 pl-9">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#3b82f6]">Qué</p>
                        <p className="mt-1 text-sm leading-6 text-gray-600">{recTitle(rec)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#3b82f6]">Por qué</p>
                        <p className="mt-1 text-sm leading-6 text-gray-600">{rec.description}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#3b82f6]">Cómo</p>
                        <ol className="mt-1 space-y-1.5">
                          {recSteps(rec).map((step, stepIdx) => (
                            <li key={stepIdx} className="flex gap-2 text-sm leading-6 text-gray-600">
                              <span className="shrink-0 text-gray-400">{stepIdx + 1}.</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {sortedRecommendations.length === 0 && (
              <p className="text-sm text-gray-500">Sin recomendaciones por ahora.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab: Competidores */}
      {activeTab === "competidores" && (
        <div className="sf-fade-in rounded-2xl border border-gray-200 bg-white shadow-sm">
          <header className="border-b border-gray-200 px-6 py-5">
            <h2 className="text-lg font-black uppercase italic tracking-tight text-gray-900">Competidores detectados</h2>
          </header>
          <div className="space-y-3 px-6 py-5">
            {audit.competitorComparison.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                Aún no hay competidores con datos suficientes.
              </div>
            ) : (
              audit.competitorComparison.map((item, idx) => (
                <div key={idx} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-bold text-gray-900">{item.competitor}</p>
                  <p className="mt-1 text-sm leading-6 text-gray-600">{item.comparison}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Seguidores</p>
                      {item.followers ? (
                        <p className="mt-1 text-sm font-semibold text-gray-700">{item.followers.toLocaleString("es-ES")}</p>
                      ) : (
                        <p className="mt-1 text-sm text-gray-400">Sin datos aún</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Engagement rate</p>
                      {item.engagementRate ? (
                        <p className="mt-1 text-sm font-semibold text-gray-700">{item.engagementRate}</p>
                      ) : (
                        <p className="mt-1 text-sm text-gray-400">Sin datos aún</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Frecuencia de publicación</p>
                      {item.postingFrequency ? (
                        <p className="mt-1 text-sm font-semibold text-gray-700">{item.postingFrequency}</p>
                      ) : (
                        <p className="mt-1 text-sm text-gray-400">Sin datos aún</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Vs. tu cuenta</p>
                      {item.vsAccount ? (
                        <p className={`mt-1 text-sm font-semibold ${vsAccountCls(item.vsAccount.direction)}`}>
                          {item.vsAccount.direction === "up" ? "↑ " : item.vsAccount.direction === "down" ? "↓ " : "= "}
                          {item.vsAccount.diff}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-gray-400">Sin datos aún</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Link
          href="/socialflow"
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#3b82f6]/20 transition hover:brightness-110"
        >
          Ir al dashboard
        </Link>
      </div>
    </div>
  );
}
