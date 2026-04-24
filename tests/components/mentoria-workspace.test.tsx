import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { MentoriaWorkspace } from "@/components/mentoria-app/workspace";

const fetchMock = vi.spyOn(global, "fetch");

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: () => null,
  }),
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
    studentSubjects: [],
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

function buildStudentSubject() {
  return {
    id: "student_subject_1",
    tenantId: "tenant_mentoria",
    studentProfileId: "student_1",
    subjectId: "subject_matematicas",
    initialLevel: "me_cuesta_mucho",
    currentLevel: "voy_normal",
    createdAt: "2026-04-03T00:00:00.000Z",
    updatedAt: "2026-04-03T00:00:00.000Z",
    subject: {
      id: "subject_matematicas",
      tenantId: "tenant_mentoria",
      slug: "matematicas",
      name: "Matematicas",
      description: "Refuerzo guiado",
      difficultyBand: "core",
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
    },
  };
}

function buildHistorySubject() {
  return {
    id: "student_subject_2",
    tenantId: "tenant_mentoria",
    studentProfileId: "student_1",
    subjectId: "subject_historia",
    initialLevel: "voy_normal",
    currentLevel: "voy_normal",
    createdAt: "2026-04-03T00:00:00.000Z",
    updatedAt: "2026-04-03T00:00:00.000Z",
    subject: {
      id: "subject_historia",
      tenantId: "tenant_mentoria",
      slug: "historia",
      name: "Historia",
      description: "Contexto y pensamiento critico",
      difficultyBand: "growth",
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
    },
  };
}

function buildBehavioralShadow(overrides?: Record<string, unknown>) {
  return {
    currentStrategy: "plan_task",
    shadowStrategy: "plan_task",
    diverged: false,
    currentAction: {
      strategy: "plan_task",
      title: "Volver al plan de hoy",
      description: "La continuidad natural viene de la siguiente tarea pendiente del plan.",
      rationale: ["Hay tarea pendiente."],
      confidence: 0.86,
      task: {
        id: "task_practice",
        subject: "Matematicas",
        subjectId: "subject_matematicas",
        type: "practice",
        difficulty: 3,
        completed: false,
      },
      prompt: null,
    },
    shadowAction: {
      strategy: "plan_task",
      title: "Volver al plan de hoy",
      description: "La continuidad natural viene de la siguiente tarea pendiente del plan.",
      rationale: ["Hay tarea pendiente."],
      confidence: 0.86,
      task: {
        id: "task_practice",
        subject: "Matematicas",
        subjectId: "subject_matematicas",
        type: "practice",
        difficulty: 3,
        completed: false,
      },
      prompt: null,
    },
    loggedAt: "2026-04-04T09:00:00.000Z",
    ...overrides,
  };
}

describe("MentoriaWorkspace", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("shows a loading shell during the first workspace fetch instead of an ambiguous empty state", async () => {
    let resolveFetch: ((value: Response) => void) | null = null;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(React.createElement(MentoriaWorkspace));

    expect(await screen.findByText("Workspace del alumno")).toBeInTheDocument();
    expect(screen.getByText("Cargando Mentoria...")).toBeInTheDocument();
    expect(screen.queryByText("No pudimos preparar tu espacio")).not.toBeInTheDocument();

    resolveFetch?.(jsonResponse(buildWorkspaceResponse()));

    expect(await screen.findByRole("heading", { name: "Hola, Alex" })).toBeInTheDocument();
  });

  it("renders an explicit recovery state when workspace loading fails", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: false, error: "WORKSPACE_LOAD_FAILED" }, 500),
    );

    render(React.createElement(MentoriaWorkspace));

    expect(await screen.findByText("No pudimos preparar tu espacio")).toBeInTheDocument();
    expect(screen.getByText("WORKSPACE_LOAD_FAILED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver al onboarding" })).toHaveAttribute("href", "/mentoria/onboarding");
  });

  it("fails closed with an explicit incomplete-state message when the API returns no student", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        student: null,
        studentSubjects: [],
      }),
    );

    render(React.createElement(MentoriaWorkspace));

    expect(await screen.findByText("No pudimos preparar tu espacio")).toBeInTheDocument();
    expect(screen.getByText("MENTORIA_WORKSPACE_INCOMPLETE")).toBeInTheDocument();
  });

  it("renders the continuous study workspace when the payload is complete", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse()));

    render(React.createElement(MentoriaWorkspace));

    expect(await screen.findByRole("heading", { name: "Hola, Alex" })).toBeInTheDocument();
    expect(screen.getByText("Empieza por una duda concreta")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Escribe tu duda o cuéntame qué no entendiste")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeInTheDocument();
    expect(screen.queryByText("Tutor IA")).not.toBeInTheDocument();
  });

  it("sends direct chat messages through the real chat endpoint with the active subject", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          reply: "Vale, vamos paso a paso.",
          explanation: "Primero mira el denominador.",
          suggestedSteps: ["Compara denominadores"],
          reinforcementQuestion: "¿Qué cambia entre ambas fracciones?",
          subject: { name: "Matematicas", slug: "matematicas" },
          session: { id: "session_1", topic: "Fracciones", recommendedNextStep: "Prueba un ejemplo corto." },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
          }),
        ),
      );

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    fireEvent.change(screen.getByPlaceholderText("Escribe tu duda o cuéntame qué no entendiste"), {
      target: { value: "No entiendo fracciones" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await screen.findByText("Vale, vamos paso a paso.");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/mentoria/chat");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      studentId: "student_1",
      subjectSlug: "matematicas",
      message: "No entiendo fracciones",
    });
  });

  it("renders the board update returned by chat and keeps it isolated by subject", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          reply: "Vale, vamos paso a paso.",
          chatMessage: "Vale, vamos paso a paso.",
          subjectSlug: "matematicas",
          topic: "Fracciones",
          boardUpdate: {
            studentId: "student_1",
            subjectSlug: "matematicas",
            subjectName: "Matematicas",
            studentName: "Alex",
            schoolYear: "2 ESO",
            topic: "Fracciones",
            mode: "explanation",
            conceptDefinition: "Primero compara las fracciones desde el denominador.",
            explanation: ["Mira el denominador antes de operar."],
            steps: ["Compara denominadores"],
            example: "Ejemplo guiado con fracciones equivalentes.",
            formula: null,
            diagram: null,
            exercise: null,
            correction: null,
            nextAction: "Prueba un ejemplo corto.",
            updatedAt: "2026-04-24T10:00:00.000Z",
          },
          explanation: "Mira el denominador antes de operar.",
          suggestedSteps: ["Compara denominadores"],
          reinforcementQuestion: "Que cambia entre ambas fracciones?",
          subject: { name: "Matematicas", slug: "matematicas" },
          session: { id: "session_1", topic: "Fracciones", recommendedNextStep: "Prueba un ejemplo corto." },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
          }),
        ),
      );

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    fireEvent.change(screen.getByPlaceholderText(/Escribe tu duda/i), {
      target: { value: "No entiendo fracciones" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Primero compara las fracciones desde el denominador.")).toBeInTheDocument();
    expect(screen.getByText("Ejemplo guiado con fracciones equivalentes.")).toBeInTheDocument();
  });

  it("lets the student ask for a simpler explanation, another example and the next step from the board", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          reply: "Vale, vamos paso a paso.",
          chatMessage: "Vale, vamos paso a paso.",
          subjectSlug: "matematicas",
          topic: "Fracciones",
          boardUpdate: {
            studentId: "student_1",
            subjectSlug: "matematicas",
            subjectName: "Matematicas",
            studentName: "Alex",
            schoolYear: "2 ESO",
            topic: "Fracciones",
            mode: "explanation",
            conceptDefinition: "Primero compara las fracciones desde el denominador.",
            explanation: ["Mira el denominador antes de operar."],
            steps: ["Compara denominadores"],
            example: "Ejemplo guiado con fracciones equivalentes.",
            formula: null,
            diagram: null,
            exercise: null,
            correction: null,
            nextAction: "Prueba un ejemplo corto.",
            updatedAt: "2026-04-24T10:00:00.000Z",
          },
          explanation: "Mira el denominador antes de operar.",
          suggestedSteps: ["Compara denominadores"],
          reinforcementQuestion: "Que cambia entre ambas fracciones?",
          subject: { name: "Matematicas", slug: "matematicas" },
          session: { id: "session_1", topic: "Fracciones", recommendedNextStep: "Prueba un ejemplo corto." },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          reply: "Te lo explico mas facil.",
          chatMessage: "Te lo explico mas facil.",
          subjectSlug: "matematicas",
          topic: "Fracciones",
          boardUpdate: {
            studentId: "student_1",
            subjectSlug: "matematicas",
            subjectName: "Matematicas",
            studentName: "Alex",
            schoolYear: "2 ESO",
            topic: "Fracciones",
            mode: "explanation",
            conceptDefinition: "Una fraccion compara partes del mismo tamano.",
            explanation: ["Primero mira cuantas partes iguales tienes en total."],
            steps: ["Fijate en el total de partes"],
            example: "Ejemplo visual con una pizza partida en ocho trozos.",
            formula: null,
            diagram: null,
            exercise: null,
            correction: null,
            nextAction: "Ahora compara dos fracciones sencillas.",
            updatedAt: "2026-04-24T10:05:00.000Z",
          },
          explanation: "Primero mira cuantas partes iguales tienes en total.",
          suggestedSteps: ["Fijate en el total de partes"],
          reinforcementQuestion: "Que representa el denominador?",
          subject: { name: "Matematicas", slug: "matematicas" },
          session: { id: "session_2", topic: "Fracciones", recommendedNextStep: "Ahora compara dos fracciones sencillas." },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          reply: "Mira este ejemplo distinto.",
          chatMessage: "Mira este ejemplo distinto.",
          subjectSlug: "matematicas",
          topic: "Fracciones",
          boardUpdate: {
            studentId: "student_1",
            subjectSlug: "matematicas",
            subjectName: "Matematicas",
            studentName: "Alex",
            schoolYear: "2 ESO",
            topic: "Fracciones",
            mode: "example",
            conceptDefinition: "Ahora trabajamos el mismo concepto con otro caso.",
            explanation: ["Compara dos fracciones usando rectas numericas."],
            steps: ["Coloca ambas fracciones en la recta"],
            example: "Ejemplo nuevo con rectas numericas y marcas iguales.",
            formula: null,
            diagram: ["fraccion A -> posicion", "fraccion B -> posicion"],
            exercise: null,
            correction: null,
            nextAction: "Haz una comparacion tu solo.",
            updatedAt: "2026-04-24T10:10:00.000Z",
          },
          explanation: "Compara dos fracciones usando rectas numericas.",
          suggestedSteps: ["Coloca ambas fracciones en la recta"],
          reinforcementQuestion: "Cual queda mas a la derecha?",
          subject: { name: "Matematicas", slug: "matematicas" },
          session: { id: "session_3", topic: "Fracciones", recommendedNextStep: "Haz una comparacion tu solo." },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          reply: "Seguimos con un paso mas.",
          chatMessage: "Seguimos con un paso mas.",
          subjectSlug: "matematicas",
          topic: "Fracciones",
          boardUpdate: {
            studentId: "student_1",
            subjectSlug: "matematicas",
            subjectName: "Matematicas",
            studentName: "Alex",
            schoolYear: "2 ESO",
            topic: "Fracciones equivalentes",
            mode: "summary",
            conceptDefinition: "Ahora ya puedes comparar y justificar tu respuesta.",
            explanation: ["Relaciona el ejemplo con una comparacion real."],
            steps: ["Justifica por que una es mayor"],
            example: "Caso guiado con dos fracciones equivalentes y una comparacion final.",
            formula: null,
            diagram: null,
            exercise: null,
            correction: null,
            nextAction: "Haz una comparacion tu solo.",
            updatedAt: "2026-04-24T10:15:00.000Z",
          },
          explanation: "Relaciona el ejemplo con una comparacion real.",
          suggestedSteps: ["Justifica por que una es mayor"],
          reinforcementQuestion: "Como justificarias la respuesta?",
          subject: { name: "Matematicas", slug: "matematicas" },
          session: { id: "session_4", topic: "Fracciones equivalentes", recommendedNextStep: "Haz una comparacion tu solo." },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
          }),
        ),
      );

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    fireEvent.change(screen.getByPlaceholderText(/Escribe tu duda/i), {
      target: { value: "No entiendo fracciones" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Primero compara las fracciones desde el denominador.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "No lo entiendo" }));
    expect(await screen.findByText("Una fraccion compara partes del mismo tamano.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dame otro ejemplo" }));
    expect(await screen.findByText("Ejemplo nuevo con rectas numericas y marcas iguales.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente paso" }));
    expect(await screen.findByText("Ahora ya puedes comparar y justificar tu respuesta.")).toBeInTheDocument();
  });

  it("turns the board practice button into a real exercise for the active subject", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          exercise: {
            id: "exercise_1",
            tenantId: "tenant_mentoria",
            studentProfileId: "student_1",
            subjectId: "subject_matematicas",
            prompt: "Resuelve una comparacion corta de fracciones.",
            expectedCompetency: "Comparar fracciones equivalentes",
            hints: ["Busca un comun denominador"],
            answerFormat: "Operacion y respuesta final",
            difficultyLevel: "medium",
            status: "pending",
            createdAt: "2026-04-24T10:20:00.000Z",
            updatedAt: "2026-04-24T10:20:00.000Z",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
            exercises: [
              {
                id: "exercise_1",
                tenantId: "tenant_mentoria",
                studentProfileId: "student_1",
                subjectId: "subject_matematicas",
                prompt: "Resuelve una comparacion corta de fracciones.",
                expectedCompetency: "Comparar fracciones equivalentes",
                hints: ["Busca un comun denominador"],
                answerFormat: "Operacion y respuesta final",
                difficultyLevel: "medium",
                status: "pending",
                createdAt: "2026-04-24T10:20:00.000Z",
                updatedAt: "2026-04-24T10:20:00.000Z",
              },
            ],
          }),
        ),
      );

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    fireEvent.click(screen.getByRole("button", { name: "Practicar" }));

    expect(await screen.findByText("Resuelve una comparacion corta de fracciones.")).toBeInTheDocument();
    expect(screen.getByLabelText("Tu respuesta")).toBeInTheDocument();
  });

  it("keeps tutor transcript isolated when the active subject changes", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        buildWorkspaceResponse({
          studentSubjects: [buildStudentSubject(), buildHistorySubject()],
          recentSessions: [
            {
              id: "session_historia",
              tenantId: "tenant_mentoria",
              studentProfileId: "student_1",
              subjectId: "subject_historia",
              mentorId: "mentor_1",
              clientId: "student_1",
              topic: "Revolucion francesa",
              status: "completed",
              durationMinutes: 18,
              aiTokensUsed: 240,
              emotionalState: "steady",
              tutorSummary: "Has conectado causas y consecuencias.",
              recommendedNextStep: "Explica el contexto previo.",
              transcript: [
                { role: "student", content: "No entiendo la Revolucion francesa", createdAt: "2026-04-03T00:00:00.000Z" },
                { role: "tutor", content: "Primero situamos el contexto historico.", createdAt: "2026-04-03T00:01:00.000Z" },
              ],
              createdAt: "2026-04-03T00:00:00.000Z",
              updatedAt: "2026-04-03T00:20:00.000Z",
            },
            {
              id: "session_mates",
              tenantId: "tenant_mentoria",
              studentProfileId: "student_1",
              subjectId: "subject_matematicas",
              mentorId: "mentor_1",
              clientId: "student_1",
              topic: "Fracciones",
              status: "completed",
              durationMinutes: 20,
              aiTokensUsed: 280,
              emotionalState: "steady",
              tutorSummary: "Has entendido mejor como comparar fracciones equivalentes.",
              recommendedNextStep: "Resuelve un ejemplo corto de suma de fracciones.",
              transcript: [
                { role: "student", content: "No entiendo las fracciones", createdAt: "2026-04-03T00:00:00.000Z" },
                { role: "tutor", content: "Vamos paso a paso con fracciones.", createdAt: "2026-04-03T00:01:00.000Z" },
              ],
              createdAt: "2026-04-02T00:00:00.000Z",
              updatedAt: "2026-04-02T00:20:00.000Z",
            },
          ],
          entry: {
            headline: "Empieza por una duda concreta",
            subheadline: "El tutor te guiara sin darte la respuesta final.",
            recommendedSubjectSlug: "matematicas",
            recommendedTopic: "Fracciones",
            recommendedPrompt: "Quiero repasar fracciones paso a paso.",
            quickActions: [],
          },
        }),
      ),
    );

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    expect(screen.getByText("Vamos paso a paso con fracciones.")).toBeInTheDocument();
    expect(screen.queryByText("Primero situamos el contexto historico.")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /Historia/ })[0]);

    expect(await screen.findByText("Primero situamos el contexto historico.")).toBeInTheDocument();
    expect(screen.queryByText("Vamos paso a paso con fracciones.")).not.toBeInTheDocument();
  });

  it("uses the engine-selected reentry strategy when the rollout enables engine strategy", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        buildWorkspaceResponse({
          studentSubjects: [buildStudentSubject()],
          motivation: {
            studentId: "student_1",
            streak: 1,
            lastActivityAt: "2026-04-01T08:00:00.000Z",
            effortScore: 0.4,
            rewardPoints: 10,
            level: 1,
            achievements: [],
            motivationProfile: "fragile",
          },
          dailyPlan: {
            id: "plan_1",
            tenantId: "tenant_mentoria",
            studentId: "student_1",
            planDate: "2026-04-04",
            recommendedDuration: 30,
            tasks: [
              {
                id: "task_review",
                subject: "Matematicas",
                subjectId: "subject_matematicas",
                type: "review",
                difficulty: 2,
                completed: false,
              },
              {
                id: "task_challenge",
                subject: "Matematicas",
                subjectId: "subject_matematicas",
                type: "challenge",
                difficulty: 4,
                completed: false,
              },
            ],
            priority: "medium",
            adaptationReason: "Hoy conviene reforzar base antes de subir dificultad.",
            generatedAt: "2026-04-04T08:00:00.000Z",
            createdAt: "2026-04-04T08:00:00.000Z",
            updatedAt: "2026-04-04T08:00:00.000Z",
            completedTaskIds: [],
            completionRate: 0,
          },
          behavioralRollout: "engine_strategy",
          behavioralShadow: buildBehavioralShadow({
            currentStrategy: "gentle_restart",
            shadowStrategy: "momentum_push",
            diverged: true,
            currentAction: {
              strategy: "gentle_restart",
              title: "Volver con algo facil",
              description: "La mejor primera accion del dia debe recuperar traccion sin friccion.",
              rationale: ["Perfil fragile."],
              confidence: 0.9,
              task: {
                id: "task_review",
                subject: "Matematicas",
                subjectId: "subject_matematicas",
                type: "review",
                difficulty: 2,
                completed: false,
              },
              prompt: null,
            },
            shadowAction: {
              strategy: "momentum_push",
              title: "Subir un paso hoy",
              description: "La mejor primera accion del dia puede ser un poco mas exigente.",
              rationale: ["Momentum."],
              confidence: 0.92,
              task: {
                id: "task_challenge",
                subject: "Matematicas",
                subjectId: "subject_matematicas",
                type: "challenge",
                difficulty: 4,
                completed: false,
              },
              prompt: null,
            },
          }),
        }),
      ),
    );

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    expect(screen.getByRole("button", { name: "Abrir siguiente paso" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Escribe tu duda o cuéntame qué no entendiste")).toBeInTheDocument();
    expect(screen.queryByText("Modo de hoy: subir un paso")).not.toBeInTheDocument();
  });

  it("falls back to the live reentry strategy when engine strategy payload is invalid", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        buildWorkspaceResponse({
          studentSubjects: [buildStudentSubject()],
          motivation: {
            studentId: "student_1",
            streak: 1,
            lastActivityAt: "2026-04-01T08:00:00.000Z",
            effortScore: 0.4,
            rewardPoints: 10,
            level: 1,
            achievements: [],
            motivationProfile: "fragile",
          },
          dailyPlan: {
            id: "plan_1",
            tenantId: "tenant_mentoria",
            studentId: "student_1",
            planDate: "2026-04-04",
            recommendedDuration: 30,
            tasks: [
              {
                id: "task_review",
                subject: "Matematicas",
                subjectId: "subject_matematicas",
                type: "review",
                difficulty: 2,
                completed: false,
              },
            ],
            priority: "medium",
            adaptationReason: "Hoy conviene reforzar base antes de subir dificultad.",
            generatedAt: "2026-04-04T08:00:00.000Z",
            createdAt: "2026-04-04T08:00:00.000Z",
            updatedAt: "2026-04-04T08:00:00.000Z",
            completedTaskIds: [],
            completionRate: 0,
          },
          behavioralRollout: "engine_strategy",
          behavioralShadow: buildBehavioralShadow({
            currentStrategy: "gentle_restart",
            shadowStrategy: "momentum_push",
            diverged: true,
            currentAction: {
              strategy: "gentle_restart",
              title: "Volver con algo facil",
              description: "La mejor primera accion del dia debe recuperar traccion sin friccion.",
              rationale: ["Perfil fragile."],
              confidence: 0.9,
              task: {
                id: "task_review",
                subject: "Matematicas",
                subjectId: "subject_matematicas",
                type: "review",
                difficulty: 2,
                completed: false,
              },
              prompt: null,
            },
            shadowAction: {
              strategy: "momentum_push",
              title: "Subir un paso hoy",
              description: "La mejor primera accion del dia puede ser un poco mas exigente.",
              rationale: ["Momentum."],
              confidence: 0.92,
              task: null,
              prompt: null,
            },
          }),
        }),
      ),
    );

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    expect(screen.getByRole("button", { name: "Abrir siguiente paso" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Escribe tu duda o cuéntame qué no entendiste")).toBeInTheDocument();
    expect(screen.queryByText("Modo de hoy: vuelta suave")).not.toBeInTheDocument();
  });

  it("uses engine explanation only when the rollout enables strategy and explanation together", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        buildWorkspaceResponse({
          studentSubjects: [buildStudentSubject()],
          motivation: {
            studentId: "student_1",
            streak: 2,
            lastActivityAt: "2026-04-04T07:00:00.000Z",
            effortScore: 0.68,
            rewardPoints: 90,
            level: 2,
            achievements: [],
            motivationProfile: "stable",
          },
          dailyPlan: {
            id: "plan_1",
            tenantId: "tenant_mentoria",
            studentId: "student_1",
            planDate: "2026-04-04",
            recommendedDuration: 30,
            tasks: [
              {
                id: "task_review",
                subject: "Matematicas",
                subjectId: "subject_matematicas",
                type: "review",
                difficulty: 2,
                completed: false,
              },
            ],
            priority: "medium",
            adaptationReason: "Hoy conviene reforzar base antes de subir dificultad.",
            generatedAt: "2026-04-04T08:00:00.000Z",
            createdAt: "2026-04-04T08:00:00.000Z",
            updatedAt: "2026-04-04T08:00:00.000Z",
            completedTaskIds: [],
            completionRate: 0,
          },
          behavioralRollout: "engine_strategy_and_explanation",
          behavioralShadow: buildBehavioralShadow({
            currentStrategy: "plan_task",
            shadowStrategy: "plan_task",
            diverged: false,
            shadowAction: {
              strategy: "plan_task",
              title: "Volver al plan de hoy",
              description: "La continuidad natural viene de la siguiente tarea pendiente del plan.",
              rationale: ["Plan task."],
              confidence: 0.9,
              task: {
                id: "task_review",
                subject: "Matematicas",
                subjectId: "subject_matematicas",
                type: "review",
                difficulty: 2,
                completed: false,
              },
              prompt: null,
            },
          }),
        }),
      ),
    );

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    expect(screen.getByText("Revisa la recomendacion y entra con un solo clic.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir siguiente paso" })).toBeInTheDocument();
    expect(screen.queryByText("La continuidad natural hoy viene del plan del dia.")).not.toBeInTheDocument();
  });

  it("turns accumulated signals into an identity-focused progress narrative", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        buildWorkspaceResponse({
          progress: [
            {
              id: "progress_math",
              tenantId: "tenant_mentoria",
              studentProfileId: "student_1",
              subjectId: "subject_matematicas",
              subject: buildStudentSubject().subject,
              masteryScore: 68,
              confidenceScore: 61,
              streakDays: 5,
              sessionsCompleted: 7,
              exercisesCompleted: 18,
              strongTopics: ["Fracciones equivalentes"],
              weakTopics: ["Problemas largos"],
              lastActivityAt: "2026-04-04T08:00:00.000Z",
              createdAt: "2026-04-03T00:00:00.000Z",
              updatedAt: "2026-04-04T08:00:00.000Z",
            },
          ],
          motivation: {
            studentId: "student_1",
            streak: 5,
            lastActivityAt: "2026-04-04T08:00:00.000Z",
            effortScore: 0.74,
            confidenceTrend: "up",
            emotionalState: "steady",
            recentRewards: [],
            rewardPoints: 80,
            level: 3,
            achievements: ["racha_5"],
            motivationProfile: "steady",
            updatedAt: "2026-04-04T08:00:00.000Z",
          },
          evolution: {
            studentId: "student_1",
            strengths: ["Matematicas"],
            weaknesses: ["Problemas largos"],
            frustrationLevel: 0.28,
            consistencyScore: 0.76,
            averageResponseTime: 9,
            lastSessions: 7,
            commonMistakes: ["Confunde el ultimo paso"],
            progressionVelocity: 0.67,
            updatedAt: "2026-04-04T08:00:00.000Z",
          },
        }),
      ),
    );

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    expect(screen.queryByText("Lo que ya esta cambiando")).not.toBeInTheDocument();
    expect(screen.queryByText("Ya estas construyendo un ritmo propio")).not.toBeInTheDocument();
    expect(screen.getByText("Empieza por una duda concreta")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Escribe tu duda o cuéntame qué no entendiste")).toBeInTheDocument();
  });

  it("shows the previous daily closure and prepares the carry-over for today", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        buildWorkspaceResponse({
          studentSubjects: [buildStudentSubject()],
          dailyClosure: {
            closureDate: "2026-04-03",
            source: "event",
            status: "completed",
            title: "Hoy has cerrado algo importante",
            summary: "Ayer cerraste el dia con avance real y ya quedo listo el primer paso para hoy.",
            carryOverPrompt: "Empieza repasando fracciones equivalentes con un ejemplo corto.",
            carryOverTopic: "Fracciones equivalentes",
            carryOverSubjectId: "subject_matematicas",
            completionRate: 1,
            completedTasks: 2,
            totalTasks: 2,
            lastActivityAt: "2026-04-03T20:30:00.000Z",
          },
        }),
      ),
    );

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    expect(screen.getByText("Esto quedo preparado para que vuelvas rapido")).toBeInTheDocument();
    expect(screen.getByText("Ayer cerraste el dia con avance real y ya quedo listo el primer paso para hoy.")).toBeInTheDocument();
    expect(screen.queryByText("Por que merece la pena volver")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Volver justo por aqui" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Fracciones equivalentes")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Empieza repasando fracciones equivalentes con un ejemplo corto.")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Ayer te dejaste una pista clara y hoy puedes retomarla con ventaja, sin volver a pensar desde cero."),
    ).toBeInTheDocument();
  });

  it("turns the next daily task into an immediate action from the workspace", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        buildWorkspaceResponse({
          studentSubjects: [buildStudentSubject()],
          dailyPlan: {
            id: "plan_1",
            tenantId: "tenant_mentoria",
            studentId: "student_1",
            planDate: "2026-04-04",
            recommendedDuration: 30,
            tasks: [
              {
                id: "task_1",
                subject: "Matematicas",
                subjectId: "subject_matematicas",
                type: "review",
                difficulty: 2,
                completed: false,
              },
            ],
            priority: "medium",
            adaptationReason: "Hoy conviene reforzar base antes de subir dificultad.",
            generatedAt: "2026-04-04T08:00:00.000Z",
            createdAt: "2026-04-04T08:00:00.000Z",
            updatedAt: "2026-04-04T08:00:00.000Z",
            completedTaskIds: [],
            completionRate: 0,
          },
        }),
      ),
    );

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    expect(screen.getByText("Empieza por aqui")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Preparar con el tutor" })[0]);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Repaso de Matematicas")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Quiero repasar Matematicas paso a paso y ver que debo vigilar hoy.")).toBeInTheDocument();
    });
    expect(screen.getByText("Tarea lista: Matematicas - repaso guiado. Ya puedes avanzar desde el tutor.")).toBeInTheDocument();
  });

  it("shows visible daily plan progress after a guided session completes a task and updates the next step", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
            dailyPlan: {
              id: "plan_1",
              tenantId: "tenant_mentoria",
              studentId: "student_1",
              planDate: "2026-04-04",
              recommendedDuration: 30,
              tasks: [
                {
                  id: "task_review",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "review",
                  difficulty: 2,
                  completed: false,
                },
                {
                  id: "task_practice",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "practice",
                  difficulty: 3,
                  completed: false,
                },
              ],
              priority: "medium",
              adaptationReason: "Hoy conviene reforzar base antes de subir dificultad.",
              generatedAt: "2026-04-04T08:00:00.000Z",
              createdAt: "2026-04-04T08:00:00.000Z",
              updatedAt: "2026-04-04T08:00:00.000Z",
              completedTaskIds: [],
              completionRate: 0,
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          reply: "Vamos a repasar fracciones de forma guiada.",
          explanation: "Primero revisa como encontrar el comun denominador.",
          suggestedSteps: ["Busca el comun denominador"],
          reinforcementQuestion: "Que paso te cuesta mas?",
          subject: { name: "Matematicas", slug: "matematicas" },
          session: {
            id: "session_1",
            topic: "Repaso de Matematicas",
            recommendedNextStep: "Pasa ahora a una practica corta de fracciones.",
          },
          sessionFeedback: {
            progressMessage: "Has consolidado la base de hoy.",
            scoreChange: 3,
            masteryLevel: "en progreso",
            confidenceLevel: "subiendo",
            nextSteps: ["Pasa ahora a una practica corta de fracciones."],
            encouragement: "Buen trabajo: ya puedes subir un paso mas.",
            completionMessage: "Sesion cerrada con avance visible en el plan de hoy.",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
            dailyPlan: {
              id: "plan_1",
              tenantId: "tenant_mentoria",
              studentId: "student_1",
              planDate: "2026-04-04",
              recommendedDuration: 30,
              tasks: [
                {
                  id: "task_review",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "review",
                  difficulty: 2,
                  completed: true,
                },
                {
                  id: "task_practice",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "practice",
                  difficulty: 3,
                  completed: false,
                },
              ],
              priority: "medium",
              adaptationReason: "Hoy conviene reforzar base antes de subir dificultad.",
              generatedAt: "2026-04-04T08:00:00.000Z",
              createdAt: "2026-04-04T08:00:00.000Z",
              updatedAt: "2026-04-04T08:30:00.000Z",
              completedTaskIds: ["task_review"],
              completionRate: 0.5,
            },
          }),
        ),
      );

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    fireEvent.change(screen.getByPlaceholderText("Escribe tu duda o cuéntame qué no entendiste"), {
      target: { value: "Seguimos con matematicas" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Sesion cerrada con avance visible en el plan de hoy.")).toBeInTheDocument();
    expect(screen.getByText("Has consolidado la base de hoy.")).toBeInTheDocument();
    expect(screen.getByText("Buen trabajo: ya puedes subir un paso mas.")).toBeInTheDocument();
  });

  it("recalculates the second action upward after a strong exercise result", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
            exercises: [
              {
                id: "exercise_1",
                tenantId: "tenant_mentoria",
                studentProfileId: "student_1",
                subjectId: "subject_matematicas",
                prompt: "Resuelve una suma de fracciones equivalentes.",
                expectedCompetency: "Sumas de fracciones",
                difficultyLevel: "medium",
                hints: ["Busca el comun denominador"],
                answerFormat: "text",
                status: "pending",
                createdAt: "2026-04-04T09:00:00.000Z",
                updatedAt: "2026-04-04T09:00:00.000Z",
              },
            ],
            dailyPlan: {
              id: "plan_1",
              tenantId: "tenant_mentoria",
              studentId: "student_1",
              planDate: "2026-04-04",
              recommendedDuration: 30,
              tasks: [
                {
                  id: "task_practice",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "practice",
                  difficulty: 3,
                  completed: false,
                },
                {
                  id: "task_challenge",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "challenge",
                  difficulty: 4,
                  completed: false,
                },
              ],
              priority: "medium",
              adaptationReason: "Hoy puedes consolidar y luego subir un paso.",
              generatedAt: "2026-04-04T08:00:00.000Z",
              createdAt: "2026-04-04T08:00:00.000Z",
              updatedAt: "2026-04-04T08:00:00.000Z",
              completedTaskIds: [],
              completionRate: 0,
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          exercise: {
            id: "exercise_1",
            tenantId: "tenant_mentoria",
            studentProfileId: "student_1",
            subjectId: "subject_matematicas",
            prompt: "Resuelve una suma de fracciones equivalentes.",
            expectedCompetency: "Sumas de fracciones",
            difficultyLevel: "medium",
            hints: ["Busca el comun denominador"],
            answerFormat: "text",
            studentAnswer: "5/6",
            correctionFeedback: "Muy bien resuelto.",
            status: "corrected",
            score: 92,
            createdAt: "2026-04-04T09:00:00.000Z",
            updatedAt: "2026-04-04T09:10:00.000Z",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
            exercises: [
              {
                id: "exercise_1",
                tenantId: "tenant_mentoria",
                studentProfileId: "student_1",
                subjectId: "subject_matematicas",
                prompt: "Resuelve una suma de fracciones equivalentes.",
                expectedCompetency: "Sumas de fracciones",
                difficultyLevel: "medium",
                hints: ["Busca el comun denominador"],
                answerFormat: "text",
                studentAnswer: "5/6",
                correctionFeedback: "Muy bien resuelto.",
                status: "corrected",
                score: 92,
                createdAt: "2026-04-04T09:00:00.000Z",
                updatedAt: "2026-04-04T09:10:00.000Z",
              },
            ],
            dailyPlan: {
              id: "plan_1",
              tenantId: "tenant_mentoria",
              studentId: "student_1",
              planDate: "2026-04-04",
              recommendedDuration: 30,
              tasks: [
                {
                  id: "task_practice",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "practice",
                  difficulty: 3,
                  completed: true,
                },
                {
                  id: "task_challenge",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "challenge",
                  difficulty: 4,
                  completed: false,
                },
              ],
              priority: "medium",
              adaptationReason: "Hoy puedes consolidar y luego subir un paso.",
              generatedAt: "2026-04-04T08:00:00.000Z",
              createdAt: "2026-04-04T08:00:00.000Z",
              updatedAt: "2026-04-04T09:10:00.000Z",
              completedTaskIds: ["task_practice"],
              completionRate: 0.5,
            },
          }),
        ),
      );

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    fireEvent.change(screen.getByPlaceholderText("Escribe tu respuesta"), {
      target: { value: "5/6" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Corregir respuesta" }));

    await waitFor(() => {
      expect(screen.getByText("Siguiente accion: Matematicas - reto corto")).toBeInTheDocument();
      expect(screen.getByText("Lanzar siguiente reto")).toBeInTheDocument();
    });
  });

  it("recalculates the second action downward when the first exercise shows friction", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
            exercises: [
              {
                id: "exercise_1",
                tenantId: "tenant_mentoria",
                studentProfileId: "student_1",
                subjectId: "subject_matematicas",
                prompt: "Resuelve una resta de fracciones.",
                expectedCompetency: "Restas de fracciones",
                difficultyLevel: "medium",
                hints: ["Busca el comun denominador"],
                answerFormat: "text",
                status: "pending",
                createdAt: "2026-04-04T09:00:00.000Z",
                updatedAt: "2026-04-04T09:00:00.000Z",
              },
            ],
            dailyPlan: {
              id: "plan_1",
              tenantId: "tenant_mentoria",
              studentId: "student_1",
              planDate: "2026-04-04",
              recommendedDuration: 30,
              tasks: [
                {
                  id: "task_practice",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "practice",
                  difficulty: 3,
                  completed: false,
                },
                {
                  id: "task_review",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "review",
                  difficulty: 1,
                  completed: false,
                },
              ],
              priority: "medium",
              adaptationReason: "Hoy conviene consolidar antes de subir dificultad.",
              generatedAt: "2026-04-04T08:00:00.000Z",
              createdAt: "2026-04-04T08:00:00.000Z",
              updatedAt: "2026-04-04T08:00:00.000Z",
              completedTaskIds: [],
              completionRate: 0,
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          exercise: {
            id: "exercise_1",
            tenantId: "tenant_mentoria",
            studentProfileId: "student_1",
            subjectId: "subject_matematicas",
            prompt: "Resuelve una resta de fracciones.",
            expectedCompetency: "Restas de fracciones",
            difficultyLevel: "medium",
            hints: ["Busca el comun denominador"],
            answerFormat: "text",
            studentAnswer: "1/8",
            correctionFeedback: "Necesitas reforzar la base antes de seguir.",
            status: "corrected",
            score: 42,
            createdAt: "2026-04-04T09:00:00.000Z",
            updatedAt: "2026-04-04T09:10:00.000Z",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
            exercises: [
              {
                id: "exercise_1",
                tenantId: "tenant_mentoria",
                studentProfileId: "student_1",
                subjectId: "subject_matematicas",
                prompt: "Resuelve una resta de fracciones.",
                expectedCompetency: "Restas de fracciones",
                difficultyLevel: "medium",
                hints: ["Busca el comun denominador"],
                answerFormat: "text",
                studentAnswer: "1/8",
                correctionFeedback: "Necesitas reforzar la base antes de seguir.",
                status: "corrected",
                score: 42,
                createdAt: "2026-04-04T09:00:00.000Z",
                updatedAt: "2026-04-04T09:10:00.000Z",
              },
            ],
            dailyPlan: {
              id: "plan_1",
              tenantId: "tenant_mentoria",
              studentId: "student_1",
              planDate: "2026-04-04",
              recommendedDuration: 30,
              tasks: [
                {
                  id: "task_practice",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "practice",
                  difficulty: 3,
                  completed: true,
                },
                {
                  id: "task_review",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "review",
                  difficulty: 1,
                  completed: false,
                },
              ],
              priority: "medium",
              adaptationReason: "Hoy conviene consolidar antes de subir dificultad.",
              generatedAt: "2026-04-04T08:00:00.000Z",
              createdAt: "2026-04-04T08:00:00.000Z",
              updatedAt: "2026-04-04T09:10:00.000Z",
              completedTaskIds: ["task_practice"],
              completionRate: 0.5,
            },
          }),
        ),
      );

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    fireEvent.change(screen.getByPlaceholderText("Escribe tu respuesta"), {
      target: { value: "1/8" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Corregir respuesta" }));

    await waitFor(() => {
      expect(screen.getByText("Siguiente accion: Matematicas - repaso guiado")).toBeInTheDocument();
      expect(screen.getByText("Abrir ayuda guiada")).toBeInTheDocument();
    });
  });

  it("gives the user a clear reentry point with recent context and a resume CTA", async () => {
    const recentActivityAt = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
            motivation: {
              studentId: "student_1",
              streak: 3,
              lastActivityAt: recentActivityAt,
              effortScore: 0.72,
              rewardPoints: 120,
              level: 2,
              achievements: ["constancia_inicial"],
              motivationProfile: "stable",
            },
            dailyPlan: {
              id: "plan_1",
              tenantId: "tenant_mentoria",
              studentId: "student_1",
              planDate: "2026-04-04",
              recommendedDuration: 30,
              tasks: [
                {
                  id: "task_review",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "review",
                  difficulty: 2,
                  completed: true,
                },
                {
                  id: "task_practice",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "practice",
                  difficulty: 3,
                  completed: false,
                },
              ],
              priority: "medium",
              adaptationReason: "Hoy conviene reforzar base antes de subir dificultad.",
              generatedAt: "2026-04-04T08:00:00.000Z",
              createdAt: "2026-04-04T08:00:00.000Z",
              updatedAt: "2026-04-04T08:30:00.000Z",
              completedTaskIds: ["task_review"],
              completionRate: 0.5,
            },
            recentSessions: [
              {
                id: "session_1",
                tenantId: "tenant_mentoria",
                studentProfileId: "student_1",
                subjectId: "subject_matematicas",
                mentorId: "mentor_1",
                clientId: "student_1",
                topic: "Fracciones",
                status: "completed",
                durationMinutes: 20,
                aiTokensUsed: 300,
                emotionalState: "steady",
                tutorSummary: "La ultima vez dejaste clara la base para sumar fracciones.",
                recommendedNextStep: "Retoma ahora con una practica corta de suma de fracciones.",
                transcript: [
                  { role: "student", content: "No entiendo las fracciones", createdAt: "2026-04-03T00:00:00.000Z" },
                  { role: "tutor", content: "Vamos paso a paso", createdAt: "2026-04-03T00:01:00.000Z" },
                ],
                createdAt: "2026-04-03T00:00:00.000Z",
                updatedAt: recentActivityAt,
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          reply: "Vamos a seguir justo desde la practica que quedo pendiente.",
          explanation: "Primero retomamos el ejemplo corto que dejaste preparado.",
          suggestedSteps: ["Recuerda el comun denominador", "Haz una suma corta antes del reto"],
          reinforcementQuestion: "Que parte del ultimo paso recuerdas mejor?",
          subject: { name: "Matematicas", slug: "matematicas" },
          session: {
            id: "session_2",
            topic: "Fracciones",
            recommendedNextStep: "Haz ahora una suma guiada de fracciones equivalentes.",
          },
          sessionFeedback: {
            progressMessage: "Has retomado el hilo sin empezar desde cero.",
            scoreChange: 2,
            masteryLevel: "en progreso",
            confidenceLevel: "estable",
            nextSteps: ["Haz ahora una suma guiada de fracciones equivalentes."],
            encouragement: "Buen regreso: ya estas otra vez dentro del problema correcto.",
            completionMessage: "Retomaste exactamente el punto que habias dejado preparado.",
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse()));

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    expect(screen.getByText("Retoma tu punto")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retomar esta sesion" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Fracciones")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Haz ahora una suma guiada de fracciones equivalentes.")).toBeInTheDocument();
    });
    expect(screen.getByText("Retomaste exactamente el punto que habias dejado preparado.")).toBeInTheDocument();
    expect(screen.getByText("Has retomado el hilo sin empezar desde cero.")).toBeInTheDocument();
  });

  it("switches to a gentle restart when the user returns after days away or with a fragile profile", async () => {
    const recentActivityAt = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
            motivation: {
              studentId: "student_1",
              streak: 1,
              lastActivityAt: recentActivityAt,
              effortScore: 0.35,
              rewardPoints: 40,
              level: 1,
              achievements: [],
              motivationProfile: "fragile",
            },
            dailyPlan: {
              id: "plan_1",
              tenantId: "tenant_mentoria",
              studentId: "student_1",
              planDate: "2026-04-04",
              recommendedDuration: 30,
              tasks: [
                {
                  id: "task_challenge",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "challenge",
                  difficulty: 4,
                  completed: false,
                },
                {
                  id: "task_review",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "review",
                  difficulty: 1,
                  completed: false,
                },
              ],
              priority: "medium",
              adaptationReason: "Hoy conviene recuperar ritmo con una base guiada.",
              generatedAt: "2026-04-04T08:00:00.000Z",
              createdAt: "2026-04-04T08:00:00.000Z",
              updatedAt: "2026-04-04T08:30:00.000Z",
              completedTaskIds: [],
              completionRate: 0,
            },
            recentSessions: [
              {
                id: "session_1",
                tenantId: "tenant_mentoria",
                studentProfileId: "student_1",
                subjectId: "subject_matematicas",
                mentorId: "mentor_1",
                clientId: "student_1",
                topic: "Fracciones",
                status: "completed",
                durationMinutes: 20,
                aiTokensUsed: 300,
                emotionalState: "steady",
                tutorSummary: "La ultima sesion quedo bien cerrada, pero hoy conviene reenganchar con algo sencillo.",
                recommendedNextStep: "Resuelve una practica larga de fracciones.",
                transcript: [],
                createdAt: "2026-04-01T00:00:00.000Z",
                updatedAt: recentActivityAt,
              },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          reply: "Vamos a volver con un paso pequeno y muy guiado.",
          explanation: "Solo haremos una suma corta para recuperar la base sin presion.",
          suggestedSteps: ["Recuerda que significa cada fraccion", "Haz una comprobacion muy corta"],
          reinforcementQuestion: "Que parte te parece mas facil retomar ahora mismo?",
          subject: { name: "Matematicas", slug: "matematicas" },
          session: {
            id: "session_2",
            topic: "Repaso de Matematicas",
            recommendedNextStep: "Haz una suma guiada de fracciones muy corta.",
          },
          sessionFeedback: {
            progressMessage: "Hoy has vuelto con una accion facil y clara.",
            scoreChange: 1,
            masteryLevel: "reinicio guiado",
            confidenceLevel: "recuperando",
            nextSteps: ["Haz una suma guiada de fracciones muy corta."],
            encouragement: "Buen comienzo: ya has recuperado el hilo sin sobrecargarte.",
            completionMessage: "Primer paso del reenganche completado con una ayuda suave.",
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse()));

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    fireEvent.click(screen.getByRole("button", { name: "Retomar esta sesion" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Repaso de Matematicas")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Haz una suma guiada de fracciones muy corta.")).toBeInTheDocument();
    });
    expect(screen.getByText("Primer paso del reenganche completado con una ayuda suave.")).toBeInTheDocument();
    expect(screen.getByText("Hoy has vuelto con una accion facil y clara.")).toBeInTheDocument();
  });

  it("uses a stronger first action when the student returns with momentum and a high streak", async () => {
    const recentActivityAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
            motivation: {
              studentId: "student_1",
              streak: 5,
              lastActivityAt: recentActivityAt,
              effortScore: 0.91,
              rewardPoints: 210,
              level: 3,
              achievements: ["Constancia sostenida"],
              motivationProfile: "high_performer",
            },
            dailyPlan: {
              id: "plan_1",
              tenantId: "tenant_mentoria",
              studentId: "student_1",
              planDate: "2026-04-04",
              recommendedDuration: 35,
              tasks: [
                {
                  id: "task_review",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "review",
                  difficulty: 2,
                  completed: false,
                },
                {
                  id: "task_challenge",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "challenge",
                  difficulty: 4,
                  completed: false,
                },
              ],
              priority: "high",
              adaptationReason: "Hoy puede subir un paso de dificultad.",
              generatedAt: "2026-04-04T08:00:00.000Z",
              createdAt: "2026-04-04T08:00:00.000Z",
              updatedAt: "2026-04-04T08:30:00.000Z",
              completedTaskIds: [],
              completionRate: 0,
            },
            recentSessions: [],
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          exercise: {
            id: "exercise_1",
            tenantId: "tenant_mentoria",
            studentProfileId: "student_1",
            subjectId: "subject_matematicas",
            prompt: "Resuelve un reto corto de fracciones.",
            answerFormat: "text",
            expectedAnswer: "7/9",
            hints: ["Piensa en el comun denominador antes de operar"],
            difficultyLevel: "hard",
            status: "pending",
            createdAt: "2026-04-04T09:00:00.000Z",
            updatedAt: "2026-04-04T09:00:00.000Z",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
            motivation: {
              studentId: "student_1",
              streak: 5,
              lastActivityAt: recentActivityAt,
              effortScore: 0.91,
              rewardPoints: 210,
              level: 3,
              achievements: ["Constancia sostenida"],
              motivationProfile: "high_performer",
            },
            dailyPlan: {
              id: "plan_1",
              tenantId: "tenant_mentoria",
              studentId: "student_1",
              planDate: "2026-04-04",
              recommendedDuration: 35,
              tasks: [
                {
                  id: "task_review",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "review",
                  difficulty: 2,
                  completed: false,
                },
                {
                  id: "task_challenge",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "challenge",
                  difficulty: 4,
                  completed: false,
                },
              ],
              priority: "high",
              adaptationReason: "Hoy puede subir un paso de dificultad.",
              generatedAt: "2026-04-04T08:00:00.000Z",
              createdAt: "2026-04-04T08:00:00.000Z",
              updatedAt: "2026-04-04T08:30:00.000Z",
              completedTaskIds: [],
              completionRate: 0,
            },
            recentSessions: [],
            exercises: [
              {
                id: "exercise_1",
                tenantId: "tenant_mentoria",
                studentProfileId: "student_1",
                subjectId: "subject_matematicas",
                prompt: "Resuelve un reto corto de fracciones.",
                answerFormat: "text",
                expectedAnswer: "7/9",
                hints: ["Piensa en el comun denominador antes de operar"],
                difficultyLevel: "hard",
                status: "pending",
                createdAt: "2026-04-04T09:00:00.000Z",
                updatedAt: "2026-04-04T09:00:00.000Z",
              },
            ],
          }),
        ),
      );

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    expect(screen.getByRole("button", { name: "Abrir siguiente paso" })).toBeInTheDocument();
    expect(screen.queryByText("Modo de hoy: subir un paso")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir siguiente paso" }));

    await waitFor(() => {
      expect(screen.getByText("Hoy vienes con ritmo: Matematicas - reto corto. Vamos a aprovecharlo con una primera accion un poco mas ambiciosa.")).toBeInTheDocument();
    });
  });

  it("falls back to the daily plan as the reentry hook when there is no recent session", async () => {
    const recentActivityAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
            motivation: {
              studentId: "student_1",
              streak: 2,
              lastActivityAt: recentActivityAt,
              effortScore: 0.68,
              rewardPoints: 90,
              level: 2,
              achievements: [],
              motivationProfile: "stable",
            },
            dailyPlan: {
              id: "plan_1",
              tenantId: "tenant_mentoria",
              studentId: "student_1",
              planDate: "2026-04-04",
              recommendedDuration: 30,
              tasks: [
                {
                  id: "task_practice",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "practice",
                  difficulty: 3,
                  completed: false,
                },
              ],
              priority: "medium",
              adaptationReason: "Hoy conviene reforzar base antes de subir dificultad.",
              generatedAt: "2026-04-04T08:00:00.000Z",
              createdAt: "2026-04-04T08:00:00.000Z",
              updatedAt: "2026-04-04T08:30:00.000Z",
              completedTaskIds: [],
              completionRate: 0,
            },
            recentSessions: [],
          }),
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          exercise: {
            id: "exercise_1",
            tenantId: "tenant_mentoria",
            studentProfileId: "student_1",
            subjectId: "subject_matematicas",
            prompt: "Resuelve una suma de fracciones equivalentes.",
            answerFormat: "text",
            expectedAnswer: "5/6",
            hints: ["Busca el comun denominador"],
            difficultyLevel: "medium",
            status: "pending",
            createdAt: "2026-04-04T09:00:00.000Z",
            updatedAt: "2026-04-04T09:00:00.000Z",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          buildWorkspaceResponse({
            studentSubjects: [buildStudentSubject()],
            motivation: {
              studentId: "student_1",
              streak: 2,
              lastActivityAt: recentActivityAt,
              effortScore: 0.68,
              rewardPoints: 90,
              level: 2,
              achievements: [],
              motivationProfile: "stable",
            },
            dailyPlan: {
              id: "plan_1",
              tenantId: "tenant_mentoria",
              studentId: "student_1",
              planDate: "2026-04-04",
              recommendedDuration: 30,
              tasks: [
                {
                  id: "task_practice",
                  subject: "Matematicas",
                  subjectId: "subject_matematicas",
                  type: "practice",
                  difficulty: 3,
                  completed: false,
                },
              ],
              priority: "medium",
              adaptationReason: "Hoy conviene reforzar base antes de subir dificultad.",
              generatedAt: "2026-04-04T08:00:00.000Z",
              createdAt: "2026-04-04T08:00:00.000Z",
              updatedAt: "2026-04-04T08:30:00.000Z",
              completedTaskIds: [],
              completionRate: 0,
            },
            recentSessions: [],
            exercises: [
              {
                id: "exercise_1",
                tenantId: "tenant_mentoria",
                studentProfileId: "student_1",
                subjectId: "subject_matematicas",
                prompt: "Resuelve una suma de fracciones equivalentes.",
                answerFormat: "text",
                expectedAnswer: "5/6",
                hints: ["Busca el comun denominador"],
                difficultyLevel: "medium",
                status: "pending",
                createdAt: "2026-04-04T09:00:00.000Z",
                updatedAt: "2026-04-04T09:00:00.000Z",
              },
            ],
          }),
        ),
      );

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });
    fireEvent.click(screen.getByRole("button", { name: "Abrir siguiente paso" }));

    await waitFor(() => {
      expect(screen.getByText("Practica lista para Matematicas. Cuando la completes, el plan se actualizara aqui mismo.")).toBeInTheDocument();
    });
  });

  it("uses session feedback to make the next guided step explicit after a tutor reply", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse()))
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          reply: "Vamos a dividir el problema en partes pequenas.",
          chatMessage: "Vamos a dividir el problema en partes pequenas.",
          subjectSlug: "matematicas",
          topic: "Fracciones",
          boardUpdate: {
            studentId: "student_1",
            subjectSlug: "matematicas",
            subjectName: "Matematicas",
            studentName: "Alex",
            schoolYear: "2 ESO",
            topic: "Fracciones",
            mode: "summary",
            conceptDefinition: "Ya tienes una base clara para seguir con un ejemplo real.",
            explanation: ["Primero mira el denominador comun."],
            steps: ["Encuentra el comun denominador"],
            example: "Ejemplo guiado con dos fracciones equivalentes.",
            formula: null,
            diagram: null,
            exercise: null,
            correction: null,
            nextAction: "Resuelve ahora un ejemplo con dos fracciones equivalentes.",
            updatedAt: "2026-04-24T10:30:00.000Z",
          },
          explanation: "Primero mira el denominador comun.",
          suggestedSteps: ["Encuentra el comun denominador"],
          reinforcementQuestion: "Que parte del denominador te esta frenando?",
          subject: { name: "Matematicas", slug: "matematicas" },
          session: {
            id: "session_1",
            topic: "Fracciones",
            recommendedNextStep: "Resuelve ahora un ejemplo con dos fracciones equivalentes.",
          },
          sessionFeedback: {
            progressMessage: "Has mejorado un poco la seguridad en fracciones.",
            scoreChange: 3,
            masteryLevel: "en progreso",
            confidenceLevel: "subiendo",
            nextSteps: ["Resuelve ahora un ejemplo con dos fracciones equivalentes."],
            encouragement: "Buen avance: ya tienes una primera base para seguir.",
            completionMessage: "Sesion cerrada con una mejora visible en Matematicas.",
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(buildWorkspaceResponse()));

    render(React.createElement(MentoriaWorkspace));

    await screen.findByRole("heading", { name: "Hola, Alex" });

    fireEvent.change(screen.getByPlaceholderText("Escribe tu duda o cuéntame qué no entendiste"), {
      target: { value: "No entiendo fracciones" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Sesion cerrada con una mejora visible en Matematicas.")).toBeInTheDocument();
    expect(screen.getByText("Has mejorado un poco la seguridad en fracciones.")).toBeInTheDocument();
    expect(screen.getByText("Buen avance: ya tienes una primera base para seguir.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Siguiente paso" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Resuelve ahora un ejemplo con dos fracciones equivalentes.")).toBeInTheDocument();
    });
  });

  it("lets the user resume the latest persisted session after returning to the workspace", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        buildWorkspaceResponse({
          studentSubjects: [buildStudentSubject()],
          recentSessions: [
            {
              id: "session_1",
              tenantId: "tenant_mentoria",
              studentProfileId: "student_1",
              subjectId: "subject_matematicas",
              mentorId: "mentor_1",
              clientId: "student_1",
              topic: "Fracciones",
              status: "completed",
              durationMinutes: 20,
              aiTokensUsed: 300,
              emotionalState: "steady",
              tutorSummary: "Has entendido mejor como comparar fracciones equivalentes.",
              recommendedNextStep: "Resuelve un ejemplo corto de suma de fracciones.",
              transcript: [
                { role: "student", content: "No entiendo las fracciones", createdAt: "2026-04-03T00:00:00.000Z" },
                { role: "tutor", content: "Vamos paso a paso", createdAt: "2026-04-03T00:01:00.000Z" },
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
    expect(screen.getAllByText("Has entendido mejor como comparar fracciones equivalentes.").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Retomar esta sesion" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Fracciones")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Resuelve un ejemplo corto de suma de fracciones.")).toBeInTheDocument();
    });
  });
});
