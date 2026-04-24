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
      chatMessage: "Vale, vamos paso a paso.",
      reply: "Vale, vamos paso a paso.",
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
      reply: "Vale, vamos paso a paso.",
      subject: { slug: "matematicas", name: "Matematicas" },
      boardUpdate: {
        subjectSlug: "matematicas",
        topic: "Fracciones",
      },
      nextAction: "Haz una suma corta.",
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
});
