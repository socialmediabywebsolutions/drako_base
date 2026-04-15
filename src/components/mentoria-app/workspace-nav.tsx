"use client";

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
  onSectionChange: (section: string) => void;
};

export function WorkspaceNav({
  student,
  studentSubjects,
  progress,
  recentSessions,
  focusSessions,
  parents,
  activeSection,
  onSectionChange,
}: WorkspaceNavProps) {
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
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => (
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
        ))}
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
