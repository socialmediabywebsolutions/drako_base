import { describe, expect, it } from "vitest";

import { resolveLearningLoopDecision } from "@/lib/mentoria/learning-loop";

describe("mentoria learning loop engine", () => {
  it("opens a new class with an initial learning state", () => {
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
      difficultyLevel: 1,
      stepIndex: 0,
      awaitingStudentAnswer: true,
    });
    expect(result.nextAction).toContain("pregunta guiada");
  });

  it("advances the loop when the student answer matches the active board", () => {
    const result = resolveLearningLoopDecision({
      studentId: "student_1",
      subjectSlug: "matematicas",
      message: "Primero miro que ambas fracciones tengan el mismo denominador",
      topic: "Fracciones",
      intent: "explanation",
      previousState: {
        studentId: "student_1",
        subjectSlug: "matematicas",
        currentTopic: "Fracciones",
        difficultyLevel: 1,
        detectedGaps: ["Base fragil en Fracciones"],
        frustrationLevel: "medium",
        lastUserAnswer: null,
        lastTutorAction: "introduce_concept",
        masteryScore: 30,
        stepIndex: 0,
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
    expect(result.learningStateUpdated.masteryScore).toBeGreaterThan(30);
    expect(result.feedback).toContain("Bien");
  });

  it("changes strategy after repeated blockage", () => {
    const result = resolveLearningLoopDecision({
      studentId: "student_1",
      subjectSlug: "matematicas",
      message: "Sigo bloqueado, no lo veo",
      topic: "Fracciones",
      intent: "frustration",
      previousState: {
        studentId: "student_1",
        subjectSlug: "matematicas",
        currentTopic: "Fracciones",
        difficultyLevel: 2,
        detectedGaps: ["Paso 1 de Fracciones"],
        frustrationLevel: "high",
        lastUserAnswer: "No lo entiendo",
        lastTutorAction: "correct_mistake",
        masteryScore: 18,
        stepIndex: 0,
        mode: "correction",
        strategy: "step_by_step",
        awaitingStudentAnswer: true,
        repeatedBlockCount: 1,
        feedback: "Todavia no.",
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
        steps: ["Mira el denominador"],
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

    expect(result.learningStateUpdated.strategy).toBe("visual");
    expect(result.feedback).toContain("Cambio la estrategia");
  });
});
