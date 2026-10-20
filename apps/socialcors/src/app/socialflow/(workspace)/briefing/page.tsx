"use client";

import { useEffect, useState } from "react";
import type { BriefingResult } from "@/lib/socialflow/intelligence/WeeklyBriefingAgent";

type BriefingEntry = {
  id: string;
  sentAt: string;
  weekNumber: number;
  year: number;
  sentVia: string[];
  briefing: BriefingResult;
};

type State =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "ok"; briefings: BriefingEntry[] };

function relDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

function PostRow({ post }: { post: { caption: string; format: string; engagement: number; reach?: number | null } }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-700">{post.caption || "Sin caption"}</p>
        <p className="mt-0.5 text-[10px] text-slate-400 uppercase tracking-wide">{post.format}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-bold text-[#3b82f6]">{post.engagement.toLocaleString("es-ES")}</p>
        <p className="text-[10px] text-slate-400">eng.</p>
      </div>
    </div>
  );
}

function BriefingCard({ entry, open, onToggle }: { entry: BriefingEntry; open: boolean; onToggle: () => void }) {
  const { briefing } = entry;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header — siempre visible */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] shadow-sm shadow-[#3b82f6]/20">
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#3b82f6]">
              Semana {entry.weekNumber} · {entry.year}
            </p>
            <p className="text-sm font-bold text-slate-800">{briefing.period}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-slate-400 sm:block">{relDate(entry.sentAt)}</span>
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </button>

      {/* Cuerpo expandible */}
      {open && (
        <div className="border-t border-slate-100 px-6 py-5 space-y-5">
          {/* KPIs seguidores */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Seguidores</p>
              <p className="mt-1 text-xl font-black text-slate-800">
                {briefing.followerChange.current !== null
                  ? briefing.followerChange.current.toLocaleString("es-ES")
                  : "—"}
              </p>
              {briefing.followerChange.delta !== null && (
                <p className={`text-xs font-semibold ${briefing.followerChange.delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {briefing.followerChange.delta > 0 ? "+" : ""}{briefing.followerChange.delta.toLocaleString("es-ES")} esta semana
                </p>
              )}
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Posts</p>
              <p className="mt-1 text-xl font-black text-slate-800">
                {Object.values(briefing.contentMix).reduce((a, b) => a + b, 0)}
              </p>
              <p className="text-xs text-slate-400">publicados</p>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-xl border border-[#3b82f6]/20 bg-[#3b82f6]/5 p-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-wide text-[#3b82f6]">Engagement</p>
              <p className="mt-1 text-xl font-black text-[#3b82f6]">
                {briefing.topPerformingPosts.reduce((a, p) => a + p.engagement, 0).toLocaleString("es-ES")}
              </p>
              <p className="text-xs text-[#3b82f6]/70">total semana</p>
            </div>
          </div>

          {/* Alerta de fatiga */}
          {briefing.fatigueWarning && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="mt-0.5 text-amber-500">⚠</span>
              <p className="text-xs font-semibold text-amber-700">{briefing.fatigueWarning}</p>
            </div>
          )}

          {/* Top posts */}
          {briefing.topPerformingPosts.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                🏆 Mejores posts
              </p>
              <div className="space-y-1.5">
                {briefing.topPerformingPosts.slice(0, 3).map((p, i) => (
                  <PostRow key={i} post={p} />
                ))}
              </div>
            </div>
          )}

          {/* Recomendaciones */}
          {briefing.recommendations.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                💡 Recomendaciones
              </p>
              <ul className="space-y-1.5">
                {briefing.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] text-[9px] font-black text-white">
                      {i + 1}
                    </span>
                    <span className="text-xs text-slate-700 leading-relaxed">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tendencias de nicho */}
          {briefing.nicheTrends && (briefing.nicheTrends.hashtags.length > 0 || briefing.nicheTrends.hooks.length > 0) && (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                📈 Tendencias del nicho
              </p>
              {briefing.nicheTrends.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {briefing.nicheTrends.hashtags.slice(0, 6).map((h, i) => (
                    <span key={i} className="rounded-full border border-[#3b82f6]/25 bg-[#3b82f6]/8 px-2.5 py-0.5 text-[11px] font-semibold text-[#3b82f6]">
                      {h}
                    </span>
                  ))}
                </div>
              )}
              {briefing.nicheTrends.hooks.length > 0 && (
                <div className="space-y-1">
                  {briefing.nicheTrends.hooks.slice(0, 2).map((h, i) => (
                    <p key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600 italic">
                      &ldquo;{h}&rdquo;
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Foco siguiente semana */}
          {briefing.nextWeekFocus && (
            <div className="rounded-xl border border-[#06b6d4]/20 bg-[#06b6d4]/5 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#06b6d4] mb-1">
                Foco semana siguiente
              </p>
              <p className="text-xs text-slate-700 leading-relaxed">{briefing.nextWeekFocus}</p>
            </div>
          )}

          {/* Actividad de competidores */}
          {briefing.competitorActivity && (
            <div>
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                👀 Competidores
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">{briefing.competitorActivity}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SocialFlowBriefingPage() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/socialflow/briefings");
        if (!res.ok) { if (active) setState({ status: "error" }); return; }
        const data = (await res.json()) as { ok: boolean; briefings: BriefingEntry[] };
        if (!active) return;
        if (!data.ok || !data.briefings?.length) { setState({ status: "empty" }); return; }
        setState({ status: "ok", briefings: data.briefings });
        setOpenId(data.briefings[0]?.id ?? null);
      } catch {
        if (active) setState({ status: "error" });
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#3b82f6]">
          Socialcors · Briefing semanal
        </p>
        <h1 className="mt-1.5 text-2xl font-black tracking-tight text-gray-900">
          Briefing semanal
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-gray-500">
          Tu resumen semanal generado por el Cerebro: top posts, tendencias de nicho, actividad de competidores y recomendaciones de la semana.
        </p>
      </div>

      {state.status === "loading" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-400">Cargando briefings…</p>
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 shadow-sm">
          <p className="text-sm font-semibold text-rose-700">No se pudieron cargar los briefings.</p>
        </div>
      )}

      {state.status === "empty" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#06b6d4]">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-700">Aún no hay briefings</p>
          <p className="mt-1 text-xs text-slate-400">
            El Cerebro genera tu primer resumen semanal después de 7 días publicando. Vuelve la próxima semana.
          </p>
        </div>
      )}

      {state.status === "ok" && (
        <div className="space-y-3">
          {state.briefings.map((entry) => (
            <BriefingCard
              key={entry.id}
              entry={entry}
              open={openId === entry.id}
              onToggle={() => setOpenId((prev) => (prev === entry.id ? null : entry.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
