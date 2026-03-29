import { beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cf", () => ({
  env: envMock,
}));

global.fetch = fetchMock as unknown as typeof fetch;

describe("mentoria subject agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.mockReturnValue({
      AI: {
        run: fetchMock,
      },
    });
    fetchMock.mockResolvedValue({
      response: JSON.stringify({
        explanation: "Primero identifica la idea clave sin calcular el resultado final.",
        suggestedSteps: [
          "Localiza el dato que cambia el problema.",
          "Haz una operacion intermedia y comprueba que tiene sentido.",
          "Explica con tus palabras por que ese paso ayuda.",
        ],
        reinforcementQuestion: "¿Que dato usarías primero y por qué?",
      }),
      usage: { total_tokens: 123 },
    });
  });

  it("math agent returns structured guided teaching adapted to context", async () => {
    const { mathAgent } = await import("@/lib/agents/mentoria/math-agent");
    const result = await mathAgent.run(
      {
        profile: {
          id: "student_1",
          tenantId: "tenant_1",
          fullName: "Alex",
          age: 13,
          schoolYear: "2 eso",
          learningGoals: [],
          baseEmotionalState: "steady",
          emotionalBaseline: { frustration: "medium", motivation: "medium", concentration: "medium" },
          learningPreference: "step_by_step",
          preferredStudyMinutes: 30,
          strengths: [],
          onboardingCompleted: true,
          learningStage: "eso",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        subject: {
          id: "subject_1",
          tenantId: "tenant_1",
          slug: "matematicas",
          name: "Matematicas",
          description: "",
          difficultyBand: "core",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        topic: "Fracciones",
        studentMessage: "No entiendo por donde empezar",
      },
      {
        student_id: "student_1",
        age: 13,
        level: "2 eso",
        historial: [{ role: "student", content: "Ayer me costaron los denominadores" }],
      },
    );

    expect(result.provider).toBe("workers-ai");
    expect(result.explanation).toContain("idea clave");
    expect(result.suggestedSteps).toHaveLength(3);
    expect(result.reinforcementQuestion).toContain("¿");
  });

  it("fails closed when Workers AI is not available", async () => {
    envMock.mockReturnValue({});
    const { runMentoriaLlm } = await import("@/lib/agents/mentoria/llm-client");
    await expect(runMentoriaLlm([{ role: "user", content: "Hola" }])).rejects.toThrow("MENTORIA_AI_NOT_AVAILABLE");
  });
});
