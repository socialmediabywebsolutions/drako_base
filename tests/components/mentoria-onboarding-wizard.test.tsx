import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { MentoriaOnboardingWizard } from "@/components/mentoria-app/onboarding-wizard";

const fetchMock = vi.spyOn(global, "fetch");
const navigationMock = vi.hoisted(() => ({
  searchParams: {
    get: vi.fn((_name: string) => null),
  },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => navigationMock.searchParams,
}));

globalThis.React = React;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const onboardingSubjects = [
  {
    id: "subject_matematicas",
    tenantId: "tenant_mentoria",
    slug: "matematicas",
    name: "Matematicas",
    description: "Refuerzo guiado",
    difficultyBand: "core",
    createdAt: "2026-04-03T00:00:00.000Z",
    updatedAt: "2026-04-03T00:00:00.000Z",
  },
];

describe("MentoriaOnboardingWizard", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    navigationMock.searchParams.get.mockReturnValue(null);
    window.localStorage.clear();
  });

  it("shows actionable validation in the blocked student-data step and advances once the contract is complete", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        primaryGuardian: null,
        student: null,
        profile: null,
        subjects: onboardingSubjects,
        studentSubjects: [],
      }),
    );

    render(React.createElement(MentoriaOnboardingWizard));

    await screen.findByText("Quienes sois");

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Escribe el nombre del tutor principal.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Nombre del tutor principal"), {
      target: { value: "Marta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Escribe el nombre del alumno.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Nombre del alumno/a"), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("Donde esta hoy");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Selecciona el curso real del alumno.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "2 ESO" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Indica si ha repetido curso.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "No ha repetido" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Selecciona la materia o foco principal.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Matematicas" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("Con que arrancamos");
  });

  it("submits the canonical three-step onboarding payload and renders the activation result", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          primaryGuardian: null,
          student: null,
          profile: null,
          subjects: onboardingSubjects,
          studentSubjects: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          activation: {
            reply: "Primera ayuda guiada",
            subjectName: "Matematicas",
            nextActions: ["Resolver un primer ejercicio"],
            dailyPlan: {
              id: "daily_1",
              tenantId: "tenant_mentoria",
              studentId: "student_1",
              planDate: "2026-04-03",
              recommendedDuration: 30,
              tasks: [
                {
                  id: "task_1",
                  subject: "Matematicas",
                  type: "practice",
                  difficulty: 2,
                  completed: false,
                },
              ],
              priority: "medium",
              adaptationReason: "Inicio",
              generatedAt: "2026-04-03T00:00:00.000Z",
              createdAt: "2026-04-03T00:00:00.000Z",
              updatedAt: "2026-04-03T00:00:00.000Z",
              completedTaskIds: [],
              completionRate: 0,
            },
          },
          progress: [],
        }),
      );

    render(React.createElement(MentoriaOnboardingWizard));

    await screen.findByText("Quienes sois");

    fireEvent.change(screen.getByPlaceholderText("Nombre del tutor principal"), {
      target: { value: "Marta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Madre" }));
    fireEvent.click(screen.getByRole("button", { name: /Padres separados/ }));
    fireEvent.change(screen.getByPlaceholderText("Nombre del segundo tutor"), {
      target: { value: "Carlos" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email del segundo tutor (opcional)"), {
      target: { value: "carlos@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Nombre del alumno/a"), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("Donde esta hoy");
    fireEvent.click(screen.getByRole("button", { name: "2 ESO" }));
    fireEvent.click(screen.getByRole("button", { name: "Si, ha repetido" }));
    fireEvent.click(screen.getByRole("button", { name: "Matematicas" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("Con que arrancamos");
    fireEvent.click(screen.getByRole("button", { name: /Examen cerca/ }));
    fireEvent.click(screen.getByRole("button", { name: "Preparar espacio" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const request = fetchMock.mock.calls[1]?.[1];
    expect(request).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const payload = JSON.parse(String(request?.body));
    expect(payload).toEqual({
      primaryGuardian: {
        fullName: "Marta",
        relation: "mother",
      },
      secondaryGuardian: {
        fullName: "Carlos",
        relation: "father",
        email: "carlos@example.com",
      },
      familyStructure: "separated_parents",
      student: {
        fullName: "Alex",
        stage: "eso",
        schoolYear: "2 ESO",
        hasRepeatedCourse: true,
      },
      subjects: [{ subjectSlug: "matematicas", initialLevel: "me_cuesta_mucho" }],
      goal: "pass_subject",
      confidenceLevel: "medium",
      initialPriority: "exam",
      primaryConcern: "Examen cerca",
    });

    await screen.findByRole("button", { name: "Entrar a Mentoria" });
    expect(screen.getByText("Tu espacio ya esta preparado.")).toBeInTheDocument();
  });
});
