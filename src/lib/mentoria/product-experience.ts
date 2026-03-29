import type {
  DailyPlan,
  FocusSession,
  LearningSession,
  MentoriaGuardianHookEvent,
  MentoriaProgress,
  MentoriaStudentMemorySummary,
  MentoriaSubject,
  MentoriaWorkspaceEntry,
  StudentProfile,
} from "@/lib/mentoria/types";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type { DrakoEventRecord } from "@/lib/drako/metrics";

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
}): MentoriaStudentMemorySummary {
  const weakestProgress = [...input.progress].sort((left, right) => {
    const leftScore = left.masteryScore + left.confidenceScore;
    const rightScore = right.masteryScore + right.confidenceScore;
    return leftScore - rightScore;
  })[0];

  const suggestedDifficulty =
    input.evolution.frustrationLevel > 0.72
      ? "guided"
      : input.evolution.progressionVelocity > 0.72 && input.evolution.consistencyScore > 0.58
        ? "stretch"
        : "steady";

  return {
    commonMistakes: input.evolution.commonMistakes.slice(0, 5),
    watchouts: input.evolution.weaknesses.slice(0, 4),
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
  analysis: { weakSubjects: string[]; strongSubjects: string[]; nextActions: string[] };
}): MentoriaWorkspaceEntry {
  const nextTask = input.dailyPlan?.tasks.find((task) => !task.completed) ?? input.dailyPlan?.tasks[0] ?? null;
  const prioritySubject =
    input.subjects.find((subject) => subject.id === input.memory.nextPrioritySubjectId)
    ?? input.subjects[0]
    ?? null;

  const recommendedPrompt = nextTask
    ? `Quiero avanzar con ${nextTask.subject}. Necesito ayuda para ${nextTask.type === "challenge" ? "resolver un reto" : "entender mejor un paso"}.`
    : prioritySubject
      ? `Quiero repasar ${prioritySubject.name} paso a paso porque sigo teniendo dudas.`
      : "Quiero empezar con una duda que me esta costando.";

  const recommendedTopic =
    nextTask?.subject
    ?? prioritySubject?.name
    ?? input.analysis.weakSubjects[0]
    ?? "Repaso guiado";

  return {
    headline:
      nextTask
        ? `Hoy tu siguiente paso claro es ${nextTask.type === "challenge" ? "cerrar un reto" : "trabajar una base"} en ${nextTask.subject}.`
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
