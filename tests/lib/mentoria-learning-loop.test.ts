import { describe, expect, it } from "vitest";

import { resolveLearningLoopDecision } from "@/lib/mentoria/learning-loop";

describe("mentoria learning loop", () => {
  it("creates a canonical learning state scoped by student and subject", () => {
    const result = resolveLearningLoopDecision({
      studentId: "student_1",
      subjectSlug: "matematicas",
      message: "No entiendo fracciones",
      topic: "Fracciones",
      intent: "explanation",
    });

    expect(result.learningStateUpdated).toMatchObject({
      studentId: "student_1",
      subjectSlug: "matematicas",
      currentTopic: "Fracciones",
      stepIndex: 0,
      difficultyLevel: 1,
      frustrationLevel: "high",
      mode: "explain",
    });
  });

  it("raises difficulty and mastery after a correct answer", () => {
    const result = resolveLearningLoopDecision({
      studentId: "student_1",
      subjectSlug: "matematicas",
      message: "Primero miro el denominador y comparo ambas fracciones",
      topic: "Fracciones",
      intent: "explanation",
      previousState: {
        studentId: "student_1",
        subjectSlug: "matematicas",
        currentTopic: "Fracciones",
        stepIndex: 0,
        difficultyLevel: 1,
        masteryScore: 20,
        frustrationLevel: "medium",
        detectedGaps: ["Base fragil en Fracciones"],
        lastUserAnswer: null,
        lastTutorAction: "introduce_concept",
        mode: "explain",
        strategy: "step_by_step",
        awaitingStudentAnswer: true,
        repeatedBlockCount: 0,
        feedback: null,
        updatedAt: "2026-04-25T10:00:00.000Z",
      },
      previousBoardUpdate: {
        studentId: "student_1",
        subjectSlug: "matematicas",
        subjectName: "Matematicas",
        studentName: "Alex",
        schoolYear: "2 ESO",
        topic: "Fracciones",
        intent: "explanation",
        mode: "explanation",
        conceptDefinition: "Empieza por el denominador.",
        explanation: ["Mira si el denominador es el mismo antes de operar."],
        steps: ["Mira el denominador", "Compara ambas fracciones"],
        example: null,
        formula: null,
        diagram: null,
        exercise: null,
        task: null,
        exam: null,
        correction: null,
        documentFeedback: null,
        note: null,
        guidedQuestion: "Que miras primero en cada fraccion?",
        feedback: null,
        progressSummary: null,
        learningState: null,
        nextAction: "Responde la pregunta guiada.",
        updatedAt: "2026-04-25T10:00:00.000Z",
      },
    });

    expect(result.learningStateUpdated.stepIndex).toBe(1);
    expect(result.learningStateUpdated.difficultyLevel).toBe(2);
    expect(result.learningStateUpdated.masteryScore).toBeGreaterThan(20);
    expect(result.learningStateUpdated.subjectSlug).toBe("matematicas");
  });

  it("keeps state isolated by subject slug", () => {
    const history = resolveLearningLoopDecision({
      studentId: "student_1",
      subjectSlug: "historia",
      message: "Hazme un examen de historia",
      topic: "Revolucion francesa",
      intent: "exam",
    });

    expect(history.learningStateUpdated.subjectSlug).toBe("historia");
    expect(history.learningStateUpdated.mode).toBe("exam");
  });

  it("starts more guided when evolution reports recurring mistakes in the same topic", () => {
    const result = resolveLearningLoopDecision({
      studentId: "student_1",
      subjectSlug: "matematicas",
      message: "No entiendo fracciones",
      topic: "Fracciones",
      intent: "explanation",
      studentEvolution: {
        studentId: "student_1",
        subjectSlug: "matematicas",
        strengths: [],
        weaknesses: ["Fracciones"],
        frustrationLevel: 0.74,
        consistencyScore: 0.42,
        averageResponseTime: 19,
        lastSessions: 5,
        commonMistakes: ["Error recurrente en Fracciones"],
        progressionVelocity: 0.36,
        updatedAt: "2026-04-25T10:00:00.000Z",
      },
    });

    expect(result.learningStateUpdated.difficultyLevel).toBe(1);
    expect(result.learningStateUpdated.strategy).toBe("visual");
    expect(result.learningStateUpdated.detectedGaps).toContain("Error recurrente en Fracciones");
    expect(result.evolutionSignals).toContain("common_mistake");
    expect(result.evolutionSignals).toContain("high_frustration_history");
  });

  it("raises challenge faster when evolution shows high progression velocity", () => {
    const result = resolveLearningLoopDecision({
      studentId: "student_1",
      subjectSlug: "historia",
      message: "Relaciono causas y consecuencias del texto",
      topic: "Revolucion francesa",
      intent: "review",
      previousState: {
        studentId: "student_1",
        subjectSlug: "historia",
        currentTopic: "Revolucion francesa",
        stepIndex: 0,
        difficultyLevel: 2,
        masteryScore: 48,
        frustrationLevel: "medium",
        detectedGaps: [],
        lastUserAnswer: null,
        lastTutorAction: "introduce_concept",
        mode: "explain",
        strategy: "step_by_step",
        awaitingStudentAnswer: true,
        repeatedBlockCount: 0,
        feedback: null,
        updatedAt: "2026-04-25T10:00:00.000Z",
      },
      previousBoardUpdate: {
        studentId: "student_1",
        subjectSlug: "historia",
        subjectName: "Historia",
        studentName: "Alex",
        schoolYear: "2 ESO",
        topic: "Revolucion francesa",
        intent: "review",
        mode: "explanation",
        conceptDefinition: "Relaciona causas y consecuencias.",
        explanation: ["Relaciona causas y consecuencias del proceso historico."],
        steps: ["Relaciona causas", "Relaciona consecuencias"],
        example: null,
        formula: null,
        diagram: null,
        exercise: null,
        task: null,
        exam: null,
        correction: null,
        documentFeedback: null,
        note: null,
        guidedQuestion: "Que relacion principal ves?",
        feedback: null,
        progressSummary: null,
        learningState: null,
        nextAction: "Responde la pregunta guiada.",
        updatedAt: "2026-04-25T10:00:00.000Z",
      },
      studentEvolution: {
        studentId: "student_1",
        subjectSlug: "historia",
        strengths: ["Historia"],
        weaknesses: [],
        frustrationLevel: 0.18,
        consistencyScore: 0.86,
        averageResponseTime: 8,
        lastSessions: 7,
        commonMistakes: [],
        progressionVelocity: 0.9,
        updatedAt: "2026-04-25T10:00:00.000Z",
      },
    });

    expect(result.learningStateUpdated.difficultyLevel).toBe(4);
    expect(result.evolutionSignals).toContain("high_progression_velocity");
  });
});
