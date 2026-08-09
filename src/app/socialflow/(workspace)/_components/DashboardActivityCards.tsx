import { Image as ImageIcon, Film, BookOpen, LayoutGrid, Heart, MessageCircle, Users } from "lucide-react";
import type { SocialActivitySummary } from "@/lib/social-core/types";

type ActivityCard = { label: string; value: string; hint: string; icon: typeof ImageIcon; accent: string };

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-ES").format(Math.round(value));
}

function buildCards(activity: SocialActivitySummary): ActivityCard[] {
  return [
    { label: "Posts",       value: formatNumber(activity.postsThisMonth.FEED),     hint: "Publicados este mes", icon: ImageIcon,     accent: "from-blue-500 to-indigo-600" },
    { label: "Reels",       value: formatNumber(activity.postsThisMonth.REEL),     hint: "Publicados este mes", icon: Film,          accent: "from-green-500 to-emerald-600" },
    { label: "Historias",   value: formatNumber(activity.postsThisMonth.STORY),    hint: "Publicadas este mes", icon: BookOpen,      accent: "from-amber-500 to-orange-600" },
    { label: "Carruseles",  value: formatNumber(activity.postsThisMonth.CAROUSEL), hint: "Publicados este mes", icon: LayoutGrid,    accent: "from-purple-500 to-fuchsia-600" },
    { label: "Likes",       value: formatNumber(activity.totalLikesThisMonth),     hint: "Acumulados este mes", icon: Heart,         accent: "from-pink-500 to-rose-600" },
    { label: "Comentarios", value: formatNumber(activity.totalCommentsThisMonth),  hint: "Acumulados este mes", icon: MessageCircle, accent: "from-cyan-500 to-sky-600" },
    { label: "Seguidores",  value: activity.currentFollowers !== null ? formatNumber(activity.currentFollowers) : "—", hint: "Total actual", icon: Users, accent: "from-violet-500 to-purple-600" },
  ];
}

export default function DashboardActivityCards({ activity }: { activity: SocialActivitySummary }) {
  const cards = buildCards(activity);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-2xl border border-white/8 bg-white/5 p-5 transition hover:border-white/12 hover:bg-white/8"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">{card.label}</p>
              <div className={`rounded-lg bg-gradient-to-r ${card.accent} p-1.5`}>
                <Icon size={14} className="text-white" />
              </div>
            </div>
            <p className={`mt-2 bg-gradient-to-r ${card.accent} bg-clip-text text-3xl font-black text-transparent`}>
              {card.value}
            </p>
            <p className="mt-1.5 text-xs text-white/30">{card.hint}</p>
          </div>
        );
      })}
    </div>
  );
}
