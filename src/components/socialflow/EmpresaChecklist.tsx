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
    <div className="rounded-2xl border border-white/10 bg-white/4 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white/90">Primeros pasos</p>
          <p className="text-xs text-white/40">{completedCount}/{totalCount} tareas completadas</p>
        </div>
        <span className="text-2xl font-black text-violet-400">{pct}%</span>
      </div>

      <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {allDone ? (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-center text-sm font-semibold text-emerald-300">
          ¡Tu negocio está listo para publicar con IA! 🎉
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/4 p-4"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-lg">{item.completed ? "✅" : "⭕"}</span>
                <div>
                  <p className="text-sm font-semibold text-white/85">{item.label}</p>
                  <p className="mt-0.5 text-xs text-white/40">{item.description}</p>
                </div>
              </div>
              {!item.completed && (
                <Link
                  href={item.href}
                  className="inline-flex shrink-0 items-center rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/20"
                >
                  Completar →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
