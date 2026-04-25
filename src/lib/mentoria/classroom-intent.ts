import type { MentoriaClassroomIntent, MentoriaSubject } from "@/lib/mentoria/types";

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function detectMentoriaClassroomIntent(input: {
  message: string;
  subject?: Pick<MentoriaSubject, "name" | "slug"> | null;
  explicitIntent?: MentoriaClassroomIntent | null;
}): MentoriaClassroomIntent {
  if (input.explicitIntent && input.explicitIntent !== "idle") {
    return input.explicitIntent;
  }

  const message = normalizeText(input.message);
  const subjectLabel = normalizeText(input.subject?.name ?? input.subject?.slug ?? "");
  const fullText = `${message} ${subjectLabel}`.trim();

  if (!fullText) return "question";

  if (/(sube|adjunta|te mando|foto|captura|documento|pdf|apunte|archivo)/.test(fullText)) {
    return "document";
  }
  if (/(corrigeme|corrigeme|corrige|correccion|correccion|revisa esto|calificame|ponme nota)/.test(fullText)) {
    return "correction";
  }
  if (/(hazme un examen|simulacro|examen|prueba corta|prueba de)/.test(fullText)) {
    return "exam";
  }
  if (/(hazme una tarea|quiero una tarea|deberes|trabajo|ejercicio para casa|actividad)/.test(fullText)) {
    return "task";
  }
  if (/(practicar|practica|entrenar|otro ejercicio|ponme ejercicios)/.test(fullText)) {
    return "practice";
  }
  if (/(repasar|repaso|recuperar la base|resumen)/.test(fullText)) {
    return "review";
  }
  if (/(bloqueado|bloqueada|me frustro|frustrado|frustrada|no puedo|me supera|agobiado|agobiada)/.test(fullText)) {
    return "frustration";
  }
  if (/(explicame|explica|no entiendo|duda|como se hace|como hago|que significa)/.test(fullText)) {
    return "explanation";
  }

  return "question";
}
