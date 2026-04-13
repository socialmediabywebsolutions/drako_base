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
        primaryGuardian: null,
        student: null,
        profile: null,
        subjects: onboardingSubjects,
        studentSubjects: [],
      }),
    );

    render(React.createElement(MentoriaOnboardingWizard));

    await screen.findByText("Vamos a ayudar a tu hijo de verdad");

    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    await screen.findByText("Quien esta acompanando a tu hijo/a?");

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Escribe el nombre del tutor principal.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Nombre completo del tutor principal"), {
      target: { value: "Marta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("Cuentanos sobre tu hijo/a");

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Escribe el nombre del alumno.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Nombre del alumno/a"), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Selecciona el curso del alumno.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "2 ESO" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("Donde necesita mas ayuda?");
  });

  it("submits the canonical onboarding payload and renders the activation result", async () => {
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

    await screen.findByText("Vamos a ayudar a tu hijo de verdad");

    fireEvent.click(screen.getByRole("button", { name: "Empezar" }));
    await screen.findByText("Quien esta acompanando a tu hijo/a?");

    fireEvent.change(screen.getByPlaceholderText("Nombre completo del tutor principal"), {
      target: { value: "Marta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("Cuentanos sobre tu hijo/a");
    fireEvent.change(screen.getByPlaceholderText("Nombre del alumno/a"), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "2 ESO" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("Donde necesita mas ayuda?");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("Que te gustaria que cambiara primero?");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("Todo listo. Ya estamos con el.");
    fireEvent.click(screen.getByRole("button", { name: "Dejar todo listo" }));

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
        relation: "tutor",
      },
      student: {
        fullName: "Alex",
        schoolYear: "2 ESO",
      },
      subjects: [{ subjectSlug: "matematicas", initialLevel: "me_cuesta_mucho" }],
      goal: "improve_understanding",
      confidenceLevel: "medium",
    });

    await screen.findAllByText("Primera ayuda guiada");
    expect(screen.getByText("Matematicas - Practica - D2")).toBeInTheDocument();
    expect(screen.getByText("Resolver un primer ejercicio")).toBeInTheDocument();
  });
});
