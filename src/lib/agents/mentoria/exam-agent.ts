/**
 * Mentoría — Agente Modo Examen
 *
 * Especialista en preparación intensiva pre-examen.
 * Gestiona tres tareas distintas:
 *   1. buildExamPlan — genera el plan de sesiones para los días previos al examen
 *   2. runSimulation — conduce un simulacro cronometrado
 *   3. analyzeWeakTopics — detecta los temas con más errores históricos del alumno
 */

import { runMentoriaLlm } from "@/lib/agents/mentoria/llm-client";
import { buildLevelInstruction } from "@/lib/agents/mentoria/base-agent";
import type { StudentProfile } from "@/lib/mentoria/types";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ExamContext = {
  subjectName: string;
  examDate: string;           // 'YYYY-MM-DD'
  examLabel?: string;
  daysUntilExam: number;
  difficulty: "easy" | "medium" | "hard";
  knownTopics?: string[];     // temas que el alumno ha trabajado
  weakTopics?: string[];      // temas con errores históricos
};

export type ExamDaySession = {
  day: number;                // días antes del examen (4 = 4 días antes)
  date: string;
  sessionLabel: string;
  focusTopics: string[];
  sessionType: "repaso" | "practica" | "simulacro" | "repaso_final";
  durationMinutes: number;
  tutorInstruction: string;
};

export type ExamPlan = {
  totalSessions: number;
  durationDaysTotal: number;
  sessions: ExamDaySession[];
  keyPriorities: string[];
  examTip: string;
};

export type SimulationQuestion = {
  question: string;
  expectedAnswer: string;
  hint: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
};

export type SimulationResult = {
  questions: SimulationQuestion[];
  durationSeconds: number;
  focusTopic: string;
  simulacroLabel: string;
};

export type WeakTopicAnalysis = {
  topic: string;
  errorCount: number;
  priority: "high" | "medium" | "low";
  suggestion: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJsonSafe<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = match?.[1] ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    if (!candidate?.trim().startsWith("{") && !candidate?.trim().startsWith("[")) return null;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      return null;
    }
  }
}

function daysUntil(examDate: string): number {
  const now = new Date();
  const target = new Date(examDate + "T12:00:00Z");
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86400000));
}

function formatDateLabel(examDate: string, daysBack: number): string {
  const d = new Date(examDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

// ─── Build Exam Plan ──────────────────────────────────────────────────────────

export async function buildExamPlan(
  profile: StudentProfile,
  exam: ExamContext,
): Promise<ExamPlan> {
  const days = Math.min(exam.daysUntilExam, 7); // máximo 7 días de preparación
  const levelInstruction = buildLevelInstruction(profile);

  const prompt = `Eres un coordinador pedagógico experto en preparación de exámenes para alumnos de secundaria y bachillerato.

ALUMNO:
${levelInstruction}
Edad: ${profile.age} años. Curso: ${profile.schoolYear}.

EXAMEN:
- Materia: ${exam.subjectName}
- Fecha: ${exam.examDate} (en ${exam.daysUntilExam} días)
- Dificultad percibida: ${exam.difficulty}
${exam.knownTopics?.length ? `- Temas trabajados: ${exam.knownTopics.join(", ")}` : ""}
${exam.weakTopics?.length ? `- Temas con más errores: ${exam.weakTopics.join(", ")}` : ""}

TAREA: Diseña un plan de ${days} sesiones de preparación para los días previos al examen.
Cada sesión debe durar entre 20 y 40 minutos según la proximidad al examen (más cortas el día anterior).
Los simulacros solo a partir de 2 días antes.

Responde SOLO con JSON válido. Sin markdown. Sin texto extra. Exactamente este schema:
{
  "totalSessions": <número>,
  "durationDaysTotal": <días>,
  "sessions": [
    {
      "day": <días antes del examen>,
      "sessionLabel": "<título corto>",
      "focusTopics": ["<tema>"],
      "sessionType": "repaso" | "practica" | "simulacro" | "repaso_final",
      "durationMinutes": <número>,
      "tutorInstruction": "<instrucción breve para el tutor>"
    }
  ],
  "keyPriorities": ["<prioridad>"],
  "examTip": "<consejo final para el alumno>"
}`;

  const result = await runMentoriaLlm({
    messages: [{ role: "user", content: prompt }],
    mode: "smart",
  });

  const parsed = parseJsonSafe<Omit<ExamPlan, "sessions"> & { sessions: Omit<ExamDaySession, "date">[] }>(result.text);

  if (!parsed?.sessions?.length) {
    // Fallback: plan genérico si el LLM falla
    return buildFallbackPlan(exam, days);
  }

  return {
    ...parsed,
    sessions: parsed.sessions.map((s) => ({
      ...s,
      date: formatDateLabel(exam.examDate, s.day),
    })),
  };
}

function buildFallbackPlan(exam: ExamContext, days: number): ExamPlan {
  const sessions: ExamDaySession[] = [];
  for (let i = days; i >= 1; i--) {
    sessions.push({
      day: i,
      date: formatDateLabel(exam.examDate, i),
      sessionLabel: i === 1 ? "Repaso final exprés" : i <= 2 ? `Simulacro día ${days - i + 1}` : `Repaso de ${exam.subjectName}`,
      focusTopics: exam.weakTopics?.slice(0, 2) ?? [exam.subjectName],
      sessionType: i === 1 ? "repaso_final" : i <= 2 ? "simulacro" : "repaso",
      durationMinutes: i === 1 ? 20 : 30,
      tutorInstruction: i === 1
        ? "Repaso exprés de los puntos más débiles. Nada nuevo. Solo afianzar."
        : "Repasa los temas clave con preguntas de práctica.",
    });
  }
  return {
    totalSessions: sessions.length,
    durationDaysTotal: days,
    sessions,
    keyPriorities: exam.weakTopics?.slice(0, 3) ?? ["Repasar los temas principales"],
    examTip: "Duerme bien la noche anterior. Lo que has estudiado ya está en tu cabeza.",
  };
}

// ─── Run Simulation ───────────────────────────────────────────────────────────

export async function buildExamSimulation(
  profile: StudentProfile,
  exam: ExamContext,
  questionsCount: number = 5,
  durationMinutes: number = 15,
): Promise<SimulationResult> {
  const levelInstruction = buildLevelInstruction(profile);
  const focusTopic = exam.weakTopics?.[0] ?? exam.subjectName;

  const prompt = `Eres un generador de simulacros de examen para alumnos de secundaria y bachillerato.

ALUMNO: ${levelInstruction} Edad: ${profile.age} años.
MATERIA: ${exam.subjectName}
TEMA PRIORITARIO: ${focusTopic}
${exam.weakTopics?.length ? `TEMAS CON ERRORES PREVIOS: ${exam.weakTopics.join(", ")}` : ""}
DIFICULTAD: ${exam.difficulty}
NÚMERO DE PREGUNTAS: ${questionsCount}
DURACIÓN: ${durationMinutes} minutos

REGLAS IMPORTANTES:
- Las preguntas deben ser resoluble en el tiempo indicado.
- Mezcla tipos: definición, razonamiento y aplicación práctica.
- No des la respuesta en la pregunta ni en los hints.
- Los hints son una pista útil, no la solución.
- La salida es SOLO JSON válido. Sin texto extra.

Schema exacto:
{
  "questions": [
    {
      "question": "<pregunta completa>",
      "expectedAnswer": "<respuesta esperada>",
      "hint": "<pista útil sin revelar la respuesta>",
      "topic": "<tema>",
      "difficulty": "easy" | "medium" | "hard"
    }
  ],
  "simulacroLabel": "<título del simulacro>"
}`;

  const result = await runMentoriaLlm({
    messages: [{ role: "user", content: prompt }],
    mode: "smart",
  });

  const parsed = parseJsonSafe<Pick<SimulationResult, "questions" | "simulacroLabel">>(result.text);

  if (!parsed?.questions?.length) {
    return {
      questions: [
        {
          question: `Explica el concepto principal de ${focusTopic} con tus propias palabras.`,
          expectedAnswer: "El alumno debe describir el concepto con claridad y precisión.",
          hint: `Piensa en cómo lo has explicado en tus últimas sesiones de ${exam.subjectName}.`,
          topic: focusTopic,
          difficulty: exam.difficulty,
        },
      ],
      durationSeconds: durationMinutes * 60,
      focusTopic,
      simulacroLabel: `Simulacro de ${exam.subjectName}`,
    };
  }

  return {
    questions: parsed.questions,
    durationSeconds: durationMinutes * 60,
    focusTopic,
    simulacroLabel: parsed.simulacroLabel ?? `Simulacro de ${exam.subjectName}`,
  };
}

// ─── Analyze Weak Topics ──────────────────────────────────────────────────────

export async function analyzeWeakTopics(
  profile: StudentProfile,
  subjectName: string,
  errorHistory: string[],   // lista de temas donde el alumno ha fallado, en orden cronológico
): Promise<WeakTopicAnalysis[]> {
  if (errorHistory.length === 0) return [];

  const levelInstruction = buildLevelInstruction(profile);

  const prompt = `Eres un analista pedagógico. Analiza los errores históricos de un alumno para identificar sus puntos débiles.

ALUMNO: ${levelInstruction}
MATERIA: ${subjectName}
HISTORIAL DE ERRORES (más recientes al final):
${errorHistory.map((e, i) => `${i + 1}. ${e}`).join("\n")}

TAREA: Identifica los 3-5 temas con más errores y priorízalos para el repaso.

SOLO JSON válido. Sin texto extra:
{
  "weakTopics": [
    {
      "topic": "<nombre del tema>",
      "errorCount": <número estimado>,
      "priority": "high" | "medium" | "low",
      "suggestion": "<qué debería hacer el alumno para mejorar este tema>"
    }
  ]
}`;

  const result = await runMentoriaLlm({
    messages: [{ role: "user", content: prompt }],
    mode: "fast",
  });

  const parsed = parseJsonSafe<{ weakTopics: WeakTopicAnalysis[] }>(result.text);
  return parsed?.weakTopics ?? [];
}

// ─── Días hasta examen (helper exportado) ─────────────────────────────────────

export { daysUntil };
