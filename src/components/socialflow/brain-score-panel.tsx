import type { BrainScore } from "@/lib/socialflow/knowledge/brain-score";

function scoreColors(total: number): { text: string; bar: string } {
  if (total <= 40) return { text: "text-rose-600", bar: "from-rose-500 to-red-600" };
  if (total <= 70) return { text: "text-amber-600", bar: "from-amber-500 to-yellow-500" };
  return { text: "text-emerald-600", bar: "from-emerald-500 to-green-500" };
}

export default function BrainScorePanel({ score }: { score: BrainScore }) {
  const colors = scoreColors(score.total);
  const visibleMissing = score.missing.slice(0, 3);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-600">
            Score de Mi Cerebro IA
          </p>
          <p className={`mt-2 text-4xl font-black tracking-tight ${colors.text}`}>
            {score.total}
            <span className="text-lg font-bold text-gray-400">/100</span>
          </p>
        </div>
        <div className="flex gap-5 text-right">
          <div>
            <p className="text-sm font-bold text-gray-600">{score.kbScore}/50</p>
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Base de conocimiento</p>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-600">{score.profileScore}/50</p>
            <p className="text-[10px] uppercase tracking-wide text-gray-400">Perfil de marca</p>
          </div>
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colors.bar} transition-all`}
          style={{ width: `${Math.min(100, Math.max(0, score.total))}%` }}
        />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {score.cards.map((card) => (
          <div
            key={card.key}
            className={`rounded-xl border p-4 ${
              card.complete ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-gray-50"
            }`}
          >
            <p className="text-lg">{card.complete ? "✅" : "⚠️"}</p>
            <p className="mt-1 text-sm font-semibold text-gray-700">{card.label}</p>
            <p className="mt-0.5 text-xs text-gray-400">{card.complete ? "Completo" : "Falta"}</p>
          </div>
        ))}
      </div>

      {visibleMissing.length > 0 && (
        <div className="mt-6 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sugerencias</p>
          <ul className="space-y-1.5">
            {visibleMissing.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="mt-0.5 text-blue-500">→</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
