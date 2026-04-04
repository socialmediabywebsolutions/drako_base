import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { MentoriaOnboardingWizard } from "@/components/mentoria-app/onboarding-wizard";

const fetchMock = vi.spyOn(global, "fetch");

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: () => null,
  }),
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
    window.localStorage.clear();
  });

  it("shows actionable validation in the blocked student-data step and advances once the contract is complete", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        profile: null,
        subjects: onboardingSubjects,
        studentSubjects: [],
        parents: [],
      }),
    );

    render(React.createElement(MentoriaOnboardingWizard));

    await screen.findByText("1. Quien acompana al alumno?");

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Escribe el nombre del tutor principal.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Tu nombre (padre, madre o tutor)"), {
      target: { value: "Marta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("2. Cuentanos quien eres");

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Escribe el nombre del alumno.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Tu nombre"), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Selecciona el curso del alumno.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "2 ESO" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("3. En que materias quieres que te acompanemos");
  });

  it("submits the canonical onboarding payload and renders the activation result", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          profile: null,
          subjects: onboardingSubjects,
          studentSubjects: [],
          parents: [],
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

    await screen.findByText("1. Quien acompana al alumno?");

    fireEvent.change(screen.getByPlaceholderText("Tu nombre (padre, madre o tutor)"), {
      target: { value: "Marta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("2. Cuentanos quien eres");
    fireEvent.change(screen.getByPlaceholderText("Tu nombre"), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "2 ESO" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("3. En que materias quieres que te acompanemos");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("4. Objetivo principal");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("5. Ajustamos el punto de salida");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("6. Activamos tu primer momento de valor");
    fireEvent.click(screen.getByRole("button", { name: "Activar Mentoria ahora" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const request = fetchMock.mock.calls[1]?.[1];
    expect(request).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const payload = JSON.parse(String(request?.body));
    expect(payload).toEqual({
      guardianName: "Marta",
      fullName: "Alex",
      age: 13,
      schoolYear: "2 ESO",
      subjects: [{ subjectSlug: "matematicas", initialLevel: "me_cuesta_mucho" }],
      objective: "improve_understanding",
      confidenceLevel: "medium",
    });

    await screen.findAllByText("Primera ayuda guiada");
    expect(screen.getByText("Matematicas - Practica - D2")).toBeInTheDocument();
    expect(screen.getByText("Resolver un primer ejercicio")).toBeInTheDocument();
  });
});
