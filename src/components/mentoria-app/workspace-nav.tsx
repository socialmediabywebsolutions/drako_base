"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { StudentProfile, MentoriaStudentSubject, MentoriaProgress, LearningSession, FocusSession, ParentAccount } from "@/lib/mentoria/types";

type WorkspaceNavProps = {
  student: StudentProfile | null;
  studentSubjects: MentoriaStudentSubject[];
  progress: MentoriaProgress[];
  recentSessions: LearningSession[];
  focusSessions: FocusSession[];
  parents: ParentAccount[];
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
  parents,
  activeSection,
  activeSubjectSlug,
  onSectionChange,
  onSubjectSelect,
}: WorkspaceNavProps) {
  const [subjectsExpanded, setSubjectsExpanded] = useState(true);
  const activeSubject = studentSubjects.find((subject) => subject.subject?.slug === activeSubjectSlug) ?? null;
  const navItems = [
    { id: "board", label: "Pizarra", icon: "📝", count: null },
    { id: "subjects", label: "Materias", icon: "📚", count: studentSubjects.length },
    { id: "sessions", label: "Sesiones", icon: "💬", count: recentSessions.length },
    { id: "progress", label: "Progreso", icon: "📊", count: progress.length },
    { id: "planner", label: "Planificador", icon: "📅", count: null },
    { id: "focus", label: "Foco", icon: "⏱️", count: focusSessions.length },
    { id: "exercises", label: "Ejercicios", icon: "✏️", count: null },
    { id: "memory", label: "Memoria", icon: "🧠", count: null },
  ];
  const progressBySubjectId = useMemo(() => new Map(progress.map((item) => [item.subjectId, item])), [progress]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700">
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
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Materia activa</div>
            <div className="mt-1 text-sm font-semibold text-emerald-950">{activeSubject.subject.name}</div>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          if (item.id === "subjects") {
            return (
              <div key={item.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setSubjectsExpanded((current) => !current);
                    onSectionChange("subjects");
                  }}
                  className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    activeSection === item.id || Boolean(activeSubjectSlug) || subjectsExpanded
                      ? "bg-emerald-50 text-emerald-900"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.count !== null && item.count > 0 && (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {item.count}
                        </span>
                      )}
                      <span className="text-xs">{subjectsExpanded ? "−" : "+"}</span>
                    </div>
                  </div>
                </button>

                {subjectsExpanded && (
                  <div className="space-y-1 pl-3">
                    {studentSubjects.map((subject) => {
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
                          className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                            isActive
                              ? "border-emerald-300 bg-emerald-50 text-emerald-950 shadow-sm ring-1 ring-emerald-100"
                              : "border-transparent bg-slate-50/80 text-slate-700 hover:border-slate-200 hover:bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold">{subjectName}</span>
                            {subjectProgress ? (
                              <span className="text-[11px] font-semibold text-slate-500">{subjectProgress.masteryScore}%</span>
                            ) : null}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                            {isActive ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">activa</span> : null}
                            <span className="rounded-full bg-white/80 px-2 py-0.5 text-slate-500">
                            {subjectProgress
                              ? `${subjectProgress.sessionsCompleted} sesiones · ${subjectProgress.exercisesCompleted} ejercicios`
                              : "Sin progreso consolidado aún"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

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
                  <span className="text-base">{item.icon}</span>
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

      {parents.length > 0 && (
        <div className="border-t border-slate-200 p-3">
          <Link
            href="/mentoria/app/parents"
            className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">👨‍👩‍👧</span>
              <span>Familia</span>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
