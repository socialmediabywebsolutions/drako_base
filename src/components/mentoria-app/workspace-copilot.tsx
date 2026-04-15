"use client";

import type { MentoriaWorkspaceEntry, DailyPlan, MentoriaStudentMemorySummary, MentoriaGuardianHookEvent } from "@/lib/mentoria/types";

type WorkspaceCopilotProps = {
  entry: MentoriaWorkspaceEntry | null;
  dailyPlan: DailyPlan | null;
  memory: MentoriaStudentMemorySummary | null;
  guardianHooks: MentoriaGuardianHookEvent[];
  analysisNextActions: string[];
  motivationMessage: string | null;
  onQuickAction: (action: { topic: string; prompt: string; subjectSlug?: string | null }) => void;
};

export function WorkspaceCopilot({
  entry,
  dailyPlan,
  memory,
  guardianHooks,
  analysisNextActions,
  motivationMessage,
  onQuickAction,
}: WorkspaceCopilotProps) {
  const hasNextActions = analysisNextActions.length > 0;
  const hasDailyPlan = dailyPlan && dailyPlan.tasks.length > 0;
  const hasMemory = memory && (memory.watchouts.length > 0 || memory.commonMistakes.length > 0);
  const hasHooks = guardianHooks.length > 0;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 p-6">
        <h2 className="text-lg font-bold text-slate-900">Copiloto IA</h2>
        <p className="text-xs text-slate-600">Guía y contexto personalizado</p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {motivationMessage && (
          <div className="rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-700">
              Motivación
            </div>
            <div className="text-sm leading-relaxed text-slate-900">{motivationMessage}</div>
          </div>
        )}

        {hasNextActions && (
          <div className="rounded-xl bg-emerald-50 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Siguiente paso
            </div>
            <div className="space-y-2 text-sm text-slate-900">
              {analysisNextActions.map((action, idx) => (
                <div key={idx} className="text-slate-700">• {action}</div>
              ))}
            </div>
          </div>
        )}

        {entry && entry.quickActions.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-700">
              Acciones rápidas
            </div>
            <div className="space-y-2">
              {entry.quickActions.slice(0, 3).map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() =>
                    onQuickAction({
                      topic: action.topic,
                      prompt: action.prompt,
                      subjectSlug: action.subjectSlug,
                    })
                  }
                  className="w-full rounded-lg bg-slate-50 px-3 py-2 text-left text-xs hover:bg-emerald-50"
                >
                  <div className="font-semibold text-slate-900">{action.label}</div>
                  <div className="text-slate-600">{action.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {hasDailyPlan && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-700">
              Plan del día
            </div>
            <div className="mb-2 text-sm text-slate-600">
              {dailyPlan.completedTaskIds.length} de {dailyPlan.tasks.length} completadas
            </div>
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${dailyPlan.completionRate}%` }}
              />
            </div>
            <div className="space-y-2">
              {dailyPlan.tasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className={`rounded-lg px-3 py-2 text-xs ${
                    task.completed ? "bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{task.completed ? "✓" : "○"}</span>
                    <span className="flex-1 font-medium">{task.subject}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasMemory && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-700">
              Memoria del alumno
            </div>
            {memory.watchouts.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-xs font-semibold text-amber-700">Vigilar</div>
                <div className="text-xs text-slate-700">{memory.watchouts.slice(0, 2).join(", ")}</div>
              </div>
            )}
            {memory.commonMistakes.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-semibold text-rose-700">Errores comunes</div>
                <div className="text-xs text-slate-700">{memory.commonMistakes.slice(0, 2).join(", ")}</div>
              </div>
            )}
          </div>
        )}

        {hasHooks && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-700">
              Eventos destacados
            </div>
            <div className="space-y-2">
              {guardianHooks.slice(0, 2).map((hook) => (
                <div key={hook.id} className="rounded-lg bg-slate-50 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-900">{hook.title}</div>
                    <div className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                      {hook.category}
                    </div>
                  </div>
                  <div className="text-xs text-slate-600">{hook.summary}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!hasNextActions && !hasDailyPlan && !hasMemory && !hasHooks && !motivationMessage && (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
            <div className="mb-2 text-2xl">🤖</div>
            <div className="text-xs text-slate-500">
              El copiloto se activará cuando tengas actividad
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
