import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { MentoriaAcademicHub } from "@/components/mentoria-app/academic-hub";
import { MentoriaAcademicProgress } from "@/components/mentoria-app/academic-progress";

const fetchMock = vi.spyOn(global, "fetch");
const navigationMock = vi.hoisted(() => ({
  searchParams: {
    get: vi.fn((name: string) => (name === "studentId" ? "student_1" : null)),
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

describe("Mentoria academic pages", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    navigationMock.searchParams.get.mockImplementation((name: string) => (name === "studentId" ? "student_1" : null));
  });

  it("renders Vida académica with separated records, documents and manual entry", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          student: {
            id: "student_1",
            tenantId: "tenant_mentoria",
            learningStage: "eso",
            fullName: "Alex",
            age: 13,
            schoolYear: "2 ESO",
            learningGoals: [],
            baseEmotionalState: "steady",
            emotionalBaseline: {
              frustration: "medium",
              motivation: "medium",
              concentration: "medium",
            },
            learningPreference: "step_by_step",
            preferredStudyMinutes: 30,
            strengths: [],
            onboardingCompleted: true,
            createdAt: "2026-04-24T10:00:00.000Z",
            updatedAt: "2026-04-24T10:00:00.000Z",
          },
          records: [
            {
              id: "record_1",
              tenantId: "tenant_mentoria",
              studentProfileId: "student_1",
              subjectSlug: "matematicas",
              recordType: "exam",
              sourceChannel: "manual_web",
              sourceRefId: "manual:record_1",
              title: "Examen de mates",
              scoreValue: 8,
              scoreScale: 10,
              scoreLabel: "8/10",
              recordedAt: "2026-04-24T10:00:00.000Z",
              teacherComment: null,
              status: "confirmed",
              createdByActorType: "guardian",
              createdByActorId: "guardian_1",
              metadata: {},
              createdAt: "2026-04-24T10:00:00.000Z",
              updatedAt: "2026-04-24T10:00:00.000Z",
            },
          ],
          documents: [
            {
              id: "document_1",
              tenantId: "tenant_mentoria",
              studentProfileId: "student_1",
              academicRecordId: null,
              materialIntakeId: null,
              subjectSlug: "matematicas",
              documentKind: "pdf",
              classification: "exam",
              sourceChannel: "web_upload",
              sourceMessageId: null,
              storageKey: "examen.pdf:sha",
              mimeType: "application/pdf",
              fileName: "examen.pdf",
              sha256: "sha",
              capturedAt: "2026-04-24T10:00:00.000Z",
              notesText: "Examen final",
              analysisStatus: "pending",
              createdAt: "2026-04-24T10:00:00.000Z",
              updatedAt: "2026-04-24T10:00:00.000Z",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          record: { id: "record_2" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          ok: true,
          student: {
            id: "student_1",
            tenantId: "tenant_mentoria",
            learningStage: "eso",
            fullName: "Alex",
            age: 13,
            schoolYear: "2 ESO",
            learningGoals: [],
            baseEmotionalState: "steady",
            emotionalBaseline: {
              frustration: "medium",
              motivation: "medium",
              concentration: "medium",
            },
            learningPreference: "step_by_step",
            preferredStudyMinutes: 30,
            strengths: [],
            onboardingCompleted: true,
            createdAt: "2026-04-24T10:00:00.000Z",
            updatedAt: "2026-04-24T10:00:00.000Z",
          },
          records: [],
          documents: [],
        }),
      );

    render(React.createElement(MentoriaAcademicHub));

    expect(await screen.findByRole("heading", { name: "Vida académica" })).toBeInTheDocument();
    expect(screen.getByText("Registros reales y documentos de Alex.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subir documento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrada manual" })).toBeInTheDocument();
    expect(screen.getByText("Examen de mates")).toBeInTheDocument();
    expect(screen.getByText("examen.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analizar" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Entrada manual" }));
    fireEvent.change(screen.getByLabelText("Título"), {
      target: { value: "Control semanal" },
    });
    fireEvent.change(screen.getByLabelText("Nota"), {
      target: { value: "7" },
    });
    fireEvent.change(screen.getByLabelText("Comentario"), {
      target: { value: "Se bloqueó en el último ejercicio." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar registro" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const request = fetchMock.mock.calls[1];
    expect(request?.[0]).toBe("/api/mentoria/academic/records");
    expect(JSON.parse(String((request?.[1] as RequestInit | undefined)?.body))).toMatchObject({
      studentId: "student_1",
      title: "Control semanal",
      scoreValue: 7,
      scoreScale: 10,
    });
  });

  it("renders Mi progreso as a separated colegio-vs-Mentoría view", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        progress: {
          studentId: "student_1",
          subjects: [
            {
              subjectSlug: "matematicas",
              subjectName: "Matematicas",
              schoolAverageScore: 72,
              mentoriaMasteryScore: 65,
              mentoriaConfidenceScore: 60,
              trendDirection: "up",
              weakPoints: ["fracciones"],
              strongPoints: ["constancia"],
              notesCount: 4,
            },
          ],
          summary: {
            schoolAverageScore: 72,
            mentoriaMasteryAverage: 65,
            mentoriaConfidenceAverage: 60,
            strongestSubjects: ["Matematicas"],
            weakestSubjects: ["Lengua"],
          },
        },
      }),
    );

    render(React.createElement(MentoriaAcademicProgress));

    expect(await screen.findByRole("heading", { name: "Mi progreso" })).toBeInTheDocument();
    expect(screen.getByText("Comparativa clara entre colegio y Mentoría, sin mezclarlo con el aula.")).toBeInTheDocument();
    expect(screen.getByText("Evolución por materia")).toBeInTheDocument();
    expect(screen.getAllByText("Matematicas").length).toBeGreaterThan(0);
    expect(screen.getByText("Colegio 72 · Mentoría 65")).toBeInTheDocument();
    expect(screen.getByText(/fracciones/)).toBeInTheDocument();
    expect(screen.getByText(/constancia/)).toBeInTheDocument();
  });
});
