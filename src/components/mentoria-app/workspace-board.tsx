"use client";

import { WorkspaceClassBoard } from "@/components/mentoria-app/workspace-class-board";
import type {
  DailyPlan,
  DailyPlanTask,
  FocusSession,
  LearningSession,
  MentoriaBoardUpdate,
  MentoriaDailyClosureSummary,
  MentoriaExercise,
  MentoriaGuardianHookEvent,
  MentoriaGrowthSummary,
  MentoriaProgress,
  MentoriaSessionContract,
  MentoriaSessionMode,
  MentoriaSessionModeOption,
  MentoriaStudentMemorySummary,
  MentoriaStudentSessionSignal,
  MentoriaStudentSubject,
  MentoriaWorkspaceEntry,
  StudentProfile,
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
  activeBoardUpdate?: MentoriaBoardUpdate | null;
  activeBoardHistory?: MentoriaBoardUpdate[];
  sessionSignal: MentoriaStudentSessionSignal;
  sessionSignalSummary: string;
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
  onAdvanceBoardStep: () => void;
  onRequestSimplerExplanation: () => void;
  onRequestAnotherExample: () => void;
  onRequestPractice: () => void;
  onSessionSignalChange: (signal: MentoriaStudentSessionSignal) => void;
  onApplySessionSignal: () => void;
  onSelectSessionMode?: (option: MentoriaSessionModeOption) => void;
  onRunNextAction?: () => void;
};

export function WorkspaceBoard(props: WorkspaceBoardProps) {
  if (props.activeSection === "subjects") {
    return (
      <div className="h-full overflow-y-auto bg-slate-50 px-6 py-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">Materias</h1>
            <p className="mt-2 text-sm text-slate-600">Cambia de clase y abre la pizarra de esa materia.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(props.studentSubjects ?? []).map((subject) => (
              <button
                key={subject.id}
                type="button"
                onClick={() => props.onStartSubjectSession(subject)}
                className="rounded-[28px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                <div className="text-lg font-semibold text-slate-950">{subject.subject?.name ?? "Materia"}</div>
                <div className="mt-2 text-sm text-slate-600">{subject.subject?.description ?? "Abrir explicacion guiada."}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (props.activeSection === "sessions") {
    return (
      <div className="h-full overflow-y-auto bg-slate-50 px-6 py-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">Sesiones</h1>
            <p className="mt-2 text-sm text-slate-600">Retoma la ultima clase de cada materia cuando te sirva.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {(props.recentSessions ?? []).map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => props.onResumeSession(session)}
                className="rounded-[28px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Sesion</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{session.topic || "Clase guiada"}</div>
                <div className="mt-2 text-sm text-slate-600">{session.tutorSummary}</div>
                <div className="mt-3 text-sm font-medium text-slate-900">Siguiente paso: {session.recommendedNextStep}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (props.activeSection === "progress") {
    return (
      <div className="h-full overflow-y-auto bg-slate-50 px-6 py-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">Progreso</h1>
            <p className="mt-2 text-sm text-slate-600">Solo lo necesario para saber por donde seguir.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(props.progress ?? []).map((item) => (
              <div key={item.id} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-lg font-semibold text-slate-950">{item.subject?.name ?? item.subjectId}</div>
                <div className="mt-3 text-sm text-slate-600">Dominio {item.masteryScore}%</div>
                <div className="text-sm text-slate-600">Confianza {item.confidenceScore}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (props.activeSection === "focus") {
    return (
      <div className="h-full overflow-y-auto bg-slate-50 px-6 py-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">Concentracion</h1>
            <p className="mt-2 text-sm text-slate-600">Entra a una sesion corta y vuelve a la pizarra.</p>
          </div>
          <button
            type="button"
            onClick={() => props.onStartFocusSession?.()}
            className="rounded-2xl bg-slate-950 px-5 py-4 text-sm font-semibold text-white hover:bg-black"
          >
            Empezar bloque de concentracion
          </button>
        </div>
      </div>
    );
  }

  if (props.activeSection === "exercises") {
    return (
      <div className="h-full overflow-y-auto bg-slate-50 px-6 py-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">Ejercicios</h1>
            <p className="mt-2 text-sm text-slate-600">Abre una practica concreta y vuelve a la pizarra para resolverla.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {(props.exercises ?? []).map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                onClick={() => props.onOpenExercise(exercise.id)}
                className="rounded-[28px] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-amber-300 hover:bg-amber-50"
              >
                <div className="text-sm font-semibold text-slate-950">{exercise.prompt}</div>
                <div className="mt-2 text-sm text-slate-600">{exercise.expectedCompetency}</div>
                <div className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                  {exercise.status === "corrected" ? "Corregido" : "Pendiente"} · {exercise.difficultyLevel}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (props.activeSection === "memory") {
    return (
      <div className="h-full overflow-y-auto bg-slate-50 px-6 py-6">
        <div className="mx-auto max-w-5xl space-y-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">Memoria</h1>
            <p className="mt-2 text-sm text-slate-600">Patrones utiles para acompanar mejor la siguiente clase.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-950">Errores comunes</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {(props.memory?.commonMistakes ?? []).map((item, index) => <div key={`${item}-${index}`}>{item}</div>)}
              </div>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-950">Fortalezas</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {(props.memory?.strengths ?? []).map((item, index) => <div key={`${item}-${index}`}>{item}</div>)}
              </div>
            </div>
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-950">Siguiente prioridad</div>
              <div className="mt-3 text-sm text-slate-600">{props.memory?.nextPriorityTask ?? "Seguir una clase corta y concreta."}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isPlaceholderBoard = Boolean(props.activeBoardUpdate?.conceptDefinition?.startsWith("La pizarra de"));
  const launchPanel =
    props.dailyClosure?.carryOverPrompt
      ? {
          title: "Esto quedo preparado para que vuelvas rapido",
          detail: props.dailyClosure.summary,
          ctaLabel: "Volver justo por aqui",
        }
      : props.latestSession && isPlaceholderBoard
        ? {
            title: props.latestSession.topic || "Sesion guiada",
            detail: props.latestSession.tutorSummary || props.latestSession.recommendedNextStep,
            ctaLabel: "Retomar esta sesion",
          }
        : props.nextAction
          ? {
              title: props.nextAction.title,
              detail: props.nextAction.detail,
              ctaLabel: props.nextAction.ctaLabel,
            }
          : props.entry
            ? {
                title: props.entry.headline,
                detail: props.entry.subheadline,
                ctaLabel: props.sessionContract.primaryCta,
              }
            : null;

  return (
    <WorkspaceClassBoard
      studentName={props.student?.fullName ?? props.student?.name ?? null}
      boardUpdate={props.activeBoardUpdate ?? null}
      boardHistory={props.activeBoardHistory ?? []}
      sessionStatusMessage={props.sessionStatusMessage ?? null}
      launchPanel={launchPanel}
      onLaunchPanel={() => {
        if (props.dailyClosure?.carryOverPrompt) {
          props.onResumeDailyClosure?.(props.dailyClosure);
          return;
        }
        if (props.latestSession && !props.activeBoardUpdate) {
          props.onResumeSession(props.latestSession);
          return;
        }
        if (props.nextAction?.kind === "quick_action" && props.entry) {
          props.onQuickAction({
            topic: props.entry.recommendedTopic,
            prompt: props.entry.recommendedPrompt,
            subjectSlug: props.entry.recommendedSubjectSlug,
            sessionMode: props.sessionContract.mode,
            sessionInputKind: props.sessionContract.entryKind,
          });
          return;
        }
        props.onRunNextAction?.();
      }}
      exerciseAnswer={props.exerciseAnswer}
      onExerciseAnswerChange={props.onExerciseAnswerChange}
      onSubmitExercise={props.onSubmitExercise}
      onAdvanceBoardStep={props.onAdvanceBoardStep}
      onRequestSimplerExplanation={props.onRequestSimplerExplanation}
      onRequestAnotherExample={props.onRequestAnotherExample}
      onRequestPractice={props.onRequestPractice}
    />
  );
}
