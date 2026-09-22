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
    <section className="rounded-2xl border border-white/[0.07] bg-[#0d0d1a] p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white/90">Primeros pasos</p>
          <p className="mt-0.5 text-[11px] text-white/35">{completedCount}/{totalCount} tareas completadas</p>
        </div>
        <span className="text-2xl font-black text-[#6c47ff]">{pct}%</span>
      </div>

      <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#6c47ff] to-cyan-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {allDone ? (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-center text-sm font-semibold text-emerald-300">
          ¡Tu negocio está listo para publicar con IA! 🎉
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.07]">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                {item.completed ? (
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.8 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
                    </svg>
                  </span>
                ) : (
                  <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-dashed border-[#6c47ff]/50" aria-hidden="true" />
                )}
                <div>
                  <p className={`text-sm font-semibold ${item.completed ? "text-white/60" : "text-white/90"}`}>{item.label}</p>
                  <p className="mt-0.5 text-xs text-white/40">{item.description}</p>
                </div>
              </div>
              {!item.completed && (
                <Link
                  href={item.href}
                  className="inline-flex shrink-0 items-center rounded-xl border border-[#6c47ff]/30 bg-[#6c47ff]/10 px-4 py-2 text-xs font-semibold text-violet-300 transition hover:bg-[#6c47ff]/20"
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
