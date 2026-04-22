"use client";

import { useMemo } from "react";
import type { ChangeEvent } from "react";
import type {
  StudentProfile,
  LearningSession,
  MentoriaExercise,
  DailyPlan,
  DailyPlanTask,
  MentoriaDailyClosureSummary,
  FocusSession,
  MentoriaGrowthSummary,
  MentoriaSessionContract,
  MentoriaSessionMode,
  MentoriaSessionModeOption,
  MentoriaWorkspaceEntry,
  MentoriaProgress,
  MentoriaStudentMemorySummary,
  MentoriaStudentSubject,
  MentoriaGuardianHookEvent,
} from "@/lib/mentoria/types";
import type { GuardianViewModel, StateActions, StateDecision } from "@/lib/mentoria/state/state-types";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type { WorkspaceOrchestratorPlan } from "@/lib/mentoria/workspace-orchestrator";

type WorkspaceBoardProps = {
  activeSection: string;
  student: StudentProfile | null;
  studentSubjects?: MentoriaStudentSubject[];
  progress?: MentoriaProgress[];
  dailyPlan?: DailyPlan | null;
  focusSessions?: FocusSession[];
  entry?: MentoriaWorkspaceEntry | null;
  evolution?: StudentEvolutionProfile | null;
  growth?: MentoriaGrowthSummary | null;
  dailyClosure?: MentoriaDailyClosureSummary | null;
  latestSession?: LearningSession | null;
  recentSessions?: LearningSession[];
  latestExercise?: MentoriaExercise | null;
  exercises?: MentoriaExercise[];
  activeDailyTask?: DailyPlanTask | null;
  memory?: MentoriaStudentMemorySummary | null;
  analysis?: { weakSubjects: string[]; strongSubjects: string[]; nextActions: string[] } | null;
  guardianHooks?: MentoriaGuardianHookEvent[];
  motivationMessage?: string | null;
  stateDecision?: StateDecision | null;
  stateActions?: StateActions | null;
  guardianViewModel?: GuardianViewModel | null;
  activeSubjectSlug?: string | null;
  selectedSubject?: MentoriaStudentSubject | null;
  currentTopic?: string;
  currentMessage?: string;
  sessionContract: MentoriaSessionContract;
  sessionModeOptions?: MentoriaSessionModeOption[];
  tutorResult: {
    reply: string;
    explanation: string;
    suggestedSteps: string[];
    reinforcementQuestion: string;
    subjectName?: string;
    subjectSlug?: string;
    topic?: string;
    progressMessage?: string;
    completionMessage?: string;
    encouragement?: string;
    nextSteps?: string[];
    recommendedNextStep?: string;
  } | null;
  nextAction?: {
    kind: "guided_step" | "exercise" | "task" | "resume_session" | "subject_session" | "quick_action" | "focus_session";
    title: string;
    detail: string;
    ctaLabel: string;
    sessionState?: "idle" | "answering" | "checking" | "retry" | "completed";
  } | null;
  orchestratorPlan?: WorkspaceOrchestratorPlan | null;
  sessionState?: "idle" | "answering" | "checking" | "retry" | "completed";
  activeGuidedStep?: string | null;
  activeStepIndex?: number;
  totalSteps?: number;
  sessionProgressPercent?: number;
  guidedStepInput?: string;
  guidedFeedback?: { status: "correct" | "almost" | "incorrect"; level: "short" | "superficial" | "explained" | "incorrect"; tone: "guided" | "direct" | "paced"; message: string; rationale: string } | null;
  exerciseAnswer: string;
  sessionStatusMessage?: string | null;
  onGuidedStepInputChange: (answer: string) => void;
  onSubmitGuidedStep: () => void;
  onSubmitExercise: () => void;
  onExerciseAnswerChange: (answer: string) => void;
  onStartDailyTask: (task: DailyPlanTask) => void;
  onStartFocusSession?: () => void;
  onStartSubjectSession: (subject: MentoriaStudentSubject | MentoriaProgress) => void;
  onOpenExercise: (exerciseId: string) => void;
  onSectionChange?: (section: string) => void;
  onResumeSession: (session: LearningSession) => void;
  onResumeDailyClosure?: (closure: MentoriaDailyClosureSummary) => void;
  onQuickAction: (action: { topic: string; prompt: string; subjectSlug?: string | null; sessionMode?: MentoriaSessionMode; sessionInputKind?: MentoriaSessionModeOption["inputKind"] }) => void;
  onSelectSessionMode?: (option: MentoriaSessionModeOption) => void;
  onRunNextAction?: () => void;
};

function formatBoardTaskType(type?: string | null) {
  if (type === "practice") return "practica guiada";
  if (type === "review") return "repaso guiado";
  if (type === "challenge") return "reto corto";
  return type ?? "tarea";
}

export function WorkspaceBoard({
  activeSection,
  student,
  studentSubjects = [],
  progress = [],
  dailyPlan = null,
  focusSessions = [],
  entry = null,
  evolution = null,
  growth = null,
  dailyClosure = null,
  latestSession = null,
  recentSessions = [],
  latestExercise = null,
  exercises = [],
  activeDailyTask = null,
  memory = null,
  analysis = null,
  guardianHooks = [],
  motivationMessage = null,
  stateDecision = null,
  stateActions = null,
  guardianViewModel = null,
  activeSubjectSlug = null,
  selectedSubject = null,
  currentTopic = "",
  currentMessage = "",
  sessionContract,
  sessionModeOptions = [],
  tutorResult,
  nextAction = null,
  orchestratorPlan = null,
  sessionState = "idle",
  activeGuidedStep = null,
  activeStepIndex = 0,
  totalSteps = 0,
  sessionProgressPercent = 0,
  guidedStepInput = "",
  guidedFeedback = null,
  exerciseAnswer,
  sessionStatusMessage,
  onGuidedStepInputChange,
  onSubmitGuidedStep,
  onSubmitExercise,
  onExerciseAnswerChange,
  onStartDailyTask,
  onStartFocusSession,
  onStartSubjectSession,
  onOpenExercise,
  onSectionChange,
  onResumeSession,
  onResumeDailyClosure,
  onQuickAction,
  onSelectSessionMode,
  onRunNextAction,
}: WorkspaceBoardProps) {
  const feedbackToneMap = {
    correct: "border-emerald-200 bg-emerald-50 text-emerald-900",
    almost: "border-amber-200 bg-amber-50 text-amber-900",
    incorrect: "border-rose-200 bg-rose-50 text-rose-900",
  } as const;
  const guidedStateUi = {
    idle: {
      copy: "Qué hacer ahora: escribe una respuesta corta con la idea principal.",
      next: "Después la comprobamos y vemos si puedes avanzar.",
      accent: "border-slate-200 bg-white text-slate-900",
    },
    answering: {
      copy: "Qué hacer ahora: termina tu respuesta con una idea más concreta.",
      next: "Después la comprobamos y pasas al siguiente paso si está clara.",
      accent: "border-sky-200 bg-sky-50 text-sky-900",
    },
    checking: {
      copy: "Qué hacer ahora: espera un momento mientras revisamos tu respuesta.",
      next: "Enseguida sabrás si avanzas o si toca ajustar.",
      accent: "border-violet-200 bg-violet-50 text-violet-900",
    },
    retry: {
      copy: "Qué hacer ahora: reescribe este paso usando la explicación recibida.",
      next: "Después vuelve a comprobar sin cambiar de bloque.",
      accent: "border-rose-200 bg-rose-50 text-rose-900",
    },
    completed: {
      copy: "Qué hacer ahora: revisa el cierre. Este bloque principal ya está hecho.",
      next: "Después podrás pasar al siguiente bloque cuando toque.",
      accent: "border-emerald-200 bg-emerald-50 text-emerald-900",
    },
  } as const;
  const resolvedGuidedState = guidedStateUi[sessionState];
  const adaptiveGuidance = guidedFeedback?.level === "short"
    ? "Qué hacer ahora: añade una idea más para completar tu respuesta."
    : guidedFeedback?.level === "superficial"
      ? "Qué hacer ahora: añade justo la parte clave que falta."
      : guidedFeedback?.tone === "paced"
        ? "Qué hacer ahora: mantén el ritmo y comprueba."
        : resolvedGuidedState.copy;
  const adaptiveNext = guidedFeedback?.level === "short"
    ? "Después la comprobamos otra vez sobre este mismo paso."
    : guidedFeedback?.level === "superficial"
      ? "Después vemos si ya está lo bastante claro para avanzar."
      : resolvedGuidedState.next;
  const progressBySubjectId = new Map(progress.map((item) => [item.subjectId, item]));
  const pendingExerciseCount = exercises.filter((exercise) => exercise.status === "pending").length;
  const boardMode = stateActions?.boardMode ?? "normal";
  const activeSubject = useMemo(() => {
    const byActiveSlug = studentSubjects.find((item) => item.subject?.slug === activeSubjectSlug) ?? null;
    if (byActiveSlug?.subject) return byActiveSlug.subject;
    if (selectedSubject?.subject) return selectedSubject.subject;
    const resultSubjectSlug = tutorResult?.subjectSlug ?? latestSession?.subjectId ?? activeDailyTask?.subjectId ?? null;
    const bySlug = studentSubjects.find((item) => item.subject?.slug === tutorResult?.subjectSlug) ?? null;
    if (bySlug) return bySlug.subject ?? null;
    const byTaskSubject = studentSubjects.find((item) => item.subjectId === activeDailyTask?.subjectId) ?? null;
    if (byTaskSubject?.subject) return byTaskSubject.subject;
    const byRecentSession = studentSubjects.find((item) => item.subjectId === latestSession?.subjectId) ?? null;
    if (byRecentSession?.subject) return byRecentSession.subject;
    if (resultSubjectSlug && typeof resultSubjectSlug === "string") {
      return { id: "", tenantId: "", slug: resultSubjectSlug, name: tutorResult?.subjectName ?? activeDailyTask?.subject ?? "Materia", description: "", difficultyBand: "core", createdAt: "", updatedAt: "" };
    }
    return studentSubjects[0]?.subject ?? null;
  }, [activeDailyTask?.subject, activeDailyTask?.subjectId, activeSubjectSlug, latestSession?.subjectId, selectedSubject?.subject, studentSubjects, tutorResult?.subjectName, tutorResult?.subjectSlug]);
  const activeSubjectProgress = activeSubject ? studentSubjects.find((item) => item.subject?.slug === activeSubject.slug) : null;
  const activeProgressMetrics = activeSubjectProgress ? progressBySubjectId.get(activeSubjectProgress.subjectId) : null;
  const subjectThemeMap = {
    matematicas: {
      accent: "emerald",
      shell: "from-emerald-50 via-white to-emerald-100/70",
      border: "border-emerald-200",
      badge: "bg-emerald-100 text-emerald-800",
      bubble: "bg-emerald-50",
      strong: "bg-emerald-600 hover:bg-emerald-700",
    },
    historia: {
      accent: "amber",
      shell: "from-amber-50 via-white to-orange-100/70",
      border: "border-amber-200",
      badge: "bg-amber-100 text-amber-900",
      bubble: "bg-amber-50",
      strong: "bg-amber-600 hover:bg-amber-700",
    },
    ingles: {
      accent: "sky",
      shell: "from-sky-50 via-white to-blue-100/70",
      border: "border-sky-200",
      badge: "bg-sky-100 text-sky-900",
      bubble: "bg-sky-50",
      strong: "bg-sky-600 hover:bg-sky-700",
    },
    ciencias: {
      accent: "violet",
      shell: "from-violet-50 via-white to-fuchsia-100/70",
      border: "border-violet-200",
      badge: "bg-violet-100 text-violet-900",
      bubble: "bg-violet-50",
      strong: "bg-violet-600 hover:bg-violet-700",
    },
    lengua: {
      accent: "rose",
      shell: "from-rose-50 via-white to-pink-100/70",
      border: "border-rose-200",
      badge: "bg-rose-100 text-rose-900",
      bubble: "bg-rose-50",
      strong: "bg-rose-600 hover:bg-rose-700",
    },
    generic: {
      accent: "slate",
      shell: "from-slate-50 via-white to-slate-100/80",
      border: "border-slate-200",
      badge: "bg-slate-100 text-slate-800",
      bubble: "bg-slate-100",
      strong: "bg-slate-900 hover:bg-black",
    },
  } as const;
  const resolvedTheme = activeSubject?.slug ? subjectThemeMap[activeSubject.slug as keyof typeof subjectThemeMap] ?? subjectThemeMap.generic : subjectThemeMap.generic;
  const stageLabel = student?.learningStage === "primary" ? "Primaria" : student?.learningStage === "bachillerato" ? "Bachillerato" : "ESO";
  const schoolYearLabel = student?.schoolYear?.trim() || null;
  const supportTone = student?.learningStage === "primary"
    ? "Explicación muy guiada y concreta"
    : student?.learningStage === "bachillerato"
      ? "Razonamiento directo y con más autonomía"
      : "Guía clara, ordenada y con pasos cortos";
  const pedagogicalContext = student?.learningStage === "primary"
    ? "Lenguaje simple, una idea cada vez y apoyo muy visible."
    : student?.learningStage === "bachillerato"
      ? "Más autonomía, foco en razonamiento y conexiones entre ideas."
      : "Contexto real de 2 ESO: explicación ordenada, pasos cortos y preguntas que ayuden a pensar sin abrumar.";
  const boardModeUi = {
    normal: {
      shell: "bg-white",
      banner: "border-slate-200 bg-white/85 text-slate-700",
      title: "Ritmo estable",
      summary: "La pizarra mantiene la estructura completa y deja que avances sin interferencias.",
      emphasizePrimary: false,
      simplifySecondary: false,
    },
    reinforce_progress: {
      shell: "bg-emerald-50/40",
      banner: "border-emerald-200 bg-emerald-50 text-emerald-900",
      title: "Refuerzo de progreso",
      summary: "Se destaca el avance y el siguiente cierre útil para consolidar la racha.",
      emphasizePrimary: true,
      simplifySecondary: false,
    },
    simplified_focus: {
      shell: "bg-sky-50/30",
      banner: "border-sky-200 bg-sky-50 text-sky-900",
      title: "Foco simplificado",
      summary: "Se reduce el ruido y se prioriza una sola acción clara para no dispersarte.",
      emphasizePrimary: true,
      simplifySecondary: true,
    },
    overload_reduction: {
      shell: "bg-amber-50/40",
      banner: "border-amber-200 bg-amber-50 text-amber-900",
      title: "Reducción de carga",
      summary: "La pizarra baja intensidad visual y deja visible solo lo más prioritario.",
      emphasizePrimary: true,
      simplifySecondary: true,
    },
    reentry: {
      shell: "bg-violet-50/35",
      banner: "border-violet-200 bg-violet-50 text-violet-900",
      title: "Modo reentrada",
      summary: "Se facilita volver al sistema con una entrada corta y muy guiada.",
      emphasizePrimary: true,
      simplifySecondary: true,
    },
    intervention: {
      shell: "bg-rose-50/40",
      banner: "border-rose-200 bg-rose-50 text-rose-900",
      title: "Intervención activa",
      summary: "Se prioriza contención, claridad y un único paso esencial para recuperar control.",
      emphasizePrimary: true,
      simplifySecondary: true,
    },
    recovery: {
      shell: "bg-cyan-50/30",
      banner: "border-cyan-200 bg-cyan-50 text-cyan-900",
      title: "Recuperación guiada",
      summary: "La pizarra protege el reenganche y evita meter más carga de la necesaria.",
      emphasizePrimary: true,
      simplifySecondary: false,
    },
  } as const;
  const resolvedBoardModeUi = boardModeUi[boardMode];
  const shouldCompactSecondaryPanels = resolvedBoardModeUi.simplifySecondary;
  const shouldHighlightPrimaryPanel = resolvedBoardModeUi.emphasizePrimary;
  const completedDailyTasks = dailyPlan?.tasks.filter((task) => task.completed || dailyPlan.completedTaskIds.includes(task.id)) ?? [];
  const nextPendingDailyTask = dailyPlan?.tasks.find((task) => !task.completed && !dailyPlan.completedTaskIds.includes(task.id)) ?? null;
  const dailyCompletionPercent = dailyPlan
    ? Math.round(dailyPlan.completionRate > 1 ? dailyPlan.completionRate : dailyPlan.completionRate * 100)
    : 0;
  const totalSessionsCompleted = progress.reduce((total, item) => total + item.sessionsCompleted, 0);
  const totalPracticesCompleted = progress.reduce((total, item) => total + item.exercisesCompleted, 0);
  const identitySubject = evolution?.strengths[0] ?? progress[0]?.subject?.name ?? studentSubjects[0]?.subject?.name ?? "tu materia principal";
  const bridgeAction = analysis?.nextActions?.[0] ?? memory?.nextPriorityTask ?? growth?.recommendedShareMessage ?? "Resolver un ejercicio guiado";
  const shouldShowGrowthNarrative = progress.length > 0 && (totalSessionsCompleted > 0 || totalPracticesCompleted > 0);
  const sessionModeTone = sessionContract.mode === "task_resolution"
    ? "bg-amber-50 text-amber-900 border-amber-200"
    : sessionContract.mode === "exam_preparation"
      ? "bg-rose-50 text-rose-900 border-rose-200"
      : sessionContract.mode === "subject_reinforcement"
        ? "bg-emerald-50 text-emerald-900 border-emerald-200"
        : sessionContract.mode === "study_routine"
          ? "bg-sky-50 text-sky-900 border-sky-200"
          : "bg-violet-50 text-violet-900 border-violet-200";

  if (activeSection === "planner") {
    return (
      <div className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Camino del día</h2>
          <p className="text-sm text-slate-600">Cada bloque te dice si aún no has empezado, si estás dentro o si ya lo cerraste.</p>
        </div>

        {!dailyPlan || dailyPlan.tasks.length === 0 ? (
          <div className="text-sm text-slate-500">
            No hay tareas para hoy
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Progreso del día</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{dailyPlan.completionRate}%</div>
                <div className="mt-1 text-sm text-slate-600">{dailyPlan.completedTaskIds.length} de {dailyPlan.tasks.length} tareas cerradas</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tiempo sugerido</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{dailyPlan.recommendedDuration} min</div>
                <div className="mt-1 text-sm text-slate-600">Carga {dailyPlan.priority === "high" ? "alta" : dailyPlan.priority === "medium" ? "media" : "ligera"}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Razón del plan</div>
                <div className="mt-2 text-sm text-slate-700">{dailyPlan.adaptationReason}</div>
              </div>
            </div>
            {dailyPlan.tasks.map((task, index) => {
              const taskState = task.completed ? "completed" : activeDailyTask?.id === task.id ? "in_progress" : "pending";
              return (
              <button
                key={task.id}
                onClick={() => onStartDailyTask(task)}
                className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{index + 1}</span>
                      <div className="font-semibold text-slate-900">{task.subject}</div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">{task.type}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">dificultad {task.difficulty}/5</span>
                    </div>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${taskState === "completed" ? "bg-emerald-100 text-emerald-800" : taskState === "in_progress" ? "bg-sky-100 text-sky-900" : "bg-amber-100 text-amber-900"}`}>
                    {taskState === "completed" ? "Completado" : taskState === "in_progress" ? "En progreso" : "Pendiente"}
                  </div>
                </div>
                <div className="mt-3 text-sm text-slate-600">Abre una sesión guiada con esta materia ya cargada y el siguiente paso listo.</div>
              </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (activeSection === "subjects") {
    return (
      <div className="space-y-5 p-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Tus materias</h2>
          <p className="text-sm text-slate-600">Puedes moverte entre varias materias sin perder la pizarra ni el hilo del tutor.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {studentSubjects.map((subject) => {
            const subjectProgress = progressBySubjectId.get(subject.subjectId);
            const subjectName = subject.subject?.name ?? "Materia";
            const subjectSlug = subject.subject?.slug ?? "";
            const isActive = selectedSubject?.id === subject.id || activeSubjectSlug === subjectSlug;

            return (
              <button
                key={subject.id}
                type="button"
                onClick={() => onStartSubjectSession(subject)}
                className={`rounded-xl border bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50 ${
                  isActive ? "border-emerald-300 ring-1 ring-emerald-100" : "border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-slate-900">{subjectName}</div>
                  {subjectProgress ? (
                    <div className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      {subjectProgress.masteryScore}%
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 text-xs text-slate-500">Nivel: {subject.initialLevel.replaceAll("_", " ")}</div>
                <div className="mt-3 text-sm text-slate-600">
                  {subjectProgress
                    ? `${subjectProgress.sessionsCompleted} sesiones · ${subjectProgress.exercisesCompleted} practicas`
                    : "Lista para una primera sesión guiada"}
                </div>
                <div className="mt-4 text-sm font-semibold text-emerald-700">Abrir sesión guiada</div>
              </button>
            );
          })}
        </div>

        {studentSubjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            Aún no hay materias configuradas para este alumno.
          </div>
        ) : null}

        {selectedSubject ? (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{selectedSubject.subject?.name ?? "Materia"}</h3>
                  <p className="text-xs text-slate-500">Nivel inicial: {selectedSubject.initialLevel.replaceAll("_", " ")}</p>
                </div>
                {progressBySubjectId.get(selectedSubject.subjectId) && (
                  <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {progressBySubjectId.get(selectedSubject.subjectId)?.masteryScore}% dominio
                  </div>
                )}
              </div>
              <div className="space-y-2 text-sm text-slate-600">
                <div>Confianza: {progressBySubjectId.get(selectedSubject.subjectId)?.confidenceScore ?? 0}%</div>
                <div>Sesiones completadas: {progressBySubjectId.get(selectedSubject.subjectId)?.sessionsCompleted ?? 0}</div>
                <div>Ejercicios completados: {progressBySubjectId.get(selectedSubject.subjectId)?.exercisesCompleted ?? 0}</div>
              </div>
              <button
                type="button"
                onClick={() => onStartSubjectSession(selectedSubject)}
                className="mt-4 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Abrir sesión guiada en la pizarra
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-slate-900">Cómo se usa</div>
              <div className="space-y-3 text-sm text-slate-600">
                <div>1. Elige la materia que toca hoy.</div>
                <div>2. La pizarra abre el trabajo concreto.</div>
                <div>3. El chat derecho mantiene el hilo y las ayudas.</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (activeSection === "sessions") {
    return (
      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Sesiones recientes</h2>
          <p className="text-sm text-slate-600">Retoma una sesión previa o vuelve al tutor con continuidad real.</p>
        </div>

        {recentSessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            Todavía no hay sesiones recientes para continuar.
          </div>
        ) : (
          <div className="space-y-3">
            {recentSessions.map((session) => (
              <div key={session.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-900">{session.topic || "Sesión guiada"}</h3>
                  <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                    {session.status}
                  </div>
                </div>
                <p className="mb-3 text-sm text-slate-600">{session.tutorSummary}</p>
                <div className="mb-4 text-xs text-slate-500">Siguiente paso: {session.recommendedNextStep}</div>
                <button
                  type="button"
                  aria-label="Retomar esta sesion"
                  onClick={() => onResumeSession(session)}
                  className="rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-700"
                >
                  Retomar esta sesion
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (activeSection === "progress") {
    return (
      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Tu progreso</h2>
          <p className="text-sm text-slate-600">Lee cómo vas por materia y salta a la siguiente acción útil.</p>
        </div>

        {progress.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            Aún no hay progreso suficiente para mostrar métricas.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {progress.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-900">{item.subject?.name ?? "Materia"}</h3>
                  <div className="text-xs text-slate-500">Racha: {item.streakDays} días</div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span>Dominio</span>
                      <span>{item.masteryScore}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full bg-emerald-500" style={{ width: `${item.masteryScore}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                      <span>Confianza</span>
                      <span>{item.confidenceScore}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full bg-sky-500" style={{ width: `${item.confidenceScore}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                    <div className="rounded-xl bg-slate-50 p-3">{item.sessionsCompleted} sesiones</div>
                    <div className="rounded-xl bg-slate-50 p-3">{item.exercisesCompleted} ejercicios</div>
                  </div>

                  {item.weakTopics.length > 0 && (
                    <div className="text-xs text-amber-700">Vigilar: {item.weakTopics.slice(0, 2).join(", ")}</div>
                  )}

                  <button
                    type="button"
                    onClick={() => onStartSubjectSession(item)}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Trabajar esta materia
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (activeSection === "focus") {
    return (
      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Modo concentración</h2>
          <p className="text-sm text-slate-600">Sirve para entrar en una sesión breve con una sola materia y menos ruido visual.</p>
        </div>

        {focusSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            Aún no has iniciado sesiones de foco
          </div>
        ) : (
          <div className="space-y-3">
            {focusSessions.map((session) => (
              <div
                key={session.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="font-semibold text-slate-900">
                  {session.notes || "Sesión de foco"}
                </div>
                <div className="mt-1 text-xs text-slate-500">{session.durationMinutes} min</div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onStartFocusSession}
          className="rounded-xl bg-emerald-600 px-4 py-3 text-white text-sm font-semibold hover:bg-emerald-700"
        >
          Iniciar sesión de foco
        </button>
      </div>
    );
  }

  if (activeSection === "exercises") {
    return (
      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Ejercicios</h2>
          <p className="text-sm text-slate-600">Úsalo para retomar práctica real. Cada tarjeta te devuelve al ejercicio correcto.</p>
        </div>

        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Pendientes: {pendingExerciseCount} · Total: {exercises.length}
        </div>

        {exercises.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            Todavía no hay ejercicios generados.
          </div>
        ) : (
          <div className="space-y-3">
            {exercises.map((exercise) => (
              <div key={exercise.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">{exercise.expectedCompetency}</div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {exercise.status}
                  </div>
                </div>
                <p className="mb-3 text-sm text-slate-600">{exercise.prompt}</p>
                <div className="mb-4 text-xs text-slate-500">
                  Dificultad: {exercise.difficultyLevel} · Formato: {exercise.answerFormat}
                </div>
                <button
                  type="button"
                  onClick={() => onOpenExercise(exercise.id)}
                  className="rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  {exercise.status === "pending" ? "Continuar ejercicio" : "Ver ejercicio"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (activeSection === "memory") {
    return (
      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Memoria del alumno</h2>
          <p className="text-sm text-slate-600">Señales reales para acompañar mejor la siguiente sesión.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-slate-900">Vigilar</div>
            {memory?.watchouts.length ? (
              <div className="space-y-2 text-sm text-slate-700">
                {memory.watchouts.map((item, index) => <div key={index}>{item}</div>)}
              </div>
            ) : (
              <div className="text-sm text-slate-500">No hay alertas activas ahora mismo.</div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-slate-900">Errores comunes</div>
            {memory?.commonMistakes.length ? (
              <div className="space-y-2 text-sm text-slate-700">
                {memory.commonMistakes.map((item, index) => <div key={index}>{item}</div>)}
              </div>
            ) : (
              <div className="text-sm text-slate-500">Aún no hay patrones de error consolidados.</div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-slate-900">Fortalezas</div>
            {memory?.strengths.length ? (
              <div className="space-y-2 text-sm text-slate-700">
                {memory.strengths.map((item, index) => <div key={index}>{item}</div>)}
              </div>
            ) : (
              <div className="text-sm text-slate-500">Todavía no hay fortalezas destacadas registradas.</div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-slate-900">Acompañamiento</div>
            <div className="space-y-2 text-sm text-slate-700">
              {motivationMessage && <div>{motivationMessage}</div>}
              {analysis?.nextActions?.slice(0, 2).map((item, index) => <div key={index}>{item}</div>)}
              {guardianHooks.slice(0, 2).map((hook) => <div key={hook.id}>{hook.title}: {hook.summary}</div>)}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSectionChange?.("board")}
          className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black"
        >
          Volver al tutor IA
        </button>
      </div>
    );
  }

  const showTutorBoard = Boolean(activeGuidedStep || tutorResult?.reply || tutorResult?.recommendedNextStep);
  const showExerciseBoard = latestExercise && latestExercise.status !== "corrected";
  const showTaskLauncher = activeDailyTask !== null;
  const showDailyClosure = Boolean(!showTutorBoard && !showExerciseBoard && !latestSession && dailyClosure?.carryOverPrompt);
  const showResumeSession = !showTutorBoard && !showExerciseBoard && !showDailyClosure && latestSession;
  const showQuickActions = !showTutorBoard && !showExerciseBoard && !showResumeSession && !showDailyClosure && entry && (!nextAction || nextAction.kind === "quick_action");
  const shouldKeepBoardSurfaceMinimal = Boolean(showTutorBoard || showExerciseBoard || showResumeSession || showDailyClosure);

  return (
    <div className={`flex h-full flex-col ${resolvedBoardModeUi.shell}`}>
      <div className="sr-only" aria-hidden="true">
        <input readOnly value={currentTopic} />
        <input readOnly value={currentMessage} />
      </div>
      <header className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="sr-only">{student?.fullName ? `Hola, ${student.fullName.split(" ")[0]}` : "Hola"}</h1>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold text-emerald-700">Pizarra viva</span>
              <span>·</span>
              <span>{resolvedBoardModeUi.title}</span>
              <span>·</span>
              <span>{schoolYearLabel ?? stageLabel}</span>
              {activeSubject?.name ? (
                <>
                  <span>·</span>
                  <span className="font-semibold text-slate-900">{activeSubject.name}</span>
                </>
              ) : null}
            </div>
            <h2 className="text-sm font-semibold text-slate-500">Tutor IA · pizarra guiada</h2>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">{showTutorBoard ? (tutorResult?.topic ?? sessionContract.headline) : sessionContract.headline}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-700">
              {student?.fullName ? `Hola ${student.fullName.split(" ")[0]}, aquí trabajas una sola cosa cada vez con el tutor marcando el siguiente paso.` : "Espacio de trabajo"}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">{supportTone}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
              <span className={`rounded-full border px-3 py-1 ${sessionModeTone}`}>Modo de hoy: {sessionContract.label}</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">Objetivo: {sessionContract.objective}</span>
            </div>
            {latestSession && (
              <p className="mt-2 text-xs text-slate-500">
                Sigues donde lo dejaste. Vamos a continuar.
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {showTaskLauncher && (
              <div className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
                Tarea activa: {activeDailyTask.subject}
              </div>
            )}
            {activeProgressMetrics && (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                {activeProgressMetrics.masteryScore}% dominio · {activeProgressMetrics.confidenceScore}% confianza
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {sessionStatusMessage && (
          <div className="mx-auto mb-4 max-w-3xl rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {sessionStatusMessage}
          </div>
        )}

        {orchestratorPlan ? (
          <div className="mx-auto mb-4 max-w-4xl rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Ahora manda el tutor</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{orchestratorPlan.microObjective}</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">{orchestratorPlan.message}</p>
              </div>
              {orchestratorPlan.progressLabel ? <div className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{orchestratorPlan.progressLabel}</div> : null}
            </div>
          </div>
        ) : null}

        {shouldKeepBoardSurfaceMinimal ? (
          <div className="mx-auto mb-4 max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Modo de sesión</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{sessionContract.headline}</div>
                <div className="mt-1 text-sm text-slate-600">{sessionContract.boardBehavior}</div>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">{sessionContract.primaryCta}</div>
            </div>
          </div>
        ) : (
          <div className="mx-auto mb-4 max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Modo de sesión activo</div>
                <h2 className="mt-2 text-xl font-bold text-slate-900">{sessionContract.headline}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{sessionContract.subheadline}</p>
                <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 px-3 py-3"><span className="font-semibold text-slate-900">Chat</span>: {sessionContract.chatBehavior}</div>
                  <div className="rounded-xl bg-slate-50 px-3 py-3"><span className="font-semibold text-slate-900">Pizarra</span>: {sessionContract.boardBehavior}</div>
                </div>
              </div>
              <div className="min-w-0 lg:w-[320px]">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cómo progresa</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    {sessionContract.progression.map((step, index) => (
                      <div key={`${step}-${index}`} className="rounded-lg bg-white px-3 py-2">
                        {index + 1}. {step}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-slate-500">Cierre: {sessionContract.completionRule}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {completedDailyTasks.length > 0 && dailyPlan && !shouldKeepBoardSurfaceMinimal ? (
          <div className="mx-auto mb-4 max-w-4xl rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Has completado {completedDailyTasks.length} tarea{completedDailyTasks.length === 1 ? "" : "s"} del plan de hoy.
                  {nextPendingDailyTask ? ` Siguiente paso: ${nextPendingDailyTask.subject} - ${formatBoardTaskType(nextPendingDailyTask.type)}.` : ""}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-800">{dailyCompletionPercent}%</span>
                  {dailyPlan.tasks.map((task) => (
                    <span
                      key={task.id}
                      className={`rounded-full px-3 py-1 ${
                        task.completed || dailyPlan.completedTaskIds.includes(task.id)
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {task.completed || dailyPlan.completedTaskIds.includes(task.id) ? "Hecha" : formatBoardTaskType(task.type)}
                    </span>
                  ))}
                </div>
              </div>
              {nextPendingDailyTask ? (
                <button
                  type="button"
                  onClick={() => onStartDailyTask(nextPendingDailyTask)}
                  className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Crear practica ahora
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {shouldShowGrowthNarrative && !shouldKeepBoardSurfaceMinimal ? (
          <div className="mx-auto mb-4 max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Lo que ya esta cambiando</div>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Ya estas construyendo un ritmo propio</h2>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              <p>Desde que empezaste llevas {totalSessionsCompleted} sesiones y {totalPracticesCompleted} practicas.</p>
              {progress[0]?.streakDays ? (
                <p>Tu racha actual es de {progress[0].streakDays} dias, que ya habla de constancia y no de un intento aislado.</p>
              ) : null}
              <p>Tu perfil ya empieza a apoyarse en {identitySubject}, y eso se nota en como vuelves a estudiar.</p>
              <p>Tu avance ya se parece mas a una mejora sostenida que a un buen dia suelto.</p>
            </div>
            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-sky-700">Lo que puede pasar si sigues asi</div>
              <h3 className="mt-1 text-base font-bold text-slate-900">Tu siguiente nivel ya se empieza a ver</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Si mantienes este ritmo unas cuantas sesiones mas, es realista pensar que podras trabajar {identitySubject} con menos ayuda y sostener retos un poco mas largos sin perder claridad.
              </p>
              <p className="mt-3 text-sm font-semibold text-slate-900">Puente hacia ese nivel: {bridgeAction}</p>
            </div>
          </div>
        ) : null}

        {(stateDecision || guardianViewModel) && !shouldKeepBoardSurfaceMinimal && (
          <div className={`mx-auto mb-4 max-w-4xl rounded-2xl border px-4 py-4 ${resolvedBoardModeUi.banner}`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em]">Estado actual</div>
                <div className="mt-1 text-base font-semibold text-slate-900">{guardianViewModel?.summary ?? "Sesión activa"}</div>
                <div className="mt-1 text-sm">{stateActions?.primaryStudentAction ?? motivationMessage}</div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {stateDecision ? <span className="rounded-full bg-white/80 px-3 py-1 font-semibold text-slate-700">Prioridad: {stateDecision.priority}</span> : null}
                {guardianViewModel?.requiresIntervention ? <span className="rounded-full bg-white/80 px-3 py-1 font-semibold text-slate-700">Pide apoyo</span> : null}
              </div>
            </div>
          </div>
        )}

        {showTutorBoard && (
          <div className="mx-auto max-w-4xl space-y-4">
            <div className={`rounded-[28px] border bg-gradient-to-br from-white via-white to-white/95 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.08)] ${resolvedTheme.border} ${shouldHighlightPrimaryPanel ? "ring-2 ring-emerald-200/70" : ""}`}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Sesión guiada</div>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">{tutorResult?.topic ?? activeSubject?.name ?? "Pizarra activa"}</h2>
                  <p className="mt-1 text-sm text-slate-600">{shouldCompactSecondaryPanels ? "Una cosa cada vez." : "Un paso cada vez."}</p>
                </div>
                {activeSubject?.name ? <div className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm ring-1 ring-white/70 ${resolvedTheme.badge}`}>{activeSubject.name}</div> : null}
              </div>

              {activeGuidedStep ? (
                <div className={`mb-5 rounded-3xl border bg-gradient-to-r ${resolvedTheme.shell} p-4 ${resolvedTheme.border}`}>
                  <div className={`rounded-2xl border p-5 shadow-sm ${resolvedGuidedState.accent}`}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-700">Paso {Math.min(activeStepIndex + 1, Math.max(totalSteps, 1))} de {Math.max(totalSteps, 1)}</div>
                      <div className="text-xs text-slate-500">{sessionProgressPercent}%</div>
                    </div>
                    <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${sessionProgressPercent}%` }} />
                    </div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Qué tienes que hacer</div>
                    <div className="text-lg font-semibold leading-8 text-slate-900">{activeGuidedStep}</div>
                    <div className="mt-4 text-sm font-medium text-slate-800">{adaptiveGuidance}</div>
                    <div className="mt-1 text-sm text-slate-600">{adaptiveNext}</div>
                    <div className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Escribe aquí</div>
                    <textarea
                      value={guidedStepInput}
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onGuidedStepInputChange(event.target.value)}
                      placeholder="Escribe tu respuesta"
                      className="min-h-28 w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      disabled={sessionState === "checking" || sessionState === "completed"}
                    />
                    <div className="mt-3 flex gap-3">
                      <button
                        type="button"
                        onClick={() => onRunNextAction?.() ?? onSubmitGuidedStep()}
                        className={`rounded-xl px-4 py-3 text-sm font-semibold text-white ${resolvedTheme.strong}`}
                        disabled={sessionState === "checking" || sessionState === "completed"}
                      >
                        {nextAction?.ctaLabel ?? "Comprobar y seguir"}
                      </button>
                      {tutorResult?.recommendedNextStep ? (
                        <button
                          type="button"
                          onClick={() =>
                            onQuickAction({
                              topic: tutorResult.topic ?? currentTopic ?? entry?.recommendedTopic ?? "Sesión guiada",
                              prompt: tutorResult.recommendedNextStep ?? currentMessage,
                              subjectSlug: activeSubjectSlug ?? entry?.recommendedSubjectSlug,
                            })
                          }
                          className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                        >
                          Continuar con este siguiente paso
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {guidedFeedback ? (
                    <div className={`mt-4 rounded-2xl border p-4 ${feedbackToneMap[guidedFeedback.status]}`}>
                      <div className="text-sm font-semibold">
                        {guidedFeedback.status === "correct" ? "Correcto" : guidedFeedback.status === "almost" ? "Casi" : "Incorrecto"}: {guidedFeedback.message}
                      </div>
                      <div className="mt-1 text-sm leading-6">{guidedFeedback.rationale}</div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!activeGuidedStep && (tutorResult?.completionMessage || tutorResult?.progressMessage || tutorResult?.encouragement) ? (
                <div className={`rounded-3xl border bg-gradient-to-r ${resolvedTheme.shell} p-4 ${resolvedTheme.border}`}>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                    {tutorResult?.completionMessage ? (
                      <div className="text-base font-semibold text-slate-900">{tutorResult.completionMessage}</div>
                    ) : null}
                    {tutorResult?.progressMessage ? (
                      <div className="mt-2 text-sm text-slate-700">{tutorResult.progressMessage}</div>
                    ) : null}
                    {tutorResult?.encouragement ? (
                      <div className="mt-2 text-sm text-slate-700">{tutorResult.encouragement}</div>
                    ) : null}
                    {tutorResult?.recommendedNextStep ? (
                      <button
                        type="button"
                        onClick={() =>
                          onQuickAction({
                            topic: tutorResult.topic ?? currentTopic ?? entry?.recommendedTopic ?? "Sesión guiada",
                            prompt: tutorResult.recommendedNextStep ?? currentMessage,
                            subjectSlug: activeSubjectSlug ?? entry?.recommendedSubjectSlug,
                          })
                        }
                        className="mt-4 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                      >
                        Continuar con este siguiente paso
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

            </div>
          </div>
        )}

        {showExerciseBoard && (
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-900">Ejercicio activo</h2>
              <div className="rounded-xl bg-amber-50 p-4">
                {nextAction ? (
                  <div className="mb-4 rounded-2xl border border-amber-200 bg-white/90 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Siguiente acción</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">
                      {nextAction.kind === "resume_session" ? "Continuidad preparada" : nextAction.title}
                    </div>
                    <div className="mt-2 text-sm text-slate-700">{nextAction.detail}</div>
                  </div>
                ) : null}
                <div className="mb-3 text-sm font-semibold text-amber-900">{latestExercise.prompt}</div>
                <div className="mb-3 text-xs uppercase tracking-wider text-amber-700">
                  {latestExercise.expectedCompetency}
                </div>
                {latestExercise.hints.length > 0 && (
                  <div className="mb-4 space-y-1 text-sm text-slate-700">
                    {latestExercise.hints.map((hint, idx) => (
                      <div key={idx}>💡 Pista {idx + 1}: {hint}</div>
                    ))}
                  </div>
                )}
                <textarea
                  value={exerciseAnswer}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onExerciseAnswerChange(event.target.value)}
                  placeholder="Escribe tu respuesta"
                  className="mb-3 min-h-32 w-full rounded-xl border border-amber-200 px-4 py-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
                <button
                  type="button"
                  onClick={() => onRunNextAction?.() ?? onSubmitExercise()}
                  className="rounded-full bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  {nextAction?.ctaLabel ?? "Enviar respuesta"}
                </button>
                {latestExercise.correctionFeedback && (
                  <div className="mt-4 rounded-xl bg-white p-4 text-sm text-slate-700">
                    <div className="mb-1 font-semibold text-slate-900">Retroalimentación:</div>
                    {latestExercise.correctionFeedback}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showResumeSession && (
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-900">Retoma tu sesion</h2>
              <div className="rounded-xl bg-sky-50 p-4">
                {nextAction ? (
                  <div className="mb-4 rounded-2xl border border-sky-200 bg-white/90 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-700">Siguiente acción</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">
                      {nextAction.kind === "resume_session" ? "Continuidad preparada" : nextAction.title}
                    </div>
                    <div className="mt-2 text-sm text-slate-700">{nextAction.detail}</div>
                  </div>
                ) : null}
                <div className="mb-2 text-sm font-semibold text-sky-900">
                  {latestSession.topic || "Sesión guiada"}
                </div>
                <div className="mb-3 text-sm text-slate-700">{latestSession.tutorSummary}</div>
                <div className="mb-4 text-xs uppercase tracking-wider text-slate-500">
                  Siguiente paso: {latestSession.recommendedNextStep}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => onResumeSession(latestSession)}
                    aria-label="Retomar esta sesion"
                    className="rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-700"
                  >
                    {nextAction?.ctaLabel ?? "Retomar sesión"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (entry) {
                        onQuickAction({
                          topic: entry.recommendedTopic,
                          prompt: entry.recommendedPrompt,
                          subjectSlug: entry.recommendedSubjectSlug,
                        });
                        return;
                      }
                      onResumeSession(latestSession);
                    }}
                    aria-label="Hablar con el tutor"
                    className="rounded-full border border-emerald-200 bg-white px-6 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    Hablar con el tutor
                  </button>
                  {tutorResult?.recommendedNextStep && !showTutorBoard ? (
                    <button
                      type="button"
                      onClick={() =>
                        onQuickAction({
                          topic: tutorResult.topic ?? currentTopic ?? entry?.recommendedTopic ?? "Sesión guiada",
                          prompt: tutorResult.recommendedNextStep ?? currentMessage,
                          subjectSlug: activeSubjectSlug ?? entry?.recommendedSubjectSlug,
                        })
                      }
                      className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Continuar con este siguiente paso
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}

        {showDailyClosure && dailyClosure ? (
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">Actividad reciente</div>
              <h2 className="text-xl font-bold text-slate-900">Esto quedo preparado para que hoy vuelvas con ventaja</h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">{dailyClosure.summary}</p>
              <div className="mt-5 rounded-xl bg-emerald-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Por que merece la pena volver</div>
                <p className="mt-2 text-sm leading-6 text-slate-700">Mañana ya no empiezas calentando: puedes entrar directamente en el siguiente nivel de trabajo.</p>
              </div>
              <button
                type="button"
                onClick={() => onResumeDailyClosure?.(dailyClosure)}
                className="mt-5 rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Volver justo por aqui
              </button>
            </div>
          </div>
        ) : null}

        {showQuickActions && (
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-6 text-center">
                <div className="mb-2 text-sm font-semibold text-emerald-700">Tutor IA</div>
                <h2 className="mb-2 text-2xl font-bold text-slate-900">{entry.headline}</h2>
                <p className="text-sm text-slate-600">{entry.subheadline}</p>
              </div>
              <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Actividad reciente</div>
              <div className="mb-6 rounded-xl bg-emerald-50 p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                  Acción recomendada
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onQuickAction({
                      topic: entry.recommendedTopic,
                      prompt: entry.recommendedPrompt,
                      subjectSlug: entry.recommendedSubjectSlug,
                      sessionMode: sessionContract.mode,
                      sessionInputKind: sessionContract.entryKind,
                    })
                  }
                  aria-label="Hablar con el tutor"
                  className="w-full rounded-xl bg-emerald-600 px-6 py-4 text-left text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  {sessionContract.primaryCta}
                </button>
              </div>
              {sessionModeOptions.length > 0 ? (
                <div className="mb-6">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Elegir otro modo</div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {sessionModeOptions.map((option) => (
                      <button
                        key={option.mode}
                        type="button"
                        onClick={() => onSelectSessionMode?.(option)}
                        className={`rounded-xl border p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50 ${option.mode === sessionContract.mode ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}
                      >
                        <div className="text-sm font-semibold text-slate-900">{option.label}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-600">{option.description}</div>
                        <div className="mt-3 text-xs font-semibold text-emerald-700">{option.ctaLabel}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {entry.quickActions.length > 0 && !shouldCompactSecondaryPanels && (
                <div>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Otras opciones
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {entry.quickActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() =>
                          onQuickAction({
                            topic: action.topic,
                            prompt: action.prompt,
                            subjectSlug: action.subjectSlug,
                            sessionMode: sessionContract.mode,
                            sessionInputKind: action.subjectSlug ? "selected_subject" : sessionContract.entryKind,
                          })
                        }
                        className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-emerald-300 hover:bg-emerald-50"
                      >
                        <div className="mb-1 text-sm font-semibold text-slate-900">{action.label}</div>
                        <div className="text-xs text-slate-600">{action.description}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!showTutorBoard && !showExerciseBoard && !showResumeSession && !showDailyClosure && !showQuickActions && (
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h1 className="text-xl font-bold text-slate-900">Empieza por aqui</h1>
              <p className="mt-2 text-sm text-slate-600">
                {nextAction?.detail ?? "Solo verás un siguiente paso claro en cuanto haya una sesión o tarea activa."}
              </p>
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Siguiente acción</div>
                <div className="mt-1 text-base font-semibold text-slate-900">{nextAction?.title ?? "Abrir el siguiente paso"}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (nextAction?.kind === "quick_action" && entry) {
                    onQuickAction({
                      topic: entry.recommendedTopic,
                      prompt: entry.recommendedPrompt,
                      subjectSlug: entry.recommendedSubjectSlug,
                    });
                    return;
                  }
                  onRunNextAction?.();
                }}
                aria-label={nextAction?.kind === "quick_action" ? "Hablar con el tutor" : undefined}
                className="mt-4 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                disabled={!nextAction}
              >
                {nextAction?.ctaLabel ?? "Esperando siguiente acción"}
              </button>
              {nextAction?.kind === "task" && activeDailyTask ? (
                <button
                  type="button"
                  onClick={() => onRunNextAction?.()}
                  className="ml-3 mt-4 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                >
                  Hablar con el tutor
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
