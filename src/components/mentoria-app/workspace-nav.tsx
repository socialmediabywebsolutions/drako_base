"use client";

import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, LayoutPanelLeft, MessageCircleMore } from "lucide-react";
import type { StudentProfile, MentoriaStudentSubject, MentoriaProgress, LearningSession, FocusSession, MentoriaGuardian } from "@/lib/mentoria/types";

type WorkspaceNavProps = {
  student: StudentProfile | null;
  studentSubjects: MentoriaStudentSubject[];
  progress: MentoriaProgress[];
  recentSessions: LearningSession[];
  focusSessions: FocusSession[];
  connectedGuardians: MentoriaGuardian[];
  activeSection: string;
  activeSubjectSlug?: string | null;
  onSectionChange: (section: string) => void;
  onSubjectSelect: (subjectSlug: string) => void;
};

export function WorkspaceNav({
  student,
  studentSubjects,
  progress,
  recentSessions,
  focusSessions,
  connectedGuardians,
  activeSection,
  activeSubjectSlug,
  onSectionChange,
  onSubjectSelect,
}: WorkspaceNavProps) {
  const [subjectsExpanded, setSubjectsExpanded] = useState(true);
  const progressBySubjectId = useMemo(() => new Map(progress.map((item) => [item.subjectId, item])), [progress]);
  const familyLabel = connectedGuardians.length > 0
    ? `${connectedGuardians.length} tutor${connectedGuardians.length === 1 ? "" : "es"} vinculado${connectedGuardians.length === 1 ? "" : "s"}`
    : "Espacio individual";

  const navItems = [
    { id: "board", label: "Pizarra", icon: LayoutPanelLeft, count: null },
    { id: "sessions", label: "Sesiones", icon: MessageCircleMore, count: recentSessions.length + focusSessions.length },
  ];

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-200 px-4 py-5 lg:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-sm font-bold text-emerald-700">
            {student?.fullName?.charAt(0) ?? "M"}
          </div>
          <div className="min-w-0 flex-1 lg:block">
            <div className="truncate text-sm font-semibold text-slate-950">{student?.fullName ?? "Alumno"}</div>
            <div className="truncate text-xs text-slate-500">{student?.schoolYear ?? "Mentoria"}</div>
            <div className="mt-1 hidden text-[11px] text-slate-400 lg:block">{familyLabel}</div>
          </div>
        </div>
      </div>

      <nav className="space-y-1 px-3 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm font-medium transition ${
                isActive ? "bg-emerald-50 text-emerald-950" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="hidden lg:inline">{item.label}</span>
              </span>
              {item.count !== null && item.count > 0 ? (
                <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 lg:inline">
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-100 px-3 py-3">
        <button
          type="button"
          onClick={() => {
            setSubjectsExpanded((current) => !current);
            onSectionChange("subjects");
          }}
          className="mb-3 flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          <span className="flex items-center gap-3">
            <BookOpen className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <span className="hidden lg:inline">Materias</span>
          </span>
          <span className="hidden items-center gap-2 text-xs text-slate-500 lg:flex">
            {studentSubjects.length}
            {subjectsExpanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
          </span>
        </button>

        {subjectsExpanded ? (
          <div className="space-y-2">
            {studentSubjects.length === 0 ? (
              <div className="hidden rounded-2xl border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500 lg:block">
                Todavía no hay materias configuradas.
              </div>
            ) : (
              studentSubjects.map((subject) => {
                const subjectSlug = subject.subject?.slug ?? "";
                const subjectName = subject.subject?.name ?? "Materia";
                const isActive = Boolean(subjectSlug) && activeSubjectSlug === subjectSlug;
                const mastery = progressBySubjectId.get(subject.subjectId)?.masteryScore ?? null;

                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => {
                      if (subjectSlug) onSubjectSelect(subjectSlug);
                    }}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                      isActive
                        ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{subjectName}</span>
                      {mastery !== null ? (
                        <span className="hidden text-[11px] font-semibold text-slate-500 lg:inline">{mastery}%</span>
                      ) : null}
                    </div>
                    <div className="mt-1 hidden text-[11px] text-slate-500 lg:block">
                      {isActive ? "Materia abierta ahora" : "Lista para estudiar"}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
