"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AuditAreaScore = { area: string; score: number; notes: string };
type AuditRecommendation = { title: string; description: string; impact: "high" | "medium" | "low" };
type AuditCompetitorComparison = { competitor: string; comparison: string };

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

const IMPACT_LABEL: Record<AuditRecommendation["impact"], string> = {
  high: "Alto impacto",
  medium: "Impacto medio",
  low: "Impacto bajo",
};

const IMPACT_CLS: Record<AuditRecommendation["impact"], string> = {
  high: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  low: "bg-white/8 text-white/45 border-white/10",
};

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-rose-400";
}

function barColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-400";
  return "bg-rose-400";
}

export default function SocialFlowAuditPage() {
  const [audit, setAudit] = useState<SocialAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo regenerar la auditoría");
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-white/45">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-violet-500" />
        Analizando tu presencia social con IA...
      </div>
    );
  }

  if (error && !audit) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300">{error}</div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-violet-500/30 hover:bg-violet-500/8 hover:text-violet-300"
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
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">Socialcors Audit</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Auditoría de presencia social</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">{audit.summary}</p>
        </div>
        <button
          onClick={() => void regenerate()}
          disabled={regenerating}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/65 transition hover:border-violet-500/30 hover:bg-violet-500/8 hover:text-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {regenerating && <span className="h-2 w-2 animate-pulse rounded-full bg-current" />}
          {regenerating ? "Regenerando..." : "Regenerar auditoría"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      {/* Score panel */}
      <div className="rounded-2xl border border-violet-500/25 bg-violet-500/8 p-6">
        <div className="flex flex-wrap items-center gap-8">
          <div className="text-center">
            <div className={`text-6xl font-black ${scoreColor(audit.score)}`}>{audit.score}</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-white/35">Score de presencia social</div>
          </div>
          <div className="min-w-[260px] flex-1 space-y-3">
            {audit.areaScores.map((area) => (
              <div key={area.area}>
                <div className="flex items-center justify-between text-xs font-semibold text-white/65">
                  <span>{area.area}</span>
                  <span className={scoreColor(area.score)}>{area.score}</span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-white/8">
                  <div className={`h-2 rounded-full ${barColor(area.score)}`} style={{ width: `${area.score}%` }} />
                </div>
                <p className="mt-1 text-xs text-white/30">{area.notes}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Strengths / Weaknesses / Opportunities */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/6 p-5">
          <h3 className="mb-3 text-sm font-black uppercase italic tracking-tight text-emerald-300">Fortalezas</h3>
          <div className="space-y-2">
            {audit.strengths.map((item, idx) => (
              <p key={idx} className="text-sm leading-6 text-white/65">{item}</p>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/6 p-5">
          <h3 className="mb-3 text-sm font-black uppercase italic tracking-tight text-rose-300">Debilidades</h3>
          <div className="space-y-2">
            {audit.weaknesses.map((item, idx) => (
              <p key={idx} className="text-sm leading-6 text-white/65">{item}</p>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/4 p-5">
          <h3 className="mb-3 text-sm font-black uppercase italic tracking-tight text-white/80">Oportunidades</h3>
          <div className="space-y-2">
            {audit.opportunities.map((item, idx) => (
              <p key={idx} className="text-sm leading-6 text-white/65">{item}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="rounded-2xl border border-white/10 bg-white/4">
        <header className="border-b border-white/8 px-6 py-5">
          <h2 className="text-lg font-black uppercase italic tracking-tight text-white">Top recomendaciones</h2>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Acciones priorizadas</p>
        </header>
        <div className="space-y-3 px-6 py-5">
          {audit.recommendations.map((rec, idx) => (
            <div key={idx} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/4 p-4">
              <div className="flex-1">
                <p className="text-sm font-bold text-white/90">{rec.title}</p>
                <p className="mt-1 text-sm leading-6 text-white/55">{rec.description}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${IMPACT_CLS[rec.impact]}`}>
                {IMPACT_LABEL[rec.impact]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Competitor comparison */}
      {audit.competitorComparison.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/4">
          <header className="border-b border-white/8 px-6 py-5">
            <h2 className="text-lg font-black uppercase italic tracking-tight text-white">Comparativa con competidores</h2>
          </header>
          <div className="space-y-3 px-6 py-5">
            {audit.competitorComparison.map((item, idx) => (
              <div key={idx} className="rounded-xl border border-white/8 bg-white/4 p-4">
                <p className="text-sm font-bold text-white/90">{item.competitor}</p>
                <p className="mt-1 text-sm leading-6 text-white/55">{item.comparison}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Link
          href="/socialflow"
          className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
        >
          Ir al dashboard
        </Link>
      </div>
    </div>
  );
}
