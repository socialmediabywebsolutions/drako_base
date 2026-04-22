import { describe, expect, it } from "vitest";

import { buildWorkspaceOrchestratorPlan } from "@/lib/mentoria/workspace-orchestrator";

describe("buildWorkspaceOrchestratorPlan", () => {
  it("keeps idle sessions actionable", () => {
    const plan = buildWorkspaceOrchestratorPlan({
      nextAction: null,
      sessionState: "idle",
      selectedSubjectName: "Matematicas",
      currentTopic: "Fracciones",
      currentMessage: "Quiero repasar fracciones.",
    });

    expect(plan.stage).toBe("idle");
    expect(plan.primaryAction.kind).toBe("send_message");
    expect(plan.nextStep).toBe("Abrir una sesion guiada y resolver el primer paso.");
  });

  it("moves guided work through practice, reinforcement, evaluation and summary", () => {
    const guidedPractice = buildWorkspaceOrchestratorPlan({
      nextAction: {
        kind: "guided_step",
        title: "Responder este paso",
        detail: "Escribe una respuesta corta.",
        ctaLabel: "Comprobar y seguir",
        sessionState: "idle",
      },
      sessionState: "idle",
      activeGuidedStep: "Encuentra el denominador comun.",
      activeStepIndex: 0,
      totalSteps: 2,
      sessionProgressPercent: 0,
    });

    expect(guidedPractice.stage).toBe("guided_practice");
    expect(guidedPractice.primaryAction.kind).toBe("run_next");
    expect(guidedPractice.guidedSteps[0]).toBe("Encuentra el denominador comun.");

    const reinforcement = buildWorkspaceOrchestratorPlan({
      nextAction: {
        kind: "guided_step",
        title: "Reformular este paso",
        detail: "Rehaz el paso.",
        ctaLabel: "Reintentar este paso",
        sessionState: "retry",
      },
      sessionState: "retry",
      activeGuidedStep: "Encuentra el denominador comun.",
      guidedFeedback: {
        status: "incorrect",
        level: "incorrect",
        tone: "guided",
        message: "Aun no.",
        rationale: "Vuelve a la idea principal.",
      },
    });

    expect(reinforcement.stage).toBe("reinforcement");

    const evaluation = buildWorkspaceOrchestratorPlan({
      nextAction: {
        kind: "exercise",
        title: "Entregar el ejercicio actual",
        detail: "Resuelve el ejercicio.",
        ctaLabel: "Corregir respuesta",
      },
      sessionState: "idle",
      latestExercise: {
        prompt: "Calcula 1/2 + 1/3.",
        status: "pending",
      },
    });

    expect(evaluation.stage).toBe("light_evaluation");
    expect(evaluation.practiceTrigger?.kind).toBe("exercise");

    const summary = buildWorkspaceOrchestratorPlan({
      nextAction: {
        kind: "guided_step",
        title: "Sesion guiada completada",
        detail: "Has terminado la secuencia principal.",
        ctaLabel: "Sesion completada",
        sessionState: "completed",
      },
      sessionState: "completed",
      selectedSubjectName: "Matematicas",
      tutorResult: {
        topic: "Fracciones",
        recommendedNextStep: "Practica otro ejemplo corto.",
      },
    });

    expect(summary.stage).toBe("summary");
    expect(summary.primaryAction.kind).toBe("send_message");
    expect(summary.primaryAction.label).toBe("Preparar siguiente paso");
  });
});
