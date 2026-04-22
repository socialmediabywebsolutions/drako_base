import type {
  DailyPlan,
  FocusSession,
  LearningSession,
  MentoriaDailyClosureSummary,
  MentoriaGuardianHookEvent,
  MentoriaProgress,
  MentoriaStudentMemorySummary,
  MentoriaStudentSubjectMemory,
  MentoriaSubject,
  MentoriaWorkspaceEntry,
  StudentProfile,
} from "@/lib/mentoria/types";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type { DrakoEventRecord } from "@/lib/drako/metrics";
import type { MotivationState } from "@/lib/mentoria/motivation-engine";
import { humanizeConceptKey, rankFragileSubjectMemories } from "@/lib/mentoria/student-subject-memory";

type InferSubjectInput = {
  requestedSubjectSlug?: string | null;
  topic?: string | null;
  message: string;
  subjects: MentoriaSubject[];
  dailyPlan?: DailyPlan | null;
  evolution?: StudentEvolutionProfile | null;
};

type InferSubjectResult = {
  subject: MentoriaSubject;
  topic: string;
  reason: "manual" | "message_match" | "daily_plan_priority" | "memory_priority" | "default";
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isoDay(value?: string | null): string | null {
  return value ? value.slice(0, 10) : null;
}

function taskTypeLabel(type: DailyPlan["tasks"][number]["type"]): string {
  if (type === "review") return "repaso guiado";
  if (type === "challenge") return "reto corto";
  return "practica guiada";
}

function buildTaskCarryOver(task: DailyPlan["tasks"][number]) {
  return {
    carryOverPrompt:
      task.type === "review"
        ? `Quiero repasar ${task.subject} paso a paso y ver que debo vigilar hoy.`
        : task.type === "challenge"
          ? `Quiero un reto corto de ${task.subject} para comprobar si ya lo domino.`
          : `Quiero practicar ${task.subject} con una actividad guiada de dificultad ${task.difficulty}.`,
    carryOverTopic: task.type === "review" ? `Repaso de ${task.subject}` : task.subject,
    carryOverSubjectId: task.subjectId ?? null,
  };
}

function isDailyClosureSummary(value: unknown): value is MentoriaDailyClosureSummary {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.closureDate === "string"
    && typeof record.title === "string"
    && typeof record.summary === "string"
    && typeof record.completionRate === "number"
    && typeof record.completedTasks === "number"
    && typeof record.totalTasks === "number";
}

function extractTopic(message: string, fallbackSubjectName: string): string {
  const cleaned = message
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[¿?¡!.,\s]+|[¿?¡!.,\s]+$/g, "");

  if (!cleaned) {
    return `Repasar ${fallbackSubjectName}`;
  }

  const direct = cleaned.length > 72 ? `${cleaned.slice(0, 69).trim()}...` : cleaned;
  return direct;
}

function scoreSubject(subject: MentoriaSubject, input: InferSubjectInput): number {
  const haystack = normalize(`${input.topic ?? ""} ${input.message}`);
  const subjectName = normalize(subject.name);
  const subjectSlug = normalize(subject.slug);
  let score = 0;

  if (haystack.includes(subjectName)) score += 7;
  if (haystack.includes(subjectSlug)) score += 6;

  const topicTokens = subjectName.split(/\s+/).filter((token) => token.length > 3);
  for (const token of topicTokens) {
    if (haystack.includes(token)) score += 2;
  }

  for (const task of input.dailyPlan?.tasks ?? []) {
    const taskSubject = normalize(task.subject);
    if (task.subjectId === subject.id) {
      score += task.completed ? 1 : 5;
    } else if (taskSubject && (taskSubject.includes(subjectName) || subjectName.includes(taskSubject))) {
      score += task.completed ? 1 : 4;
    }
  }

  for (const weakness of input.evolution?.weaknesses ?? []) {
    const normalizedWeakness = normalize(weakness);
    if (normalizedWeakness.includes(subjectName) || normalizedWeakness.includes(subjectSlug)) {
      score += 4;
    }
  }

  return score;
}

export function inferSubjectAndTopic(input: InferSubjectInput): InferSubjectResult {
  const requested = input.requestedSubjectSlug
    ? input.subjects.find((subject) => normalize(subject.slug) === normalize(input.requestedSubjectSlug ?? ""))
    : null;

  if (requested) {
    return {
      subject: requested,
      topic: (input.topic ?? "").trim() || extractTopic(input.message, requested.name),
      reason: "manual",
    };
  }

  const scored = input.subjects
    .map((subject) => ({ subject, score: scoreSubject(subject, input) }))
    .sort((left, right) => right.score - left.score);

  const best = scored[0]?.subject ?? input.subjects[0];
  const bestScore = scored[0]?.score ?? 0;
  const topic = (input.topic ?? "").trim() || extractTopic(input.message, best?.name ?? "la materia");

  if (!best) {
    throw new Error("SUBJECT_NOT_FOUND");
  }

  if (bestScore >= 7) {
    return { subject: best, topic, reason: "message_match" };
  }
  if ((input.dailyPlan?.tasks ?? []).some((task) => task.subjectId === best.id && !task.completed)) {
    return { subject: best, topic, reason: "daily_plan_priority" };
  }
  if ((input.evolution?.weaknesses ?? []).some((weakness: string) => normalize(weakness).includes(normalize(best.name)))) {
    return { subject: best, topic, reason: "memory_priority" };
  }
  return { subject: best, topic, reason: "default" };
}

export function buildStudentMemorySummary(input: {
  evolution: StudentEvolutionProfile;
  progress: MentoriaProgress[];
  dailyPlan?: DailyPlan | null;
  subjectMemories?: MentoriaStudentSubjectMemory[];
}): MentoriaStudentMemorySummary {
  const weakestProgress = [...input.progress].sort((left, right) => {
    const leftScore = left.masteryScore + left.confidenceScore;
    const rightScore = right.masteryScore + right.confidenceScore;
    return leftScore - rightScore;
  })[0];
  const fragileConcepts = rankFragileSubjectMemories(input.subjectMemories ?? []).slice(0, 3);
  const conceptWatchouts = fragileConcepts.map((item) => `${humanizeConceptKey(item.conceptKey)} (${item.subjectSlug})`);
  const conceptMistakes = fragileConcepts
    .map((item) => item.lastErrorType ? `${humanizeConceptKey(item.conceptKey)}: ${item.lastErrorType}` : humanizeConceptKey(item.conceptKey))
    .slice(0, 3);
  const consolidatedWatchouts = Array.from(new Set([...conceptWatchouts, ...input.evolution.weaknesses])).slice(0, 4);
  const consolidatedMistakes = Array.from(new Set([...conceptMistakes, ...input.evolution.commonMistakes])).slice(0, 5);

  const suggestedDifficulty =
    fragileConcepts.some((item) => item.needsReinforcement)
      ? "guided"
      : input.evolution.frustrationLevel > 0.72
      ? "guided"
      : input.evolution.progressionVelocity > 0.72 && input.evolution.consistencyScore > 0.58
        ? "stretch"
        : "steady";

  return {
    commonMistakes: consolidatedMistakes,
    watchouts: consolidatedWatchouts,
    strengths: input.evolution.strengths.slice(0, 4),
    suggestedDifficulty,
    nextPrioritySubjectId: weakestProgress?.subjectId,
    nextPriorityTask:
      input.dailyPlan?.tasks.find((task) => !task.completed)?.subject ??
      input.dailyPlan?.tasks[0]?.subject ??
      null,
  };
}

export function buildWorkspaceEntry(input: {
  student: StudentProfile;
  subjects: MentoriaSubject[];
  progress: MentoriaProgress[];
  dailyPlan?: DailyPlan | null;
  memory: MentoriaStudentMemorySummary;
  subjectMemories?: MentoriaStudentSubjectMemory[];
  analysis: { weakSubjects: string[]; strongSubjects: string[]; nextActions: string[] };
}): MentoriaWorkspaceEntry {
  const nextTask = input.dailyPlan?.tasks.find((task) => !task.completed) ?? input.dailyPlan?.tasks[0] ?? null;
  const prioritySubject =
    input.subjects.find((subject) => subject.id === input.memory.nextPrioritySubjectId)
    ?? input.subjects[0]
    ?? null;
  const priorityConcept = rankFragileSubjectMemories(input.subjectMemories ?? []).find((item) => item.needsReinforcement) ?? null;
  const priorityConceptLabel = priorityConcept ? humanizeConceptKey(priorityConcept.conceptKey) : null;

  const recommendedPrompt = nextTask
    ? `Quiero avanzar con ${nextTask.subject}. Necesito ayuda para ${nextTask.type === "challenge" ? "resolver un reto" : "entender mejor un paso"}.`
    : priorityConceptLabel && prioritySubject
      ? `Quiero repasar ${priorityConceptLabel} en ${prioritySubject.name} paso a paso porque ahi sigo fallando.`
    : prioritySubject
      ? `Quiero repasar ${prioritySubject.name} paso a paso porque sigo teniendo dudas.`
      : "Quiero empezar con una duda que me esta costando.";

  const recommendedTopic =
    priorityConceptLabel
    ?? nextTask?.subject
    ?? prioritySubject?.name
    ?? input.analysis.weakSubjects[0]
    ?? "Repaso guiado";

  return {
    headline:
      nextTask
        ? `Hoy tu siguiente paso claro es ${nextTask.type === "challenge" ? "cerrar un reto" : "trabajar una base"} en ${nextTask.subject}.`
        : priorityConceptLabel && prioritySubject
          ? `Hoy conviene recuperar ${priorityConceptLabel} dentro de ${prioritySubject.name}.`
        : "Empieza por una duda concreta y Mentoria te llevara paso a paso.",
    subheadline:
      input.analysis.nextActions[0]
      ?? "Escribe tu duda tal como te sale y el tutor elegira una forma clara de ayudarte.",
    recommendedSubjectSlug: prioritySubject?.slug ?? null,
    recommendedTopic,
    recommendedPrompt,
    quickActions: [
      {
        id: "start_tutor",
        label: "Empezar con el tutor",
        description: "Abrir una sesion guiada con la materia prioritaria.",
        subjectSlug: prioritySubject?.slug ?? null,
        topic: recommendedTopic,
        prompt: recommendedPrompt,
      },
      {
        id: "do_practice",
        label: "Practicar ahora",
        description: "Generar un ejercicio corto sobre la materia que mas necesita refuerzo.",
        subjectSlug: prioritySubject?.slug ?? null,
        topic: recommendedTopic,
        prompt: `Quiero practicar ${recommendedTopic} con una pregunta guiada.`,
      },
      {
        id: "close_plan",
        label: "Cerrar el plan de hoy",
        description: nextTask ? `Completar ${nextTask.subject} antes de terminar.` : "Elegir una tarea sencilla para mantener la racha.",
        subjectSlug: prioritySubject?.slug ?? null,
        topic: recommendedTopic,
        prompt: `Ayudame a completar la tarea de hoy sobre ${recommendedTopic}.`,
      },
    ],
  };
}

export function buildDailyClosureSummary(input: {
  student: StudentProfile;
  progress: MentoriaProgress[];
  dailyPlan?: DailyPlan | null;
  motivation?: MotivationState | null;
  recentSessions: LearningSession[];
  focusSessions: FocusSession[];
  events?: DrakoEventRecord[];
  todayIso?: string;
}): MentoriaDailyClosureSummary | null {
  const todayIso = input.todayIso ?? new Date().toISOString().slice(0, 10);
  const latestSession = input.recentSessions[0] ?? null;
  const latestFocus = input.focusSessions[0] ?? null;
  const lastProgress = input.progress.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
  const lastActivityAt =
    latestSession?.updatedAt
    ?? latestFocus?.updatedAt
    ?? input.motivation?.lastActivityAt
    ?? lastProgress?.updatedAt
    ?? null;
  const latestClosureEvent = (input.events ?? []).find((event) => event.type === "mentoria_daily_closure");
  const eventMetadata = latestClosureEvent
    ? ((latestClosureEvent.payload as Record<string, unknown> | undefined)?.metadata ?? null)
    : null;
  const persistedClosure = isDailyClosureSummary(eventMetadata) ? eventMetadata : null;
  const hasStartedToday =
    (input.dailyPlan?.completedTaskIds.length ?? 0) > 0
    || isoDay(lastActivityAt) === todayIso;

  if (persistedClosure && persistedClosure.closureDate < todayIso && !hasStartedToday) {
    return {
      ...persistedClosure,
      source: "event",
    };
  }

  if (!input.dailyPlan) {
    return persistedClosure ? { ...persistedClosure, source: "event" } : null;
  }

  const completedTasks = input.dailyPlan.completedTaskIds.length;
  const totalTasks = input.dailyPlan.tasks.length;
  const completionRate = input.dailyPlan.completionRate;
  const nextPendingTask = input.dailyPlan.tasks.find((task) => !task.completed) ?? null;
  const carryOver =
    latestSession?.recommendedNextStep
      ? {
          carryOverPrompt: latestSession.recommendedNextStep,
          carryOverTopic: latestSession.topic || nextPendingTask?.subject || null,
          carryOverSubjectId: latestSession.subjectId,
        }
      : nextPendingTask
        ? buildTaskCarryOver(nextPendingTask)
        : {
            carryOverPrompt: null,
            carryOverTopic: null,
            carryOverSubjectId: null,
          };
  const activityLabel =
    latestSession
      ? `cerraste una sesion en ${latestSession.topic || "tu materia prioritaria"}`
      : latestFocus
        ? `cerraste un bloque de foco de ${latestFocus.durationMinutes} minutos`
        : "dejaste actividad registrada";

  if (completionRate >= 1) {
    return {
      closureDate: todayIso,
      source: "live",
      status: "completed",
      title: "Hoy has cerrado algo importante y manana puedes subir un paso",
      summary:
        carryOver.carryOverPrompt
          ? `Has completado ${completedTasks} de ${totalTasks} tareas y ${activityLabel}. Se nota el avance: manana no volveras a arrancar desde cero y ya queda preparado "${carryOver.carryOverPrompt}".`
          : `Has completado ${completedTasks} de ${totalTasks} tareas y ${activityLabel}. Se nota el avance y el sistema ya puede proponerte un siguiente paso con mas ambicion manana.`,
      carryOverPrompt: carryOver.carryOverPrompt,
      carryOverTopic: carryOver.carryOverTopic,
      carryOverSubjectId: carryOver.carryOverSubjectId,
      completionRate,
      completedTasks,
      totalTasks,
      lastActivityAt,
    };
  }

  if (input.motivation?.motivationProfile === "fragile") {
    return {
      closureDate: todayIso,
      source: "live",
      status: "needs_support",
      title: "Hoy has protegido el ritmo y manana volveras con una entrada amable",
      summary:
        nextPendingTask
          ? `Hoy has cerrado ${completedTasks} de ${totalTasks} tareas. Eso ya cuenta: manana queda preparado ${nextPendingTask.subject} - ${taskTypeLabel(nextPendingTask.type)} con una entrada mas guiada para que recuperes confianza rapido.`
          : "Hoy hubo avance, y manana conviene volver con una accion sencilla y clara para coger ritmo sin presion.",
      carryOverPrompt: carryOver.carryOverPrompt,
      carryOverTopic: carryOver.carryOverTopic,
      carryOverSubjectId: carryOver.carryOverSubjectId,
      completionRate,
      completedTasks,
      totalTasks,
      lastActivityAt,
    };
  }

  if (completedTasks > 0) {
    return {
      closureDate: todayIso,
      source: "live",
      status: "in_progress",
      title: "Hoy has dejado avance real y manana seguiras con ventaja",
      summary:
        nextPendingTask
          ? `Hoy has cerrado ${completedTasks} de ${totalTasks} tareas y ya has ganado traccion. El siguiente paso natural queda preparado: ${nextPendingTask.subject} - ${taskTypeLabel(nextPendingTask.type)}.`
          : "Hoy has dejado avance real y el sistema ya tiene contexto para continuar manana sin reconstruir todo desde cero.",
      carryOverPrompt: carryOver.carryOverPrompt,
      carryOverTopic: carryOver.carryOverTopic,
      carryOverSubjectId: carryOver.carryOverSubjectId,
      completionRate,
      completedTasks,
      totalTasks,
      lastActivityAt,
    };
  }

  return {
    closureDate: todayIso,
    source: "live",
    status: "incomplete",
    title: "Hoy no ha quedado un cierre fuerte, pero manana no empezaras desde cero",
    summary:
      nextPendingTask
        ? `Conviene dejar preparado ${nextPendingTask.subject} - ${taskTypeLabel(nextPendingTask.type)} para que manana el arranque sea mas claro y te resulte mas facil volver.`
        : "Conviene dejar un siguiente paso muy claro para que manana no parezca un reinicio generico.",
    carryOverPrompt: carryOver.carryOverPrompt,
    carryOverTopic: carryOver.carryOverTopic,
    carryOverSubjectId: carryOver.carryOverSubjectId,
    completionRate,
    completedTasks,
    totalTasks,
    lastActivityAt,
  };
}

function buildActivityEvent(input: {
  category: MentoriaGuardianHookEvent["category"];
  title: string;
  summary: string;
  severity?: MentoriaGuardianHookEvent["severity"];
  metadata?: Record<string, unknown>;
  createdAt: string;
}): MentoriaGuardianHookEvent {
  return {
    id: crypto.randomUUID(),
    category: input.category,
    title: input.title,
    summary: input.summary,
    severity: input.severity ?? "info",
    metadata: input.metadata ?? {},
    createdAt: input.createdAt,
  };
}

export function buildGuardianHookEvents(input: {
  student: StudentProfile;
  progress: MentoriaProgress[];
  recentSessions: LearningSession[];
  focusSessions: FocusSession[];
  interventions: Array<{ id: string; severity: string; summary: string; type: string; status: string; createdAt: string }>;
  events: DrakoEventRecord[];
}): MentoriaGuardianHookEvent[] {
  const feed: MentoriaGuardianHookEvent[] = [];
  const latestSession = input.recentSessions[0];
  const latestFocus = input.focusSessions[0];

  if (latestSession) {
    feed.push(
      buildActivityEvent({
        category: "activity",
        title: "Sesion guiada completada",
        summary: `${input.student.fullName} trabajo ${latestSession.topic || "una materia"} y salio con un siguiente paso concreto.`,
        metadata: {
          sessionId: latestSession.id,
          subjectId: latestSession.subjectId,
          recommendedNextStep: latestSession.recommendedNextStep,
        },
        createdAt: latestSession.updatedAt,
      }),
    );
  }

  if (latestFocus) {
    feed.push(
      buildActivityEvent({
        category: "activity",
        title: "Bloque de foco registrado",
        summary: `${input.student.fullName} completo ${latestFocus.durationMinutes} minutos de foco con ${latestFocus.distractionsCount} distracciones.`,
        metadata: {
          focusSessionId: latestFocus.id,
          durationMinutes: latestFocus.durationMinutes,
          distractionsCount: latestFocus.distractionsCount,
        },
        createdAt: latestFocus.updatedAt,
      }),
    );
  }

  for (const progress of input.progress.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 2)) {
    feed.push(
      buildActivityEvent({
        category: "progress",
        title: "Actualizacion de progreso",
        summary: `Dominio ${progress.masteryScore}% y confianza ${progress.confidenceScore}% en una de sus materias activas.`,
        metadata: {
          progressId: progress.id,
          subjectId: progress.subjectId,
          masteryScore: progress.masteryScore,
          confidenceScore: progress.confidenceScore,
        },
        createdAt: progress.updatedAt,
      }),
    );
  }

  for (const intervention of input.interventions.filter((item) => item.status === "active").slice(0, 2)) {
    feed.push(
      buildActivityEvent({
        category: "alert",
        title: "Alerta de acompanamiento",
        summary: intervention.summary,
        severity:
          intervention.severity === "critical" || intervention.severity === "high"
            ? "high"
            : intervention.severity === "medium"
              ? "medium"
              : "info",
        metadata: {
          interventionId: intervention.id,
          type: intervention.type,
        },
        createdAt: intervention.createdAt,
      }),
    );
  }

  for (const event of input.events.slice(0, 4)) {
    if (event.type.includes("progress") || event.type.includes("session") || event.type.includes("exercise")) {
      feed.push(
        buildActivityEvent({
          category: event.type.includes("progress") ? "progress" : "activity",
          title: String((event.payload as Record<string, unknown>).name ?? event.type),
          summary: String(((event.payload as Record<string, unknown>).metadata as Record<string, unknown> | undefined)?.subject ?? "Actividad reciente registrada"),
          metadata: event.payload,
          createdAt: event.createdAt,
        }),
      );
    }
  }

  return feed
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 8);
}

export function buildImageAssetId(fileName: string, digestHex: string): string {
  const normalizedName = normalize(fileName).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `mentoria_img_${normalizedName || "upload"}_${digestHex.slice(0, 12)}`;
}

export function summarizeImagePurpose(notes: string | null | undefined): string {
  const trimmed = (notes ?? "").trim();
  if (!trimmed) {
    return "El alumno adjunto una imagen pendiente de interpretacion futura.";
  }
  return trimmed.length > 160 ? `${trimmed.slice(0, 157).trim()}...` : trimmed;
}
