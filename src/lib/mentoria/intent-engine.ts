import { detectMentoriaClassroomIntent } from "@/lib/mentoria/classroom-intent";
import type { MentoriaBoardMode, MentoriaClassroomIntent, MentoriaSubject } from "@/lib/mentoria/types";

export type MentoriaIntentEngineKind = "explain" | "exercise" | "exam" | "correction" | "chat";

export type MentoriaIntentEngineResult = {
  intent: MentoriaClassroomIntent;
  classroomMode: MentoriaIntentEngineKind;
  boardMode: MentoriaBoardMode;
  tutorInstruction: string;
  nextActionLabel: string;
  requiresStudentAnswer: boolean;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeSlug(value?: string | null) {
  return normalizeText(value ?? "").trim();
}

function tokenizeSubjectAliases(subject: Pick<MentoriaSubject, "slug" | "name">) {
  const aliases = new Set<string>([
    normalizeSlug(subject.slug),
    normalizeSlug(subject.name),
  ]);

  const slug = normalizeSlug(subject.slug);
  const name = normalizeSlug(subject.name);

  if (slug.includes("matematic") || name.includes("matematic")) {
    aliases.add("mates");
    aliases.add("matematicas");
  }
  if (slug.includes("historia") || name.includes("historia")) {
    aliases.add("historia");
  }
  if (slug.includes("ingles") || name.includes("ingles")) {
    aliases.add("ingles");
    aliases.add("english");
  }
  if (slug.includes("lengua") || name.includes("lengua")) {
    aliases.add("lengua");
    aliases.add("language");
  }
  if (slug.includes("ciencia") || slug.includes("science") || name.includes("ciencia") || name.includes("science")) {
    aliases.add("ciencias");
    aliases.add("science");
  }

  return Array.from(aliases).filter(Boolean);
}

export function findMentionedSubjectInMessage(input: {
  message: string;
  subjects: Array<Pick<MentoriaSubject, "slug" | "name">>;
}) {
  const normalizedMessage = normalizeText(input.message);
  if (!normalizedMessage.trim()) return null;

  return input.subjects.find((subject) =>
    tokenizeSubjectAliases(subject).some((alias) => alias && normalizedMessage.includes(alias)),
  ) ?? null;
}

export function assertSubjectMessageConsistency(input: {
  message: string;
  activeSubject: Pick<MentoriaSubject, "slug" | "name">;
  availableSubjects: Array<Pick<MentoriaSubject, "slug" | "name">>;
}) {
  const mentionedSubject = findMentionedSubjectInMessage({
    message: input.message,
    subjects: input.availableSubjects,
  });

  if (!mentionedSubject) return;

  if (normalizeSlug(mentionedSubject.slug) !== normalizeSlug(input.activeSubject.slug)) {
    throw new Error("SUBJECT_CONTEXT_MISMATCH");
  }
}

export function resolveMentoriaIntentEngine(input: {
  message: string;
  subject: Pick<MentoriaSubject, "slug" | "name">;
  explicitIntent?: MentoriaClassroomIntent | null;
}): MentoriaIntentEngineResult {
  const intent = detectMentoriaClassroomIntent({
    message: input.message,
    subject: input.subject,
    explicitIntent: input.explicitIntent,
  });

  if (intent === "exam") {
    return {
      intent,
      classroomMode: "exam",
      boardMode: "exam",
      tutorInstruction:
        "Convierte este turno en un examen real de la materia activa. Devuelve preguntas claras, estructura de simulacro y cierre indicando que esperas las respuestas del alumno.",
      nextActionLabel: "Responde el simulacro y luego pide la correccion.",
      requiresStudentAnswer: true,
    };
  }

  if (intent === "task" || intent === "practice" || intent === "review") {
    return {
      intent,
      classroomMode: "exercise",
      boardMode: intent === "task" ? "task" : "practice",
      tutorInstruction:
        "Convierte este turno en trabajo activo de aula. Genera una tarea o practica concreta, pasos permitidos, formato de respuesta y deja claro que ahora esperas la respuesta del alumno.",
      nextActionLabel: "Escribe tu respuesta y luego pide la correccion.",
      requiresStudentAnswer: true,
    };
  }

  if (intent === "correction") {
    return {
      intent,
      classroomMode: "correction",
      boardMode: "correction",
      tutorInstruction:
        "Convierte este turno en correccion real. Detecta el error principal, explica por que falla, propone una mejora concreta y cierra con una reformulacion que el alumno deba reescribir.",
      nextActionLabel: "Reescribe la respuesta corregida y vuelve a comprobarla.",
      requiresStudentAnswer: false,
    };
  }

  if (intent === "document") {
    return {
      intent,
      classroomMode: "chat",
      boardMode: "document_feedback",
      tutorInstruction:
        "Convierte este turno en revision de material del colegio. Resume el documento, detecta errores o huecos y deja claro que solo trabajas sobre la materia activa.",
      nextActionLabel: "Dime que parte del material quieres repasar ahora.",
      requiresStudentAnswer: false,
    };
  }

  if (intent === "frustration" || intent === "explanation") {
    return {
      intent,
      classroomMode: "explain",
      boardMode: "explanation",
      tutorInstruction:
        "Convierte este turno en explicacion de aula. Da una idea clave, pasos cortos, un ejemplo claro y una pregunta guiada para que el alumno siga dentro de la clase.",
      nextActionLabel: "Responde la pregunta guiada o dime en que paso te atascas.",
      requiresStudentAnswer: false,
    };
  }

  return {
    intent,
    classroomMode: "chat",
    boardMode: "explanation",
    tutorInstruction:
      "No respondas como chat genérico. Convierte el mensaje en una microclase de la materia activa con una explicacion breve, un siguiente paso concreto y una pregunta guiada.",
    nextActionLabel: "Contesta al tutor y seguimos desde ahi.",
    requiresStudentAnswer: false,
  };
}
