"use client";

import { useMemo } from "react";
import type { ChangeEvent } from "react";
import type {
  StudentProfile,
  LearningSession,
  MentoriaExercise,
  DailyPlan,
  DailyPlanTask,
  FocusSession,
  MentoriaWorkspaceEntry,
  MentoriaProgress,
  MentoriaStudentMemorySummary,
  MentoriaStudentSubject,
  MentoriaGuardianHookEvent,
} from "@/lib/mentoria/types";

type WorkspaceBoardProps = {
  activeSection: string;
  student: StudentProfile | null;
  studentSubjects?: MentoriaStudentSubject[];
  progress?: MentoriaProgress[];
  dailyPlan?: DailyPlan | null;
  focusSessions?: FocusSession[];
  entry?: MentoriaWorkspaceEntry | null;
  latestSession?: LearningSession | null;
  recentSessions?: LearningSession[];
  latestExercise?: MentoriaExercise | null;
  exercises?: MentoriaExercise[];
  activeDailyTask?: DailyPlanTask | null;
  memory?: MentoriaStudentMemorySummary | null;
  analysis?: { weakSubjects: string[]; strongSubjects: string[]; nextActions: string[] } | null;
  guardianHooks?: MentoriaGuardianHookEvent[];
  motivationMessage?: string | null;
  activeSubjectSlug?: string | null;
  selectedSubject?: MentoriaStudentSubject | null;
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
  sessionState?: "idle" | "answering" | "checking" | "retry" | "completed";
  activeGuidedStep?: string | null;
  activeStepIndex?: number;
  totalSteps?: number;
  sessionProgressPercent?: number;
  guidedStepInput?: string;
  guidedFeedback?: { status: "correct" | "almost" | "incorrect"; message: string; rationale: string } | null;
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
  onQuickAction: (action: { topic: string; prompt: string; subjectSlug?: string | null }) => void;
  onRunNextAction?: () => void;
};

export function WorkspaceBoard({
  activeSection,
  student,
  studentSubjects = [],
  progress = [],
  dailyPlan = null,
  focusSessions = [],
  entry = null,
  latestSession = null,
  recentSessions = [],
  latestExercise = null,
  exercises = [],
  activeDailyTask = null,
  memory = null,
  analysis = null,
  guardianHooks = [],
  motivationMessage = null,
  activeSubjectSlug = null,
  selectedSubject = null,
  tutorResult,
  nextAction = null,
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
  onQuickAction,
  onRunNextAction,
}: WorkspaceBoardProps) {
  const feedbackToneMap = {
    correct: "border-emerald-200 bg-emerald-50 text-emerald-900",
    almost: "border-amber-200 bg-amber-50 text-amber-900",
    incorrect: "border-rose-200 bg-rose-50 text-rose-900",
  } as const;
  const guidedStateUi = {
    idle: {
      badge: "Listo para pensar",
      copy: "Lee el paso, localiza la idea clave y prepara una respuesta breve antes de comprobar.",
      accent: "border-slate-200 bg-slate-50 text-slate-900",
    },
    answering: {
      badge: "Estás respondiendo",
      copy: "Ya has empezado. Ahora conviene cerrar la idea con una respuesta más concreta.",
      accent: "border-sky-200 bg-sky-50 text-sky-900",
    },
    checking: {
      badge: "Comprobando",
      copy: "El sistema está validando si tu respuesta resuelve bien el objetivo del paso.",
      accent: "border-violet-200 bg-violet-50 text-violet-900",
    },
    retry: {
      badge: "Toca ajustar",
      copy: "No cambies de bloque: rehace este mismo paso usando la explicación para corregir el enfoque.",
      accent: "border-rose-200 bg-rose-50 text-rose-900",
    },
    completed: {
      badge: "Sesión cerrada",
      copy: "La secuencia principal ya está resuelta. Puedes quedarte con la idea final y pasar al siguiente bloque cuando toque.",
      accent: "border-emerald-200 bg-emerald-50 text-emerald-900",
    },
  } as const;
  const resolvedGuidedState = guidedStateUi[sessionState];
  const progressBySubjectId = new Map(progress.map((item) => [item.subjectId, item]));
  const pendingExerciseCount = exercises.filter((exercise) => exercise.status === "pending").length;
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
      <div className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Tus materias</h2>
          <p className="text-sm text-slate-600">Aquí solo aparece la materia activa. Todo lo demás se decide desde la navegación izquierda.</p>
        </div>

        {!selectedSubject ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            Selecciona una materia en la navegación izquierda para ver su drill-down aquí.
          </div>
        ) : (
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
              <div className="mb-3 text-sm font-semibold text-slate-900">Ruta rápida</div>
              <div className="space-y-3 text-sm text-slate-600">
                <div>1. La izquierda fija la materia.</div>
                <div>2. Esta vista te enseña nivel y progreso real.</div>
                <div>3. La pizarra abre el contenido y el panel derecho recoge la conversación.</div>
              </div>
            </div>
          </div>
        )}
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
                  onClick={() => onResumeSession(session)}
                  className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700"
                >
                  Retomar sesión
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
  const showResumeSession = !showTutorBoard && !showExerciseBoard && latestSession;
  const showQuickActions = !showTutorBoard && !showExerciseBoard && !showResumeSession && entry && !nextAction;

  return (
    <div className="flex h-full flex-col">
      <header className={`border-b bg-gradient-to-r ${resolvedTheme.shell} px-6 py-6 ${resolvedTheme.border}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-3 py-1 font-semibold shadow-sm ${resolvedTheme.badge}`}>Pizarra viva</span>
              <span className="rounded-full bg-white/85 px-3 py-1 font-medium text-slate-700 shadow-sm">Nivel: {stageLabel}</span>
              {schoolYearLabel ? <span className="rounded-full bg-white/85 px-3 py-1 font-medium text-slate-700 shadow-sm">Curso: {schoolYearLabel}</span> : null}
              {activeSubject?.name ? <span className={`rounded-full px-4 py-1.5 font-semibold shadow-sm ring-1 ring-white/70 ${resolvedTheme.badge}`}>Ahora estás en {activeSubject.name}</span> : null}
            </div>
            <h2 className="text-sm font-semibold text-slate-500">Tutor IA · sesión guiada</h2>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Pizarra de aprendizaje</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-700">
              {student?.fullName ? `Hola ${student.fullName.split(" ")[0]}, aquí tienes una sesión guiada clara para avanzar sin perder el hilo.` : "Espacio de trabajo"}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">{supportTone}</p>
            <p className="mt-2 max-w-2xl text-xs leading-6 text-slate-600">{pedagogicalContext}</p>
            {latestSession && (
              <p className="mt-2 text-xs text-slate-500">
                Sigues donde lo dejaste. Vamos a continuar.
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {showTaskLauncher && (
              <div className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
                Tarea activa: {activeDailyTask.subject}
              </div>
            )}
            {activeProgressMetrics && (
              <div className="rounded-full bg-white/85 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm">
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

        {showTutorBoard && (
          <div className="mx-auto max-w-4xl space-y-4">
            <div className={`rounded-[28px] border bg-gradient-to-br from-white via-white to-white/95 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.08)] ${resolvedTheme.border}`}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Sesión guiada</div>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">{tutorResult?.topic ?? activeSubject?.name ?? "Pizarra activa"}</h2>
                  <p className="mt-1 text-sm text-slate-600">Solo ves el paso activo y lo que toca hacer ahora.</p>
                </div>
                {activeSubject?.name ? <div className={`rounded-full px-4 py-2 text-sm font-semibold shadow-sm ring-1 ring-white/70 ${resolvedTheme.badge}`}>{activeSubject.name}</div> : null}
              </div>

              {activeGuidedStep ? (
                <div className={`mb-5 space-y-4 rounded-3xl border bg-gradient-to-r ${resolvedTheme.shell} p-4 ${resolvedTheme.border}`}>
                  <div className="rounded-2xl bg-white/90 p-5 shadow-sm">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Progreso de sesión</div>
                      <div className="text-sm font-semibold text-slate-700">Paso {Math.min(activeStepIndex + 1, Math.max(totalSteps, 1))} de {Math.max(totalSteps, 1)}</div>
                    </div>
                    <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${sessionProgressPercent}%` }} />
                    </div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Paso activo</div>
                    <div className="text-base font-semibold leading-7 text-slate-900">{activeGuidedStep}</div>
                  </div>

                  <div className="rounded-2xl bg-white/90 p-5 shadow-sm">
                    {nextAction ? (
                      <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Siguiente acción</div>
                        <div className="mt-1 text-base font-semibold text-slate-900">{nextAction.title}</div>
                        <div className="mt-2 text-sm text-slate-700">{nextAction.detail}</div>
                      </div>
                    ) : null}
                    <div className={`mb-4 rounded-2xl border p-4 ${resolvedGuidedState.accent}`}>
                      <div className="text-[11px] font-semibold uppercase tracking-wider">{resolvedGuidedState.badge}</div>
                      <div className="mt-2 text-sm">{resolvedGuidedState.copy}</div>
                    </div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Tu respuesta</div>
                    <textarea
                      value={guidedStepInput}
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onGuidedStepInputChange(event.target.value)}
                      placeholder="Escribe lo que harías o responderías en este paso"
                      className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
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
                    </div>
                  </div>

                  {guidedFeedback ? (
                    <div className={`rounded-2xl border p-4 ${feedbackToneMap[guidedFeedback.status]}`}>
                      <div className="text-sm font-semibold">
                        {guidedFeedback.status === "correct" ? "Correcto" : guidedFeedback.status === "almost" ? "Casi" : "Incorrecto"}: {guidedFeedback.message}
                      </div>
                      <div className="mt-2 text-sm leading-6">{guidedFeedback.rationale}</div>
                    </div>
                  ) : null}
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
                    <div className="mt-1 text-base font-semibold text-slate-900">{nextAction.title}</div>
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
                  placeholder="Escribe tu respuesta aquí..."
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
              <h2 className="mb-4 text-lg font-bold text-slate-900">Continuar donde lo dejaste</h2>
              <div className="rounded-xl bg-sky-50 p-4">
                {nextAction ? (
                  <div className="mb-4 rounded-2xl border border-sky-200 bg-white/90 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-700">Siguiente acción</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">{nextAction.title}</div>
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
                <button
                  type="button"
                  onClick={() => onRunNextAction?.() ?? onResumeSession(latestSession)}
                  className="rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-700"
                >
                  {nextAction?.ctaLabel ?? "Retomar sesión"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showQuickActions && (
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="mb-6 text-center">
                <h2 className="mb-2 text-2xl font-bold text-slate-900">{entry.headline}</h2>
                <p className="text-sm text-slate-600">{entry.subheadline}</p>
              </div>
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
                    })
                  }
                  className="w-full rounded-xl bg-emerald-600 px-6 py-4 text-left text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  {entry.recommendedTopic}
                </button>
              </div>
              {entry.quickActions.length > 0 && (
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

        {!showTutorBoard && !showExerciseBoard && !showResumeSession && !showQuickActions && (
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h1 className="text-xl font-bold text-slate-900">Empieza por aquí</h1>
              <p className="mt-2 text-sm text-slate-600">
                {nextAction?.detail ?? "Solo verás un siguiente paso claro en cuanto haya una sesión o tarea activa."}
              </p>
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Siguiente acción</div>
                <div className="mt-1 text-base font-semibold text-slate-900">{nextAction?.title ?? "Abrir el siguiente paso"}</div>
              </div>
              <button
                type="button"
                onClick={() => onRunNextAction?.()}
                className="mt-4 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                disabled={!nextAction}
              >
                {nextAction?.ctaLabel ?? "Esperando siguiente acción"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
