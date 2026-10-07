"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type MentoriaAppSectionNavProps = {
  active: "workspace" | "academic" | "progress" | "parents" | "logros";
};

export function MentoriaAppSectionNav({ active }: MentoriaAppSectionNavProps) {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId")?.trim() || "";

  function buildHref(path: string) {
    if (!studentId) return path;
    const url = new URL(path, "https://mentoria.drako.systems");
    url.searchParams.set("studentId", studentId);
    return `${url.pathname}${url.search}`;
  }

  const items = [
    { id: "workspace", label: "Aula", href: "/mentoria/app/workspace" },
    { id: "academic", label: "Vida académica", href: "/mentoria/app/academic" },
    { id: "progress", label: "Mi progreso", href: "/mentoria/app/progress" },
    { id: "parents", label: "Familia", href: "/mentoria/app/parents" },
    { id: "logros", label: "🏆 Logros", href: "/mentoria/app/logros" },
  ] as const;

  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <Link
            key={item.id}
            href={buildHref(item.href)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              isActive ? "bg-emerald-600 text-white" : "bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
