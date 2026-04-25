import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { MentoriaWorkspace } from "@/components/mentoria-app/workspace";

const fetchMock = vi.spyOn(global, "fetch");
const navigationMock = vi.hoisted(() => ({
  searchParams: {
    get: vi.fn((_name: string) => null),
  },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => navigationMock.searchParams,
}));

vi.mock("@/components/mentoria-app/focus-mode", () => ({
  MentoriaFocusMode: () => React.createElement("div", null, "focus-mode"),
}));

globalThis.React = React;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setSearchParams(params: Record<string, string | null | undefined>) {
  navigationMock.searchParams.get.mockImplementation((name: string) => params[name] ?? null);
}

function buildStudentSubject(input: { id: string; subjectId: string; slug: string; name: string; description: string }) {
  return {
    id: input.id,
    tenantId: "tenant_mentoria",
    studentProfileId: "student_1",
    subjectId: input.subjectId,
    initialLevel: "voy_normal",
    currentLevel: "voy_normal",
    createdAt: "2026-04-03T00:00:00.000Z",
    updatedAt: "2026-04-03T00:00:00.000Z",
    subject: {
      id: input.subjectId,
      tenantId: "tenant_mentoria",
      slug: input.slug,
      name: input.name,
      description: input.description,
      difficultyBand: "core",
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
    },
  };
}

const mathSubject = buildStudentSubject({
  id: "student_subject_math",
  subjectId: "subject_matematicas",
  slug: "matematicas",
  name: "Matematicas",
  description: "Refuerzo guiado",
});

const historySubject = buildStudentSubject({
  id: "student_subject_history",
  subjectId: "subject_historia",
  slug: "historia",
  name: "Historia",
  description: "Contexto y pensamiento critico",
});

const englishSubject = buildStudentSubject({
  id: "student_subject_english",
  subjectId: "subject_ingles",
  slug: "ingles",
  name: "Ingles",
  description: "Comprension y expresion",
});

function buildWorkspaceResponse(overrides?: Record<string, unknown>) {
  return {
    ok: true,
    student: {
      id: "student_1",
      tenantId: "tenant_mentoria",
      userId: "user_mentoria",
      learningStage: "eso",
      fullName: "Alex",
      name: "Alex",
      age: 13,
      schoolYear: "2 ESO",
      learningGoals: ["Entender mejor matematicas"],
      baseEmotionalState: "steady",
      emotionalBaseline: "balanced",
      learningPreference: "step_by_step",
      preferredStudyMinutes: 30,
      strengths: ["Curiosidad"],
      supportNotes: "Onboarding completado",
      onboardingCompleted: true,
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
    },
    studentSubjects: [mathSubject],
    progress: [],
    analysis: {
      weakSubjects: [],
      strongSubjects: [],
      nextActions: ["Resolver un ejercicio guiado"],
    },
    currentPlan: null,
    exercises: [],
    motivation: null,
    dailyPlan: null,
    billing: null,
    recentSessions: [],
    focusSessions: [],
    entry: {
      headline: "Empieza por una duda concreta",
      subheadline: "El tutor te guiara sin darte la respuesta final.",
      recommendedSubjectSlug: "matematicas",
      recommendedTopic: "Fracciones",
      recommendedPrompt: "Quiero repasar fracciones paso a paso.",
      quickActions: [],
    },
    memory: {
      commonMistakes: [],
      watchouts: [],
      strengths: [],
      suggestedDifficulty: "guided",
      nextPrioritySubjectId: null,
      nextPriorityTask: null,
    },
    evolution: null,
    growth: null,
    dailyClosure: null,
    guardianHooks: [],
    behavioralRollout: "shadow_only",
    behavioralShadow: null,
    ...overrides,
  };
}

function buildBoardUpdate(input: {
  subjectSlug: string;
  subjectName: string;
  topic: string;
  intent: "explanation" | "exam" | "task" | "correction";
  mode: "explanation" | "exam" | "task" | "correction";
  conceptDefinition?: string | null;
  explanation?: string[];
  steps?: string[];
  example?: string | null;
  correction?: string | null;
  guidedQuestion?: string | null;
  task?: { title: string; prompt: string; allowedSteps: string[]; answerFormat?: string | null } | null;
  exam?: { title: string; questions: string[]; timeLimitMinutes?: number | null; scoring?: string | null; score?: number | null; maxScore?: number | null; recommendations?: string[] } | null;
}) {
  return {
    studentId: "student_1",
    subjectSlug: input.subjectSlug,
    subjectName: input.subjectName,
    studentName: "Alex",
    schoolYear: "2 ESO",
    topic: input.topic,
    intent: input.intent,
    mode: input.mode,
    conceptDefinition: input.conceptDefinition ?? null,
    explanation: input.explanation ?? [],
    steps: input.steps ?? [],
    example: input.example ?? null,
    formula: null,
    diagram: null,
    exercise: null,
    task: input.task ?? null,
    exam: input.exam ?? null,
    correction: input.correction ?? null,
    documentFeedback: null,
    note: null,
    guidedQuestion: input.guidedQuestion ?? null,
    nextAction: input.guidedQuestion ?? "Sigue con la siguiente pregunta.",
    updatedAt: "2026-04-25T10:00:00.000Z",
  };
}

describe("MentoriaWorkspace", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    navigationMock.searchParams.get.mockImplementation((_name: string) => null);
  });

  it("shows a loading shell during the first workspace fetch", async () => {
    let resolveFetch: ((value: Response) => void) | null = null;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(React.createElement(MentoriaWorkspace));

    expect(await screen.findByText("Workspace del alumno")).toBeInTheDocument();
    expect(screen.getByText("Cargando Mentoria...")).toBeInTheDocument();

    resolveFetch?.(jsonResponse(buildWorkspaceResponse()));

    expect(await screen.findByRole("heading", { name: "Hola, Alex" })).toBeInTheDocument();
  });

  it("renders a clean classroom, keeps academic life outside the board and removes the dead attach button", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        buildWorkspaceResponse({
          studentSubjects: [mathSubject, historySubject],
          records: [{ id: "record_1", title: "Examen real del colegio" }],
          documents: [{ id: "document_1", fileName: "nota.pdf", notesText: "nota cruda" }],
        }),
      ),
    );

    render(React.createElement(MentoriaWorkspace));

    expect(await screen.findByRole("heading", { name: "Hola, Alex" })).toBeInTheDocument();
    expect(screen.getByText("Escribe al tutor qué quieres trabajar.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Escribe tu duda o cuéntame qué no entendiste")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Adjuntar/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Vida académica" })[0]).toHaveAttribute("href", "/mentoria/app/academic");
    expect(screen.queryByText("Examen real del colegio")).not.toBeInTheDocument();
    expect(screen.queryByText("nota.pdf")).not.toBeInTheDocument();
  });

  it("sends direct chat messages through /api/mentoria/chat with the active subject", async () => {
    setSearchParams({ subjectSlug: "matematicas" });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse()))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          tutorMessage: "Vale, vamos paso a paso.",
          reply: "Vale, vamos paso a paso.",
          subject: { name: "Matematicas", slug: "matematicas" },
          boardUpdate: buildBoardUpdate({
            subjectSlug: "matematicas",
            subjectName: "Matematicas",
            topic: "Fracciones",
            intent: "explanation",
            mode: "explanation",
            conceptDefinition: "Primero compara denominadores.",
            explanation: ["Mira el denominador antes de operar."],
            steps: ["Compara denominadores"],
            example: "Ejemplo guiado con fracciones equivalentes.",
            guidedQuestion: "Que cambia entre ambas fracciones?",
          }),
          session: { id: "session_1", topic: "Fracciones", recommendedNextStep: "Prueba un ejemplo corto." },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse()));

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    fireEvent.change((await screen.findAllByRole("textbox"))[0], {
      target: { value: "No entiendo fracciones" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Vale, vamos paso a paso.")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/mentoria/chat");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      studentId: "student_1",
      subjectSlug: "matematicas",
      message: "No entiendo fracciones",
      topic: "Matematicas",
    });
  });

  it("renders a matematicas explanation board for 'No entiendo fracciones'", async () => {
    setSearchParams({ subjectSlug: "matematicas" });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse()))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          tutorMessage: "Vamos a verlo con calma.",
          reply: "Vamos a verlo con calma.",
          subject: { name: "Matematicas", slug: "matematicas" },
          boardUpdate: buildBoardUpdate({
            subjectSlug: "matematicas",
            subjectName: "Matematicas",
            topic: "Fracciones",
            intent: "explanation",
            mode: "explanation",
            conceptDefinition: "Una fraccion compara partes del mismo tamaño.",
            explanation: ["Primero compara el denominador y luego el numerador."],
            steps: ["Mira el denominador", "Mira el numerador"],
            example: "Ejemplo guiado con dos fracciones equivalentes.",
            guidedQuestion: "Cual es la parte que mas te cuesta?",
          }),
          session: { id: "session_math", topic: "Fracciones", recommendedNextStep: "Prueba una comparacion corta." },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse()));

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    fireEvent.change((await screen.findAllByRole("textbox"))[0], {
      target: { value: "No entiendo fracciones" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Una fraccion compara partes del mismo tamaño.")).toBeInTheDocument();
    expect(screen.getByText("Ejemplo guiado con dos fracciones equivalentes.")).toBeInTheDocument();
    expect(screen.queryByText("Historia")).not.toBeInTheDocument();
  });

  it("renders a Historia exam board and keeps the context in Historia", async () => {
    setSearchParams({ subjectSlug: "historia" });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse({ studentSubjects: [mathSubject, historySubject] })))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          tutorMessage: "Vamos con un simulacro corto de Historia.",
          reply: "Vamos con un simulacro corto de Historia.",
          subject: { name: "Historia", slug: "historia" },
          boardUpdate: buildBoardUpdate({
            subjectSlug: "historia",
            subjectName: "Historia",
            topic: "Revolucion francesa",
            intent: "exam",
            mode: "exam",
            conceptDefinition: "Vamos a simular un examen corto de Historia.",
            explanation: ["Responde con contexto, causa y consecuencia."],
            steps: ["Situa el contexto", "Explica una causa", "Explica una consecuencia"],
            exam: {
              title: "Simulacro corto de Historia",
              questions: ["1. Que pasaba antes de 1789?", "2. Cual fue una causa clave?", "3. Que consecuencia destacas?"],
              timeLimitMinutes: 12,
              scoring: "Se valora claridad, procedimiento y precision.",
              score: null,
              maxScore: 10,
              recommendations: [],
            },
          }),
          session: { id: "session_historia", topic: "Revolucion francesa", recommendedNextStep: "Responde la primera pregunta." },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse({ studentSubjects: [mathSubject, historySubject] })));

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    fireEvent.change(screen.getByPlaceholderText("Escribe tu duda o cuéntame qué no entendiste"), {
      target: { value: "Hazme un examen de Historia" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Simulacro corto de Historia")).toBeInTheDocument();
    expect(screen.getByText("1. Que pasaba antes de 1789?")).toBeInTheDocument();
    expect(screen.queryByText("Ejemplo guiado con fracciones equivalentes.")).not.toBeInTheDocument();
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      studentId: "student_1",
      subjectSlug: "historia",
      message: "Hazme un examen de Historia",
      topic: "Historia",
    });
  });

  it("renders an Ingles task board and keeps the context in Ingles", async () => {
    setSearchParams({ subjectSlug: "ingles" });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse({ studentSubjects: [mathSubject, englishSubject] })))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          tutorMessage: "Te preparo una tarea corta de Ingles.",
          reply: "Te preparo una tarea corta de Ingles.",
          subject: { name: "Ingles", slug: "ingles" },
          boardUpdate: buildBoardUpdate({
            subjectSlug: "ingles",
            subjectName: "Ingles",
            topic: "Present simple",
            intent: "task",
            mode: "task",
            conceptDefinition: "Hoy vamos a resolver una tarea real de Ingles.",
            explanation: ["Usa frases cortas y fíjate en la estructura."],
            steps: ["Lee el enunciado", "Escribe en present simple", "Revisa el verbo"],
            task: {
              title: "Tarea guiada de Ingles",
              prompt: "Escribe tres frases en present simple sobre tu rutina.",
              allowedSteps: ["Piensa el sujeto", "Elige el verbo", "Revisa la forma correcta"],
              answerFormat: "Respuesta breve con idea principal y justificacion",
            },
          }),
          session: { id: "session_english", topic: "Present simple", recommendedNextStep: "Escribe tu primera frase." },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse({ studentSubjects: [mathSubject, englishSubject] })));

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    fireEvent.change(screen.getByPlaceholderText("Escribe tu duda o cuéntame qué no entendiste"), {
      target: { value: "Quiero una tarea de Inglés" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Tarea guiada de Ingles")).toBeInTheDocument();
    expect(screen.getByText("Escribe tres frases en present simple sobre tu rutina.")).toBeInTheDocument();
    expect(screen.queryByText("Historia")).not.toBeInTheDocument();
  });

  it("clears the previous classroom when the student switches from Historia to Matematicas", async () => {
    setSearchParams({ subjectSlug: "historia" });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse({ studentSubjects: [mathSubject, historySubject] })))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          tutorMessage: "Primero situamos el contexto historico.",
          reply: "Primero situamos el contexto historico.",
          subject: { name: "Historia", slug: "historia" },
          boardUpdate: buildBoardUpdate({
            subjectSlug: "historia",
            subjectName: "Historia",
            topic: "Revolucion francesa",
            intent: "explanation",
            mode: "explanation",
            conceptDefinition: "Primero situamos el contexto historico.",
            explanation: ["Mira la crisis economica y social previa."],
            steps: ["Ubica el contexto previo"],
            example: "Ejemplo guiado con causas y consecuencias.",
          }),
          session: { id: "session_historia", topic: "Revolucion francesa", recommendedNextStep: "Explica el contexto." },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse({ studentSubjects: [mathSubject, historySubject] })))
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse({ studentSubjects: [mathSubject, historySubject] })));

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    fireEvent.change(screen.getByPlaceholderText("Escribe tu duda o cuéntame qué no entendiste"), {
      target: { value: "No entiendo la Revolucion francesa" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect((await screen.findAllByText("Primero situamos el contexto historico.")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: /Matematicas/i })[0]);

    await waitFor(() => {
      expect(screen.getByText("Escribe al tutor qué quieres trabajar.")).toBeInTheDocument();
    });
    expect(screen.queryByText("Primero situamos el contexto historico.")).not.toBeInTheDocument();
    expect(screen.queryByText("No entiendo la Revolucion francesa")).not.toBeInTheDocument();
  });

  it("does not use an Ingles latest session fallback when the active classroom is Historia", async () => {
    setSearchParams({ subjectSlug: "historia" });
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        buildWorkspaceResponse({
          studentSubjects: [historySubject, englishSubject],
          recentSessions: [
            {
              id: "session_ingles",
              tenantId: "tenant_mentoria",
              studentProfileId: "student_1",
              subjectId: "subject_ingles",
              mentorId: "mentor_1",
              clientId: "student_1",
              topic: "Reported speech",
              status: "completed",
              durationMinutes: 18,
              aiTokensUsed: 240,
              emotionalState: "steady",
              tutorSummary: "Has repasado Ingles.",
              recommendedNextStep: "Haz una frase mas.",
              transcript: [
                { role: "student", content: "Quiero Ingles", createdAt: "2026-04-03T00:00:00.000Z" },
                { role: "tutor", content: "Seguimos con Ingles.", createdAt: "2026-04-03T00:01:00.000Z" },
              ],
              createdAt: "2026-04-03T00:00:00.000Z",
              updatedAt: "2026-04-03T00:20:00.000Z",
            },
          ],
        }),
      ),
    );

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    expect(screen.queryByText("Has repasado Ingles.")).not.toBeInTheDocument();
    expect(screen.queryByText("Haz una frase mas.")).not.toBeInTheDocument();
  });

  it("uses the visible correction button to send a subject-scoped correction request", async () => {
    setSearchParams({ subjectSlug: "ingles" });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse({ studentSubjects: [englishSubject] })))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          tutorMessage: "Te preparo una tarea corta de Ingles.",
          reply: "Te preparo una tarea corta de Ingles.",
          subject: { name: "Ingles", slug: "ingles" },
          boardUpdate: buildBoardUpdate({
            subjectSlug: "ingles",
            subjectName: "Ingles",
            topic: "Present simple",
            intent: "task",
            mode: "task",
            conceptDefinition: "Hoy vamos a resolver una tarea real de Ingles.",
            explanation: ["Usa frases cortas."],
            steps: ["Piensa el sujeto", "Elige el verbo"],
            task: {
              title: "Tarea guiada de Ingles",
              prompt: "Escribe tres frases en present simple sobre tu rutina.",
              allowedSteps: ["Piensa el sujeto", "Elige el verbo"],
            },
          }),
          session: { id: "session_task", topic: "Present simple", recommendedNextStep: "Escribe tu primera frase." },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse({ studentSubjects: [englishSubject] })))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          tutorMessage: "Voy a corregirte la tarea de Ingles.",
          reply: "Voy a corregirte la tarea de Ingles.",
          subject: { name: "Ingles", slug: "ingles" },
          boardUpdate: buildBoardUpdate({
            subjectSlug: "ingles",
            subjectName: "Ingles",
            topic: "Present simple",
            intent: "correction",
            mode: "correction",
            conceptDefinition: "Correccion de Ingles.",
            explanation: ["Has usado bien el sujeto, pero revisa la forma del verbo."],
            steps: ["Corrige la tercera persona"],
            correction: "Falta ajustar el verbo con he/she/it.",
          }),
          session: { id: "session_correction", topic: "Present simple", recommendedNextStep: "Reescribe la frase corregida." },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse({ studentSubjects: [englishSubject] })));

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    fireEvent.change(screen.getByPlaceholderText("Escribe tu duda o cuéntame qué no entendiste"), {
      target: { value: "Quiero una tarea de Inglés" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Tarea guiada de Ingles")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Escribe aquí cómo la resolverías"), {
      target: { value: "He play football every day." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Corregir respuesta" }));

    expect(await screen.findByText("Voy a corregirte la tarea de Ingles.")).toBeInTheDocument();
    expect(fetchMock.mock.calls[3]?.[0]).toBe("/api/mentoria/chat");
    expect(JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body))).toMatchObject({
      studentId: "student_1",
      subjectSlug: "ingles",
      intent: "correction",
    });
  });

  it("shows a clear dev-facing error when the tutor IA fails", async () => {
    setSearchParams({ subjectSlug: "matematicas" });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse()))
      .mockResolvedValueOnce(jsonResponse({ ok: false, error: "AI_BINDING_MISSING" }, 503));

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    fireEvent.change(screen.getByPlaceholderText("Escribe tu duda o cuéntame qué no entendiste"), {
      target: { value: "No entiendo fracciones" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Tutor IA no disponible. Falta el binding AI de Cloudflare Workers AI en este entorno.")).toBeInTheDocument();
  });

  it("keeps the learning loop alive across turns without resetting the class", async () => {
    setSearchParams({ subjectSlug: "matematicas" });
    fetchMock
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse()))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          tutorMessage: "Vamos con fracciones desde la base.",
          reply: "Vamos con fracciones desde la base.",
          subject: { name: "Matematicas", slug: "matematicas" },
          learningStateUpdated: {
            studentId: "student_1",
            subjectSlug: "matematicas",
            currentTopic: "Fracciones",
            difficultyLevel: 1,
            detectedGaps: ["Base fragil en Fracciones"],
            frustrationLevel: "high",
            lastUserAnswer: null,
            lastTutorAction: "introduce_concept",
            masteryScore: 24,
            stepIndex: 0,
            mode: "explain",
            strategy: "step_by_step",
            awaitingStudentAnswer: true,
            repeatedBlockCount: 0,
            feedback: null,
            updatedAt: "2026-04-25T10:00:00.000Z",
          },
          boardUpdate: {
            ...buildBoardUpdate({
              subjectSlug: "matematicas",
              subjectName: "Matematicas",
              topic: "Fracciones",
              intent: "explanation",
              mode: "explanation",
              conceptDefinition: "Una fraccion compara partes del mismo tamano.",
              explanation: ["Primero compara el denominador."],
              steps: ["Mira el denominador"],
              example: "Ejemplo guiado con dos fracciones.",
              guidedQuestion: "Que miras primero en cada fraccion?",
            }),
            progressSummary: "Paso 1 · dominio 24% · frustracion high",
            learningState: {
              studentId: "student_1",
              subjectSlug: "matematicas",
              currentTopic: "Fracciones",
              difficultyLevel: 1,
              detectedGaps: ["Base fragil en Fracciones"],
              frustrationLevel: "high",
              lastUserAnswer: null,
              lastTutorAction: "introduce_concept",
              masteryScore: 24,
              stepIndex: 0,
              mode: "explain",
              strategy: "step_by_step",
              awaitingStudentAnswer: true,
              repeatedBlockCount: 0,
              feedback: null,
              updatedAt: "2026-04-25T10:00:00.000Z",
            },
          },
          session: { id: "session_loop_1", topic: "Fracciones", recommendedNextStep: "Responde la pregunta guiada." },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse()))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          tutorMessage: "Bien, ahora subimos un paso mas.",
          reply: "Bien, ahora subimos un paso mas.",
          subject: { name: "Matematicas", slug: "matematicas" },
          learningStateUpdated: {
            studentId: "student_1",
            subjectSlug: "matematicas",
            currentTopic: "Fracciones",
            difficultyLevel: 2,
            detectedGaps: ["Base fragil en Fracciones"],
            frustrationLevel: "low",
            lastUserAnswer: "Primero miro el denominador",
            lastTutorAction: "raise_difficulty",
            masteryScore: 42,
            stepIndex: 1,
            mode: "exercise",
            strategy: "step_by_step",
            awaitingStudentAnswer: true,
            repeatedBlockCount: 0,
            feedback: "Bien. Esa respuesta ya permite avanzar un paso mas.",
            updatedAt: "2026-04-25T10:01:00.000Z",
          },
          boardUpdate: {
            ...buildBoardUpdate({
              subjectSlug: "matematicas",
              subjectName: "Matematicas",
              topic: "Fracciones",
              intent: "explanation",
              mode: "explanation",
              conceptDefinition: "Ahora compara tambien el numerador.",
              explanation: ["Ya sabes por donde empezar; ahora añade el numerador."],
              steps: ["Mira el denominador", "Compara el numerador"],
              example: "Ejemplo nuevo con numeradores distintos.",
              guidedQuestion: "Que cambia cuando el denominador ya es el mismo?",
            }),
            feedback: "Bien. Esa respuesta ya permite avanzar un paso mas.",
            progressSummary: "Paso 2 · dominio 42% · frustracion low",
            learningState: {
              studentId: "student_1",
              subjectSlug: "matematicas",
              currentTopic: "Fracciones",
              difficultyLevel: 2,
              detectedGaps: ["Base fragil en Fracciones"],
              frustrationLevel: "low",
              lastUserAnswer: "Primero miro el denominador",
              lastTutorAction: "raise_difficulty",
              masteryScore: 42,
              stepIndex: 1,
              mode: "exercise",
              strategy: "step_by_step",
              awaitingStudentAnswer: true,
              repeatedBlockCount: 0,
              feedback: "Bien. Esa respuesta ya permite avanzar un paso mas.",
              updatedAt: "2026-04-25T10:01:00.000Z",
            },
          },
          session: { id: "session_loop_2", topic: "Fracciones", recommendedNextStep: "Responde el siguiente paso." },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse()));

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    fireEvent.change(screen.getByPlaceholderText("Escribe tu duda o cuéntame qué no entendiste"), {
      target: { value: "No entiendo fracciones" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Paso 1 · dominio 24% · frustracion high")).toBeInTheDocument();
    expect(screen.getAllByText("Que miras primero en cada fraccion?").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText("Escribe tu duda o cuéntame qué no entendiste"), {
      target: { value: "Primero miro el denominador" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Paso 2 · dominio 42% · frustracion low")).toBeInTheDocument();
    expect(screen.getByText("Bien. Esa respuesta ya permite avanzar un paso mas.")).toBeInTheDocument();
    expect(screen.getAllByText("Que cambia cuando el denominador ya es el mismo?").length).toBeGreaterThan(0);
  });
});
