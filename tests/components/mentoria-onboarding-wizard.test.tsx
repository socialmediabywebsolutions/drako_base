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

  it("blocks each step until the canonical contract is complete", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        primaryGuardian: null,
        student: null,
        profile: null,
        familyStudents: [],
        subjects: onboardingSubjects,
        studentSubjects: [],
        secondaryGuardians: [],
        guardianStudentAccess: [],
      }),
    );

    render(React.createElement(MentoriaOnboardingWizard));

    await screen.findByText("Quienes forman el espacio");

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

    await screen.findByText("Perfil academico real");
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Selecciona el curso real del alumno.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "2 ESO" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Indica si ha repetido curso.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /No ha repetido/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Selecciona al menos una materia real.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Matematicas" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("Base de arranque");
    fireEvent.click(screen.getByRole("button", { name: "Preparar espacio" }));
    expect(screen.getByText("Selecciona al menos una necesidad de apoyo real.")).toBeInTheDocument();
  });

  it("submits the canonical onboarding payload and redirects into the workspace", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          primaryGuardian: null,
          student: null,
          profile: null,
          familyStudents: [],
          subjects: onboardingSubjects,
          studentSubjects: [],
          secondaryGuardians: [],
          guardianStudentAccess: [],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          activation: {
            reply: "Tu estructura ya esta lista.",
          },
          progress: [],
        }),
      );

    render(React.createElement(MentoriaOnboardingWizard));

    await screen.findByText("Quienes forman el espacio");

    fireEvent.change(screen.getByPlaceholderText("Nombre del tutor principal"), {
      target: { value: "Marta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Madre" }));
    fireEvent.click(screen.getByRole("button", { name: /Padres separados/i }));
    fireEvent.change(screen.getByPlaceholderText("Nombre del segundo tutor"), {
      target: { value: "Carlos" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email del segundo tutor \(opcional\)"), {
      target: { value: "carlos@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Nombre del alumno/a"), {
      target: { value: "Alex" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("Perfil academico real");
    fireEvent.click(screen.getByRole("button", { name: "2 ESO" }));
    fireEvent.change(screen.getByPlaceholderText("Edad real del alumno"), {
      target: { value: "13" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ha repetido antes/i }));
    fireEvent.click(screen.getByRole("button", { name: "Matematicas" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    await screen.findByText("Base de arranque");
    fireEvent.click(screen.getByRole("button", { name: /Falta de base/i }));
    fireEvent.click(screen.getByRole("button", { name: /Se frustra rapido/i }));
    fireEvent.click(screen.getByRole("button", { name: /Paso a paso/i }));
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
        age: 13,
        repeatedCourseStatus: "before",
        repeatedCourseYears: [],
        subjects: [{ subjectSlug: "matematicas", initialLevel: "me_cuesta_mucho" }],
        supportNeeds: ["base_gap", "frustration"],
        supportStyle: "step_by_step",
      },
      additionalStudents: [],
      referralCode: undefined,
      inviteToken: undefined,
    });

  });
});
