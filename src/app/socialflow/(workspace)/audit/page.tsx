"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";

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

const IMPACT_TONE: Record<AuditRecommendation["impact"], string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-50 text-slate-600 border-slate-200",
};

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600";
  if (score >= 40) return "text-amber-500";
  return "text-red-500";
}

function barColor(score: number): string {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 40) return "bg-amber-400";
  return "bg-red-400";
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
      setError(err instanceof Error ? err.message : "No se pudo cargar la auditoria");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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
      setError(err instanceof Error ? err.message : "No se pudo regenerar la auditoria");
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-slate-500">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
        Analizando tu presencia social con IA...
      </div>
    );
  }

  if (error && !audit) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        <Button onClick={() => void load()}>Reintentar</Button>
      </div>
    );
  }

  if (!audit) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">SocialFlow Audit</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Auditoria de presencia social</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{audit.summary}</p>
        </div>
        <Button variant="outline" size="sm" loading={regenerating} disabled={regenerating} onClick={() => void regenerate()}>
          {regenerating ? "Regenerando..." : "Regenerar auditoria"}
        </Button>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card tone="brand" className="p-6">
        <div className="flex flex-wrap items-center gap-8">
          <div className="text-center">
            <div className={`text-6xl font-black ${scoreColor(audit.score)}`}>{audit.score}</div>
            <div className="mt-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Score de presencia social</div>
          </div>
          <div className="flex-1 space-y-3 min-w-[260px]">
            {audit.areaScores.map((area) => (
              <div key={area.area}>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>{area.area}</span>
                  <span className={scoreColor(area.score)}>{area.score}</span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                  <div className={`h-2 rounded-full ${barColor(area.score)}`} style={{ width: `${area.score}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-400">{area.notes}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Fortalezas" tone="success" bodyClassName="space-y-2">
          {audit.strengths.map((item, idx) => (
            <p key={idx} className="text-sm leading-6 text-slate-700">
              {item}
            </p>
          ))}
        </Card>
        <Card title="Debilidades" tone="danger" bodyClassName="space-y-2">
          {audit.weaknesses.map((item, idx) => (
            <p key={idx} className="text-sm leading-6 text-slate-700">
              {item}
            </p>
          ))}
        </Card>
        <Card title="Oportunidades" tone="default" bodyClassName="space-y-2">
          {audit.opportunities.map((item, idx) => (
            <p key={idx} className="text-sm leading-6 text-slate-700">
              {item}
            </p>
          ))}
        </Card>
      </div>

      <Card title="Top recomendaciones" subtitle="Acciones priorizadas" tone="default">
        <div className="space-y-3">
          {audit.recommendations.map((rec, idx) => (
            <div key={idx} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border-2 border-sky-50 bg-sky-50/40 p-4">
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900">{rec.title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{rec.description}</p>
              </div>
              <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${IMPACT_TONE[rec.impact]}`}>
                {IMPACT_LABEL[rec.impact]}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {audit.competitorComparison.length > 0 && (
        <Card title="Comparativa con competidores" tone="default" bodyClassName="space-y-3">
          {audit.competitorComparison.map((item, idx) => (
            <div key={idx} className="rounded-2xl border-2 border-slate-100 p-4">
              <p className="text-sm font-bold text-slate-900">{item.competitor}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{item.comparison}</p>
            </div>
          ))}
        </Card>
      )}

      <div className="flex justify-end">
        <Link href="/socialflow">
          <Button variant="primary">Ir al dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
