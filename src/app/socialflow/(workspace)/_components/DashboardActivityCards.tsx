import type { SocialActivitySummary } from "@/lib/social-core/types";

type ActivityCard = { label: string; value: string; hint: string; color: string; shadowClass: string };

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-ES").format(Math.round(value));
}

function buildCards(activity: SocialActivitySummary): ActivityCard[] {
  return [
    { label: "Posts",       value: formatNumber(activity.postsThisMonth.FEED),     hint: "Publicados este mes", color: "#DD2A7B", shadowClass: "hover:shadow-[0_8px_20px_rgba(221,42,123,0.35)]" },
    { label: "Reels",       value: formatNumber(activity.postsThisMonth.REEL),     hint: "Publicados este mes", color: "#6D5DFB", shadowClass: "hover:shadow-[0_8px_20px_rgba(109,93,251,0.35)]" },
    { label: "Historias",   value: formatNumber(activity.postsThisMonth.STORY),    hint: "Publicadas este mes", color: "#00C2A8", shadowClass: "hover:shadow-[0_8px_20px_rgba(0,194,168,0.35)]" },
    { label: "Carruseles",  value: formatNumber(activity.postsThisMonth.CAROUSEL), hint: "Publicados este mes", color: "#0A66C2", shadowClass: "hover:shadow-[0_8px_20px_rgba(10,102,194,0.35)]" },
    { label: "Likes",       value: formatNumber(activity.totalLikesThisMonth),     hint: "Acumulados este mes", color: "#DD2A7B", shadowClass: "hover:shadow-[0_8px_20px_rgba(221,42,123,0.35)]" },
    { label: "Comentarios", value: formatNumber(activity.totalCommentsThisMonth),  hint: "Acumulados este mes", color: "#6D5DFB", shadowClass: "hover:shadow-[0_8px_20px_rgba(109,93,251,0.35)]" },
    { label: "Seguidores",  value: activity.currentFollowers !== null ? formatNumber(activity.currentFollowers) : "—", hint: "Total actual", color: "#00C2A8", shadowClass: "hover:shadow-[0_8px_20px_rgba(0,194,168,0.35)]" },
  ];
}

export default function DashboardActivityCards({ activity }: { activity: SocialActivitySummary }) {
  const cards = buildCards(activity);

  return (
    <div className="grid grid-cols-7 gap-2">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`transition-all duration-300 hover:-translate-y-0.5 ${card.shadowClass}`}
          style={{ borderRadius: 8, padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: `1.5px solid ${card.color}` }}
        >
          <p style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#64748b" }}>
            {card.label}
          </p>
          <p style={{ marginTop: 2, fontSize: 24, fontWeight: 800, color: card.color }}>
            {card.value}
          </p>
          <p style={{ marginTop: 2, fontSize: 8, color: "#94a3b8" }}>{card.hint}</p>
        </div>
      ))}
    </div>
  );
}
