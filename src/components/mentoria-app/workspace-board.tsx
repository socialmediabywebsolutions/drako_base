"use client";

import { useState } from "react";
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
  studentSubjects: MentoriaStudentSubject[];
  progress: MentoriaProgress[];
  dailyPlan: DailyPlan | null;
  focusSessions: FocusSession[];
  entry: MentoriaWorkspaceEntry | null;
  latestSession: LearningSession | null;
  recentSessions: LearningSession[];
  latestExercise: MentoriaExercise | null;
  exercises: MentoriaExercise[];
  activeDailyTask: DailyPlanTask | null;
  memory: MentoriaStudentMemorySummary | null;
  analysis: { weakSubjects: string[]; strongSubjects: string[]; nextActions: string[] } | null;
  guardianHooks: MentoriaGuardianHookEvent[];
  motivationMessage: string | null;
  tutorMessages: Array<{ role: "student" | "tutor"; content: string }>;
  exerciseAnswer: string;
  sessionStatusMessage?: string | null;
  onSendMessage: (message: string) => void;
  onSubmitExercise: () => void;
  onExerciseAnswerChange: (answer: string) => void;
  onStartDailyTask: (task: DailyPlanTask) => void;
  onStartFocusSession?: () => void;
  onStartSubjectSession: (subject: MentoriaStudentSubject | MentoriaProgress) => void;
  onOpenExercise: (exerciseId: string) => void;
  onSectionChange?: (section: string) => void;
  onResumeSession: (session: LearningSession) => void;
  onQuickAction: (action: { topic: string; prompt: string; subjectSlug?: string | null }) => void;
};

export function WorkspaceBoard({
  activeSection,
  student,
  studentSubjects,
  progress,
  dailyPlan,
  focusSessions,
  entry,
  latestSession,
  recentSessions,
  latestExercise,
  exercises,
  activeDailyTask,
  memory,
  analysis,
  guardianHooks,
  motivationMessage,
  tutorMessages,
  exerciseAnswer,
  sessionStatusMessage,
  onSendMessage,
  onSubmitExercise,
  onExerciseAnswerChange,
  onStartDailyTask,
  onStartFocusSession,
  onStartSubjectSession,
  onOpenExercise,
  onSectionChange,
  onResumeSession,
  onQuickAction,
}: WorkspaceBoardProps) {
  const [tutorInput, setTutorInput] = useState("");

  const handleSend = () => {
    if (!tutorInput.trim()) return;
    onSendMessage(tutorInput);
    setTutorInput("");
  };

  const progressBySubjectId = new Map(progress.map((item) => [item.subjectId, item]));
  const pendingExerciseCount = exercises.filter((exercise) => exercise.status === "pending").length;

  if (activeSection === "planner") {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">
          Tu plan para hoy
        </h2>

        {!dailyPlan || dailyPlan.tasks.length === 0 ? (
          <div className="text-sm text-slate-500">
            No hay tareas para hoy
          </div>
        ) : (
          <div className="space-y-3">
            {dailyPlan.tasks.map((task) => (
              <button
                key={task.id}
                onClick={() => onStartDailyTask(task)}
                className="w-full rounded-xl border p-4 text-left hover:bg-slate-50"
              >
                <div className="font-semibold text-slate-900">
                  {task.subject}
                </div>
                <div className="text-xs text-slate-500">
                  {task.type}
                </div>
              </button>
            ))}
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
          <p className="text-sm text-slate-600">Elige una materia para abrir una sesión guiada con contexto real.</p>
        </div>

        {studentSubjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            Aún no hay materias configuradas para este alumno.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {studentSubjects.map((item) => {
              const progressItem = progressBySubjectId.get(item.subjectId);

              return (
                <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{item.subject?.name ?? "Materia"}</h3>
                      <p className="text-xs text-slate-500">Nivel inicial: {item.initialLevel.replaceAll("_", " ")}</p>
                    </div>
                    {progressItem && (
                      <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {progressItem.masteryScore}% dominio
                      </div>
                    )}
                  </div>

                  {progressItem ? (
                    <div className="space-y-2 text-sm text-slate-600">
                      <div>Confianza: {progressItem.confidenceScore}%</div>
                      <div>Sesiones completadas: {progressItem.sessionsCompleted}</div>
                      <div>Ejercicios completados: {progressItem.exercisesCompleted}</div>
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">Todavía no hay progreso consolidado en esta materia.</div>
                  )}

                  <button
                    type="button"
                    onClick={() => onStartSubjectSession(item)}
                    className="mt-4 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Empezar sesión guiada
                  </button>
                </div>
              );
            })}
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
        <h2 className="text-lg font-bold text-slate-900">
          Modo concentración
        </h2>

        {focusSessions.length === 0 ? (
          <div className="text-sm text-slate-500">
            Aún no has iniciado sesiones de foco
          </div>
        ) : (
          <div className="space-y-3">
            {focusSessions.map((session) => (
              <div
                key={session.id}
                className="rounded-xl border p-4"
              >
                <div className="font-semibold text-slate-900">
                  {session.notes || "Sesión de foco"}
                </div>
                <div className="text-xs text-slate-500">
                  {session.durationMinutes} min
                </div>
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
          <p className="text-sm text-slate-600">Continúa un ejercicio pendiente o vuelve al tutor para practicar.</p>
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

  const showTutorBoard = tutorMessages.length > 0;
  const showExerciseBoard = latestExercise && latestExercise.status !== "corrected";
  const showTaskLauncher = activeDailyTask !== null;
  const showResumeSession = !showTutorBoard && !showExerciseBoard && latestSession;
  const showQuickActions = !showTutorBoard && !showExerciseBoard && !showResumeSession && entry;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-400">
              Sesión en curso
            </div>
            <h2 className="text-sm text-slate-500">Tutor IA</h2>
            <h1 className="text-xl font-bold text-slate-900">Pizarra de aprendizaje</h1>
            <p className="text-sm text-slate-600">
              {student?.fullName ? `Hola ${student.fullName.split(" ")[0]}, vamos a avanzar hoy 💪` : "Espacio de trabajo"}
            </p>
            {latestSession && (
              <p className="text-xs text-slate-400">
                Sigues donde lo dejaste. Vamos a continuar.
              </p>
            )}
          </div>
          {showTaskLauncher && (
            <div className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
              Tarea activa: {activeDailyTask.subject}
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {sessionStatusMessage && (
          <div className="mx-auto mb-4 max-w-3xl rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {sessionStatusMessage}
          </div>
        )}

        {showTutorBoard && (
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="text-xs font-medium text-emerald-600">
                Buen comienzo 👌
              </div>
              <h2 className="mb-4 text-lg font-bold text-slate-900">Sesión con tu tutor IA</h2>
              <div className="space-y-3">
                {tutorMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl px-4 py-3 ${
                      msg.role === "student"
                        ? "ml-8 bg-emerald-50 text-slate-900"
                        : "mr-8 bg-slate-100 text-slate-900"
                    }`}
                  >
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {msg.role === "student" ? "Tú" : "Tutor"}
                    </div>
                    <div className="text-sm leading-relaxed">{msg.content}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={tutorInput}
                  onChange={(e) => setTutorInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Escribe tu pregunta o respuesta..."
                  className="flex-1 rounded-full border border-slate-300 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        )}

        {showExerciseBoard && (
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-900">Ejercicio activo</h2>
              <div className="rounded-xl bg-amber-50 p-4">
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
                  onChange={(e) => onExerciseAnswerChange(e.target.value)}
                  placeholder="Escribe tu respuesta aquí..."
                  className="mb-3 min-h-32 w-full rounded-xl border border-amber-200 px-4 py-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
                <button
                  type="button"
                  onClick={onSubmitExercise}
                  className="rounded-full bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Enviar respuesta
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
                <div className="mb-2 text-sm font-semibold text-sky-900">
                  {latestSession.topic || "Sesión guiada"}
                </div>
                <div className="mb-3 text-sm text-slate-700">{latestSession.tutorSummary}</div>
                <div className="mb-4 text-xs uppercase tracking-wider text-slate-500">
                  Siguiente paso: {latestSession.recommendedNextStep}
                </div>
                <button
                  type="button"
                  onClick={() => onResumeSession(latestSession)}
                  className="rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-700"
                >
                  Retomar sesión
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
              <h1 className="text-xl font-bold text-slate-900">
                Empieza por aquí
              </h1>

              <p className="text-sm text-slate-600">
                Elige una tarea del plan o empieza una sesión de foco.
                Yo te guiaré paso a paso.
              </p>

              <small className="text-slate-400">
                Poco a poco cada día = resultados reales
              </small>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onSectionChange?.("planner")}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Ver plan del día
                </button>

                <button
                  type="button"
                  onClick={() => onSectionChange?.("focus")}
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Empezar foco
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
