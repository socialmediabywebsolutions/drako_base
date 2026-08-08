import Link from "next/link";
import type { IntelligenceFeedItem, IntelligenceFeedPriority } from "@/lib/socialflow/intelligence/types";

// Solo lectura, a propósito — sin botones Leído/Descartar. Esas acciones mutan
// socialflow_intelligence_feed y viven únicamente en IntelligenceFeedPanel (dashboard),
// para no tener dos superficies mutando las mismas filas de forma independiente.
// Marcar/descartar una tarjeta se hace desde el dashboard; aquí solo se muestra.

const PRIORITY_STYLE: Record<IntelligenceFeedPriority, string> = {
  high: "border-red-500/30 bg-red-500/10 text-red-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  low: "border-white/15 bg-white/5 text-white/45",
};

type Props = {
  title: string;
  description: string;
  icon: string;
  items: IntelligenceFeedItem[];
  emptyMessage: string;
};

export default function IntelligenceFeedSection({ title, description, icon, items, emptyMessage }: Props) {
  return (
    <section className="rounded-2xl border border-white/8 bg-white/4 p-6">
      <div className="mb-5">
        <h2 className="text-base font-bold text-white">
          <span className="mr-1.5">{icon}</span>
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-white/35">{description}</p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-white/35">{emptyMessage}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-white/6 bg-white/3 p-3">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PRIORITY_STYLE[item.priority]}`}
                >
                  {item.priority}
                </span>
              </div>
              <p className="text-sm font-semibold leading-snug text-white">{item.title}</p>
              <p className="text-xs leading-relaxed text-white/45">{item.description}</p>
              {item.actionHref && (
                <Link href={item.actionHref} className="text-xs font-semibold text-violet-400 transition-colors hover:text-violet-300">
                  {item.actionLabel ?? "Ver más"} →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
