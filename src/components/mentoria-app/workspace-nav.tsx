"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, ChevronRight, MessageCircle, PanelLeft, Users } from "lucide-react";
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
  const activeSubject = studentSubjects.find((subject) => subject.subject?.slug === activeSubjectSlug) ?? null;
  const navItems = [
    { id: "board", label: "Pizarra", icon: PanelLeft, count: null },
    { id: "sessions", label: "Sesiones", icon: MessageCircle, count: recentSessions.length },
  ];
  const progressBySubjectId = useMemo(() => new Map(progress.map((item) => [item.subjectId, item])), [progress]);

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
            {student?.fullName?.charAt(0) ?? "M"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">
              {student?.fullName ?? "Alumno"}
            </div>
            <div className="truncate text-xs text-slate-500">
              {student?.schoolYear ?? "Mentoría"}
            </div>
          </div>
        </div>
        {activeSubject?.subject?.name ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Materia activa</div>
            <div className="mt-1 text-sm font-semibold text-emerald-950">{activeSubject.subject.name}</div>
          </div>
        ) : null}
      </div>

      <nav className="space-y-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                activeSection === item.id
                  ? "bg-emerald-50 text-emerald-900"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </div>
                {item.count !== null && item.count > 0 && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                    {item.count}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      <div className="flex-1 overflow-y-auto border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={() => {
            setSubjectsExpanded((current) => !current);
            onSectionChange("subjects");
          }}
          className="mb-2 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50"
        >
          <span className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            Materias
          </span>
          <span className="flex items-center gap-2 text-xs text-slate-500">
            {studentSubjects.length}
            {subjectsExpanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
          </span>
        </button>

        {subjectsExpanded && (
          <div className="space-y-2">
            {studentSubjects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500">
                Aún no hay materias configuradas.
              </div>
            ) : (
              studentSubjects.map((subject) => {
                const subjectName = subject.subject?.name ?? "Materia";
                const subjectSlug = subject.subject?.slug ?? "";
                const subjectProgress = progressBySubjectId.get(subject.subjectId);
                const isActive = Boolean(subjectSlug) && activeSubjectSlug === subjectSlug;

                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => {
                      if (!subjectSlug) return;
                      onSubjectSelect(subjectSlug);
                    }}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                      isActive
                        ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                        : "border-slate-100 bg-slate-50/70 text-slate-700 hover:border-slate-200 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{subjectName}</span>
                      {subjectProgress ? (
                        <span className="text-[11px] font-semibold text-slate-500">{subjectProgress.masteryScore}%</span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500">
                      {subjectProgress
                        ? (isActive ? "Trabajando aquí ahora" : "Lista para retomar")
                        : "Lista para empezar"}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {connectedGuardians.length > 0 && (
        <div className="border-t border-slate-200 p-3">
          <Link
            href="/mentoria/app/parents"
            className="block rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>Familia acompaña</span>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
