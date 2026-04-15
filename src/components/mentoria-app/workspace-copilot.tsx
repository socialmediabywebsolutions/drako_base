"use client";

import type { MentoriaWorkspaceEntry, DailyPlan, MentoriaStudentMemorySummary, MentoriaGuardianHookEvent, StudentProfile } from "@/lib/mentoria/types";

type WorkspaceCopilotProps = {
  entry: MentoriaWorkspaceEntry | null;
  dailyPlan: DailyPlan | null;
  memory: MentoriaStudentMemorySummary | null;
  guardianHooks: MentoriaGuardianHookEvent[];
  analysisNextActions: string[];
  motivationMessage: string | null;
  dynamicNextAction?: string | null;
  student?: StudentProfile | null;
  activeSubjectSlug?: string | null;
  tutorResult?: {
    topic?: string;
    reinforcementQuestion?: string;
    progressMessage?: string;
    recommendedNextStep?: string;
  } | null;
  onQuickAction: (action: { topic: string; prompt: string; subjectSlug?: string | null }) => void;
};

export function WorkspaceCopilot({
  entry,
  dailyPlan,
  memory,
  guardianHooks,
  analysisNextActions,
  motivationMessage,
  student,
  activeSubjectSlug,
  tutorResult,
  onQuickAction,
}: WorkspaceCopilotProps) {
  const hasNextActions = analysisNextActions.length > 0;
  const hasDailyPlan = dailyPlan && dailyPlan.tasks.length > 0;
  const hasMemory = memory && (memory.watchouts.length > 0 || memory.commonMistakes.length > 0);
  const hasHooks = guardianHooks.length > 0;
  const stageLabel = student?.learningStage === "primary" ? "Primaria" : student?.learningStage === "bachillerato" ? "Bachillerato" : student?.learningStage === "eso" ? "ESO" : null;

  return (
    <div className="flex h-full flex-col bg-slate-50/60">
      <header className="border-b border-slate-200/80 p-5">
        <h2 className="text-base font-semibold text-slate-800">Apoyo lateral</h2>
        <p className="text-xs text-slate-500">Contexto breve para acompañar la sesión central</p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {(stageLabel || activeSubjectSlug || tutorResult?.topic) && (
          <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-700">
              Sesión actual
            </div>
            <div className="space-y-1 text-sm text-slate-700">
              {tutorResult?.topic ? <div><span className="font-semibold text-slate-900">Tema:</span> {tutorResult.topic}</div> : null}
              {activeSubjectSlug ? <div><span className="font-semibold text-slate-900">Materia:</span> {activeSubjectSlug}</div> : null}
              {stageLabel ? <div><span className="font-semibold text-slate-900">Nivel:</span> {stageLabel}</div> : null}
            </div>
          </div>
        )}

        {motivationMessage && (
          <div className="rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50/80 to-pink-50/80 p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-purple-700">
              Motivación
            </div>
            <div className="text-sm leading-relaxed text-slate-900">{motivationMessage}</div>
          </div>
        )}

        {hasNextActions && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/75 p-4">
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

        {(tutorResult?.progressMessage || tutorResult?.reinforcementQuestion || tutorResult?.recommendedNextStep) && (
          <div className="rounded-xl border border-slate-200 bg-white/85 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-700">
              Refuerzo de la sesión
            </div>
            <div className="space-y-3 text-sm text-slate-700">
              {tutorResult?.progressMessage ? <div>{tutorResult.progressMessage}</div> : null}
              {tutorResult?.reinforcementQuestion ? <div className="rounded-lg bg-slate-50 px-3 py-2"><span className="font-semibold text-slate-900">Pregunta:</span> {tutorResult.reinforcementQuestion}</div> : null}
              {tutorResult?.recommendedNextStep ? <div className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-900"><span className="font-semibold">Siguiente acción:</span> {tutorResult.recommendedNextStep}</div> : null}
            </div>
          </div>
        )}

        {entry && entry.quickActions.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white/85 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-700">
              Atajos de apoyo
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
                  className="w-full rounded-lg bg-slate-50/90 px-3 py-2 text-left text-xs hover:bg-slate-100"
                >
                  <div className="font-semibold text-slate-900">{action.label}</div>
                  <div className="text-slate-600">{action.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {hasDailyPlan && (
          <div className="rounded-xl border border-slate-200 bg-white/85 p-4">
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
          <div className="rounded-xl border border-slate-200 bg-white/85 p-4">
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
          <div className="rounded-xl border border-slate-200 bg-white/85 p-4">
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
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-6 text-center">
            <div className="mb-2 text-2xl">🤖</div>
            <div className="text-xs text-slate-500">
              Este panel solo aparece para reforzar la sesión cuando haga falta
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
