"use client";

import { useEffect, useState } from "react";
import { CheckCircle, ChevronRight, BookOpen, Zap, HelpCircle, ArrowRight, Trophy } from "lucide-react";
import type { SessionSummary, SessionSummaryPoint } from "@/lib/mentoria/session-summary";

type SessionSummaryCardProps = {
  summary: SessionSummary;
  onContinue?: () => void;
  onClose?: () => void;
};

const POINT_ICONS: Record<SessionSummaryPoint["type"], React.ElementType> = {
  learned: BookOpen,
  practiced: Zap,
  clarified: HelpCircle,
  next_step: ArrowRight,
  achievement: Trophy,
};

const POINT_COLORS: Record<SessionSummaryPoint["type"], string> = {
  learned: "bg-emerald-50 text-emerald-700 border-emerald-100",
  practiced: "bg-blue-50 text-blue-700 border-blue-100",
  clarified: "bg-amber-50 text-amber-700 border-amber-100",
  next_step: "bg-slate-50 text-slate-700 border-slate-200",
  achievement: "bg-violet-50 text-violet-700 border-violet-100",
};

const TONE_CONFIG = {
  positive: {
    bg: "bg-emerald-500",
    emoji: "🎉",
    label: "¡Sesión excelente!",
  },
  neutral: {
    bg: "bg-blue-500",
    emoji: "✅",
    label: "Sesión completada",
  },
  needs_encouragement: {
    bg: "bg-amber-500",
    emoji: "💪",
    label: "Sigue adelante",
  },
};

export function SessionSummaryCard({ summary, onContinue, onClose }: SessionSummaryCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const tone = TONE_CONFIG[summary.closingTone];
  const mainPoints = summary.points.filter((p) => p.type !== "next_step");
  const nextStep = summary.points.find((p) => p.type === "next_step");

  return (
    <div
      className={`transition-all duration-500 ${visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
    >
      {/* Cabecera */}
      <div className={`${tone.bg} rounded-t-3xl px-6 py-5 text-white`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl" role="img" aria-label={tone.label}>{tone.emoji}</span>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider opacity-80">{tone.label}</div>
            <h2 className="mt-0.5 text-lg font-bold leading-snug">{summary.headline}</h2>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-sm opacity-80">
          <span>{summary.subjectName}</span>
          <span>·</span>
          <span>{summary.durationMinutes} min</span>
        </div>
      </div>

      {/* Puntos clave */}
      <div className="bg-white px-6 py-5">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Lo que trabajaste hoy
        </div>
        <div className="space-y-2">
          {mainPoints.map((point, i) => {
            const Icon = POINT_ICONS[point.type];
            const colorClass = POINT_COLORS[point.type];
            return (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${colorClass}`}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="font-medium">{point.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Siguiente paso */}
      {nextStep && (
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200">
              <ArrowRight className="h-4 w-4 text-slate-600" aria-hidden="true" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">Próxima sesión</div>
              <div className="font-semibold text-slate-800">{nextStep.text.replace("Próxima sesión: ", "")}</div>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje de cierre */}
      <div className="border-t border-slate-100 bg-white px-6 py-4">
        <p className="text-sm leading-relaxed text-slate-600">{summary.closingMessage}</p>
      </div>

      {/* Acciones */}
      <div className="flex gap-3 rounded-b-3xl bg-white px-6 pb-6 pt-2">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cerrar
          </button>
        )}
        {onContinue && (
          <button
            type="button"
            onClick={onContinue}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            Continuar
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

// Modal wrapper para mostrar el resumen sobre la pantalla actual
export function SessionSummaryModal({
  summary,
  onDismiss,
}: {
  summary: SessionSummary | null;
  onDismiss: () => void;
}) {
  if (!summary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-3xl shadow-2xl">
        <SessionSummaryCard
          summary={summary}
          onClose={onDismiss}
          onContinue={onDismiss}
        />
      </div>
    </div>
  );
}
