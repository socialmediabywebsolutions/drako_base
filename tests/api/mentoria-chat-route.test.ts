import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCurrentMentoriaSession: vi.fn(),
  createMentoriaServiceInstance: vi.fn(),
}));

vi.mock("@/lib/mentoria/auth/request", () => ({
  requireCurrentMentoriaSession: mocks.requireCurrentMentoriaSession,
}));

vi.mock("@/lib/mentoria/service", () => ({
  MentoriaService: class MentoriaService {
    constructor() {
      return mocks.createMentoriaServiceInstance();
    }
  },
}));

import { POST } from "@/app/api/mentoria/chat/route";

describe("mentoria chat route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentMentoriaSession.mockResolvedValue({
      userId: "user_1",
      email: "family@example.com",
      tenantId: "tenant_1",
      role: "user",
    });
  });

  it("requires student, subject and message for the real chat endpoint", async () => {
    const response = await POST(
      new Request("https://mentoria.drako.systems/api/mentoria/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "No entiendo fracciones", studentId: "student_1" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "SUBJECT_REQUIRED",
    });
  });

  it("returns the chat reply together with the board update for the active subject", async () => {
    const startGuidedSession = vi.fn().mockResolvedValue({
      session: { id: "session_1", topic: "Fracciones", recommendedNextStep: "Haz una suma corta." },
      subject: { id: "subject_1", slug: "matematicas", name: "Matematicas" },
      adaptation: { emotionalState: "steady" },
      tutorMessage: "Vale, vamos paso a paso.",
      chatMessage: "Vale, vamos paso a paso.",
      reply: "Vale, vamos paso a paso.",
      intent: "explanation",
      provider: "workers-ai",
      model: "@cf/meta/llama-3-8b-instruct",
      subjectSlug: "matematicas",
      topic: "Fracciones",
      mode: "explanation",
      steps: ["Mira los denominadores", "Busca un comun denominador"],
      example: "Ejemplo guiado con fracciones equivalentes.",
      exercise: null,
      nextAction: "Haz una suma corta.",
      boardUpdate: {
        studentId: "student_1",
        subjectSlug: "matematicas",
        subjectName: "Matematicas",
        studentName: "Alex",
        schoolYear: "2 ESO",
        topic: "Fracciones",
        intent: "explanation",
        mode: "explanation",
        conceptDefinition: "Primero compara las fracciones desde el denominador.",
        explanation: ["Primero compara denominadores."],
        steps: ["Mira los denominadores", "Busca un comun denominador"],
        example: "Ejemplo guiado con fracciones equivalentes.",
        formula: "mismo denominador -> opera numeradores -> simplifica si hace falta",
        diagram: ["datos -> operacion -> resultado -> comprobacion"],
        exercise: null,
        correction: null,
        nextAction: "Haz una suma corta.",
        updatedAt: "2026-04-24T10:00:00.000Z",
      },
      explanation: "Primero compara denominadores.",
      suggestedSteps: ["Mira los denominadores", "Busca un comun denominador"],
      reinforcementQuestion: "Que ves primero en cada fraccion?",
      sessionMode: "subject_reinforcement",
      sessionInputKind: "selected_subject",
      learningStateUpdated: {
        studentId: "student_1",
        subjectSlug: "matematicas",
        currentTopic: "Fracciones",
        difficultyLevel: 1,
        detectedGaps: ["Base fragil en Fracciones"],
        frustrationLevel: "medium",
        lastUserAnswer: null,
        lastTutorAction: "introduce_concept",
        masteryScore: 24,
        stepIndex: 0,
        mode: "explain",
        strategy: "step_by_step",
        awaitingStudentAnswer: true,
        repeatedBlockCount: 0,
        feedback: null,
        updatedAt: "2026-04-24T10:00:00.000Z",
      },
      insights: [],
    });
    mocks.createMentoriaServiceInstance.mockReturnValue({
      startGuidedSession,
    });

    const response = await POST(
      new Request("https://mentoria.drako.systems/api/mentoria/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId: "student_1",
          subjectSlug: "matematicas",
          message: "No entiendo fracciones",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      tutorMessage: "Vale, vamos paso a paso.",
      reply: "Vale, vamos paso a paso.",
      provider: "workers-ai",
      model: "@cf/meta/llama-3-8b-instruct",
      subject: { slug: "matematicas", name: "Matematicas" },
      boardUpdate: {
        subjectSlug: "matematicas",
        topic: "Fracciones",
      },
      nextAction: "Haz una suma corta.",
      learningStateUpdated: {
        studentId: "student_1",
        subjectSlug: "matematicas",
        currentTopic: "Fracciones",
        stepIndex: 0,
      },
    });
    expect(startGuidedSession).toHaveBeenCalledWith(
      {
        userId: "user_1",
        email: "family@example.com",
        tenantId: "tenant_1",
        role: "user",
      },
      {
        studentProfileId: "student_1",
        subjectSlug: "matematicas",
        topic: undefined,
        message: "No entiendo fracciones",
      },
    );
  });

  it("forwards the classroom session options through the chat endpoint", async () => {
    const startGuidedSession = vi.fn().mockResolvedValue({
      session: { id: "session_1", topic: "Revolucion francesa", recommendedNextStep: "Responde la primera pregunta." },
      subject: { id: "subject_1", slug: "historia", name: "Historia" },
      adaptation: { emotionalState: "steady" },
      tutorMessage: "Vamos con un simulacro corto de Historia.",
      chatMessage: "Vamos con un simulacro corto de Historia.",
      reply: "Vamos con un simulacro corto de Historia.",
      intent: "exam",
      provider: "workers-ai",
      model: "@cf/meta/llama-3.1-8b-instruct-fast",
      subjectSlug: "historia",
      topic: "Revolucion francesa",
      mode: "exam",
      steps: ["Situa el contexto", "Explica una causa", "Explica una consecuencia"],
      example: null,
      exercise: null,
      nextAction: "Responde el simulacro y luego pide la correccion.",
      boardUpdate: {
        studentId: "student_1",
        subjectSlug: "historia",
        subjectName: "Historia",
        studentName: "Alex",
        schoolYear: "2 ESO",
        topic: "Revolucion francesa",
        intent: "exam",
        mode: "exam",
        conceptDefinition: "Vamos a simular un examen corto de Historia.",
        explanation: ["Responde con contexto, causa y consecuencia."],
        steps: ["Situa el contexto", "Explica una causa", "Explica una consecuencia"],
        example: null,
        formula: null,
        diagram: null,
        exercise: null,
        task: null,
        exam: {
          title: "Simulacro corto de Historia",
          questions: ["1. Situa el contexto", "2. Explica una causa", "3. Explica una consecuencia"],
        },
        correction: null,
        documentFeedback: null,
        note: "Nota orientativa: primero completa el simulacro y luego pide correccion.",
        guidedQuestion: "Que hecho situas primero?",
        nextAction: "Responde el simulacro y luego pide la correccion.",
        updatedAt: "2026-04-24T10:00:00.000Z",
      },
      explanation: "Responde con contexto, causa y consecuencia.",
      suggestedSteps: ["Situa el contexto", "Explica una causa", "Explica una consecuencia"],
      reinforcementQuestion: "Que hecho situas primero?",
      sessionMode: "exam_preparation",
      sessionInputKind: "free_message",
      insights: [],
    });
    mocks.createMentoriaServiceInstance.mockReturnValue({
      startGuidedSession,
    });

    const response = await POST(
      new Request("https://mentoria.drako.systems/api/mentoria/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId: "student_1",
          subjectSlug: "historia",
          topic: "Revolucion francesa",
          message: "Hazme un examen de Historia",
          sessionMode: "exam_preparation",
          sessionInputKind: "free_message",
          entryMode: "entry",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(startGuidedSession).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        studentProfileId: "student_1",
        subjectSlug: "historia",
        topic: "Revolucion francesa",
        message: "Hazme un examen de Historia",
        sessionMode: "exam_preparation",
        sessionInputKind: "free_message",
        entryMode: "entry",
      }),
    );
  });

  it("returns a clear 503 when the Workers AI binding is missing", async () => {
    const startGuidedSession = vi.fn().mockRejectedValue(new Error("AI_BINDING_MISSING"));
    mocks.createMentoriaServiceInstance.mockReturnValue({
      startGuidedSession,
    });

    const response = await POST(
      new Request("https://mentoria.drako.systems/api/mentoria/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId: "student_1",
          subjectSlug: "matematicas",
          message: "No entiendo fracciones",
        }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "AI_BINDING_MISSING",
    });
  });

  it("returns a clear 503 when Workers AI is unavailable because of quota or billing", async () => {
    const startGuidedSession = vi.fn().mockRejectedValue(new Error("AI_PROVIDER_UNAVAILABLE"));
    mocks.createMentoriaServiceInstance.mockReturnValue({
      startGuidedSession,
    });

    const response = await POST(
      new Request("https://mentoria.drako.systems/api/mentoria/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId: "student_1",
          subjectSlug: "matematicas",
          message: "No entiendo fracciones",
        }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "AI_PROVIDER_UNAVAILABLE",
    });
  });

  it("returns SUBJECT_CONTEXT_MISMATCH instead of answering from another subject", async () => {
    const startGuidedSession = vi.fn().mockRejectedValue(new Error("SUBJECT_CONTEXT_MISMATCH"));
    mocks.createMentoriaServiceInstance.mockReturnValue({
      startGuidedSession,
    });

    const response = await POST(
      new Request("https://mentoria.drako.systems/api/mentoria/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId: "student_1",
          subjectSlug: "historia",
          message: "Retoma la clase",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "SUBJECT_CONTEXT_MISMATCH",
    });
  });
});
