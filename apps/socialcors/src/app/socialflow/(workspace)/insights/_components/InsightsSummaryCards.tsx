import type { SocialInsightsSnapshot } from "@/lib/social-core/types";

type Card = { label: string; value: string; hint: string; accent: string };

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-ES").format(Math.round(value));
}

function formatSigned(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${formatNumber(rounded)}`;
}

export default function InsightsSummaryCards({ summary }: { summary: SocialInsightsSnapshot["summary"] }) {
  const cards: Card[] = [
    { label: "Alcance (30 días)", value: formatNumber(summary.reach30d), hint: "Cuentas únicas alcanzadas por tu contenido", accent: "from-[#3b82f6] to-[#06b6d4]" },
    { label: "Guardados (30 días)", value: formatNumber(summary.saved30d), hint: "Veces que guardaron tus publicaciones", accent: "from-[#3b82f6] to-[#06b6d4]" },
    { label: "Plays de Reels (30 días)", value: formatNumber(summary.plays30d), hint: "Reproducciones totales de tus Reels", accent: "from-[#06b6d4] to-[#3b82f6]" },
    { label: "Engagement rate", value: summary.reach30d > 0 ? `${(summary.engagementRate * 100).toFixed(1)}%` : "—", hint: "(likes + comentarios + guardados) / alcance", accent: "from-cyan-400 to-blue-500" },
    { label: "Seguidores actuales", value: summary.currentFollowers !== null ? formatNumber(summary.currentFollowers) : "—", hint: "Última lectura sincronizada de Instagram", accent: "from-emerald-400 to-teal-500" },
    { label: "Crecimiento este mes", value: summary.followerGrowthThisMonth !== null ? formatSigned(summary.followerGrowthThisMonth) : "—", hint: "Seguidores ganados en los últimos 30 días", accent: "from-amber-400 to-orange-500" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
            {card.label}
          </p>
          <p className={`mt-2 bg-gradient-to-r ${card.accent} bg-clip-text text-3xl font-black text-transparent`}>
            {card.value}
          </p>
          <p className="mt-1.5 text-xs text-gray-400">{card.hint}</p>
        </div>
      ))}
    </div>
  );
}
