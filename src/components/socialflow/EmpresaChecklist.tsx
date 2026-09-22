import Link from "next/link";
import type { ChecklistItem } from "@/lib/socialflow/onboarding/checklistRepository";

export default function EmpresaChecklist({
  items,
  completedCount,
  totalCount,
}: {
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
}) {
  const allDone = totalCount > 0 && completedCount === totalCount;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <section className="rounded-2xl border border-[#e5e7eb] bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#111827]">Primeros pasos</p>
          <p className="mt-0.5 text-[11px] text-[#6b7280]">{completedCount}/{totalCount} tareas completadas</p>
        </div>
        <span className="text-2xl font-black text-[#3b82f6]">{pct}%</span>
      </div>

      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-[#e5e7eb]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {allDone ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700">
          ¡Tu negocio está listo para publicar con IA! 🎉
        </div>
      ) : (
        <ul className="divide-y divide-[#e5e7eb]">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 bg-[#f9fafb] px-4 py-3.5 first:rounded-t-xl last:rounded-b-xl">
              <div className="flex items-start gap-3">
                {item.completed ? (
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#16a34a]">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
                    </svg>
                  </span>
                ) : (
                  <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-[#3b82f6]" aria-hidden="true" />
                )}
                <div>
                  <p className="text-sm font-semibold text-[#111827]">{item.label}</p>
                  <p className="mt-0.5 text-xs text-[#6b7280]">{item.description}</p>
                </div>
              </div>
              {!item.completed && (
                <Link
                  href={item.href}
                  className="inline-flex shrink-0 items-center rounded-xl border border-[#3b82f6] bg-transparent px-4 py-2 text-xs font-semibold text-[#3b82f6] transition hover:bg-[#3b82f6]/5"
                >
                  Completar →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
