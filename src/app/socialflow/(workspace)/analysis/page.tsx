import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import {
  getSocialAnalyticsSnapshot,
  listSaasSocialPosts,
  resolveSocialContext,
} from "@/lib/socialflow/repository";
import { listLeads } from "@/lib/socialflow/leads/repository";
import { listConversationThreads } from "@/lib/socialflow/conversational/repository";
import type { SocialAnalyticsWindow } from "@/lib/social-core/types";
import type { SocialFlowLead } from "@/lib/socialflow/leads/types";
import type { ConversationThread } from "@/lib/socialflow/conversational/types";
import type { SaasSocialPost } from "@/lib/social-core/types";

const SAAS_ID = "socialflow";

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function pct(n: number): string {
  return n.toFixed(1) + "%";
}

function delta(a: number, b: number): { sign: "+" | "-" | "="; value: string; up: boolean } {
  if (b === 0) return { sign: "=", value: "—", up: false };
  const diff = ((a - b) / b) * 100;
  const sign = diff > 0 ? "+" : diff < 0 ? "-" : "=";
  return { sign, value: Math.abs(diff).toFixed(0) + "%", up: diff >= 0 };
}

const PROVIDER_LABEL: Record<string, string> = {
  INSTAGRAM: "IG",
  FACEBOOK: "FB",
  TIKTOK: "TT",
  OTHER: "?",
};

const PROVIDER_COLOR: Record<string, string> = {
  INSTAGRAM: "bg-pink-100 text-pink-700",
  FACEBOOK: "bg-blue-100 text-blue-700",
  TIKTOK: "bg-slate-100 text-slate-700",
  OTHER: "bg-slate-100 text-slate-500",
};

function DeltaBadge({ now, before }: { now: number; before: number }) {
  const d = delta(now, before);
  if (d.sign === "=") return null;
  return (
    <span
      className={`ml-1.5 text-[10px] font-semibold tracking-wide ${d.up ? "text-emerald-600" : "text-rose-500"}`}
    >
      {d.sign}
      {d.value} vs 7d
    </span>
  );
}

function KpiCard({
  label,
  value30,
  value7,
  sub,
}: {
  label: string;
  value30: number;
  value7: number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-2xl font-black tracking-tight text-slate-950">{fmt(value30)}</span>
        <DeltaBadge now={value30} before={value7} />
      </div>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

function StatBubble({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`flex flex-col items-center rounded-lg px-4 py-3 ${color}`}>
      <span className="text-xl font-black">{fmt(value)}</span>
      <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-70">
        {label}
      </span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{children}</h2>
  );
}

export default async function SocialFlowAnalysisPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId: SAAS_ID });

  const [snapshot, posts, leads, threads] = await Promise.all([
    getSocialAnalyticsSnapshot(ctx),
    listSaasSocialPosts(ctx),
    listLeads(ctx, { limit: 200 }),
    listConversationThreads(ctx, { limit: 200 }),
  ]);

  const w30: SocialAnalyticsWindow = snapshot.last30Days;
  const w7: SocialAnalyticsWindow = snapshot.last7Days;

  const engagement30 = w30.likes + w30.comments + w30.shares;
  const engagement7 = w7.likes + w7.comments + w7.shares;
  const engRate30 = w30.impressions > 0 ? (engagement30 / w30.impressions) * 100 : 0;

  // Conversation stats
  const totalThreads = threads.length;
  const pendingThreads = threads.filter((t: ConversationThread) => t.status === "PENDING").length;
  const needsHumanThreads = threads.filter(
    (t: ConversationThread) => t.status === "NEEDS_HUMAN",
  ).length;
  const sentThreads = threads.filter((t: ConversationThread) => t.status === "SENT").length;
  const approvedThreads = threads.filter(
    (t: ConversationThread) => t.status === "AUTO_APPROVED" || t.status === "APPROVED",
  ).length;
  const dismissedThreads = threads.filter(
    (t: ConversationThread) => t.status === "DISMISSED",
  ).length;

  // Lead stats
  const hotLeads = leads.filter((l: SocialFlowLead) => l.temperature === "HOT").length;
  const warmLeads = leads.filter((l: SocialFlowLead) => l.temperature === "WARM").length;
  const coldLeads = leads.filter((l: SocialFlowLead) => l.temperature === "COLD").length;
  const convertedLeads = leads.filter((l: SocialFlowLead) => l.status === "CONVERTED").length;
  const lostLeads = leads.filter((l: SocialFlowLead) => l.status === "LOST").length;
  const activeLeads = leads.filter(
    (l: SocialFlowLead) => l.status === "NEW" || l.status === "CONTACTED",
  ).length;
  const conversionRate =
    leads.length > 0 ? ((convertedLeads / leads.length) * 100).toFixed(0) : "0";

  // Published posts (last 20, sorted by postedAt desc)
  const publishedPosts = posts
    .filter((p: SaasSocialPost) => p.status === "POSTED" || p.status === "PUBLISHED")
    .sort((a: SaasSocialPost, b: SaasSocialPost) =>
      (b.postedAt ?? b.updatedAt).localeCompare(a.postedAt ?? a.updatedAt),
    )
    .slice(0, 15);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">
          SocialFlow · Analytics
        </p>
        <h1 className="mt-1.5 text-2xl font-black tracking-tight text-slate-950">Análisis</h1>
        <p className="mt-1.5 max-w-xl text-sm text-slate-500">
          Rendimiento de contenido, engagement y conversiones — últimos 30 días vs 7 días.
          {w30.topProvider && (
            <span className="ml-1 font-semibold text-slate-700">
              Canal líder: {PROVIDER_LABEL[w30.topProvider] ?? w30.topProvider}.
            </span>
          )}
        </p>
      </div>

      {/* KPI Cards */}
      <section className="space-y-3">
        <SectionHeading>KPIs — 30 días</SectionHeading>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Impresiones" value30={w30.impressions} value7={w7.impressions} />
          <KpiCard
            label="Engagement"
            value30={engagement30}
            value7={engagement7}
            sub={`Tasa: ${pct(engRate30)}`}
          />
          <KpiCard
            label="Leads detectados"
            value30={w30.leadsGenerated}
            value7={w7.leadsGenerated}
          />
          <KpiCard
            label="Posts publicados"
            value30={w30.publishedPosts}
            value7={w7.publishedPosts}
            sub={
              w30.averageEngagementPerPublishedPost > 0
                ? `Avg ${fmt(Math.round(w30.averageEngagementPerPublishedPost))} eng/post`
                : undefined
            }
          />
        </div>
      </section>

      {/* Engagement breakdown */}
      <section className="space-y-3">
        <SectionHeading>Desglose de engagement — 30 días</SectionHeading>
        <div className="flex flex-wrap gap-2">
          <StatBubble label="Likes" value={w30.likes} color="bg-rose-50 text-rose-700" />
          <StatBubble label="Comentarios" value={w30.comments} color="bg-sky-50 text-sky-700" />
          <StatBubble label="Shares" value={w30.shares} color="bg-violet-50 text-violet-700" />
          <StatBubble label="Clicks" value={w30.clicks} color="bg-amber-50 text-amber-700" />
        </div>
      </section>

      {/* Conversations */}
      <section className="space-y-3">
        <SectionHeading>Conversaciones ({totalThreads})</SectionHeading>
        {totalThreads === 0 ? (
          <p className="text-sm text-slate-400">
            Sin conversaciones registradas aún. El cron procesará comentarios de Instagram cada 15
            min.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <StatBubble
              label="Pendientes"
              value={pendingThreads}
              color="bg-amber-50 text-amber-700"
            />
            <StatBubble
              label="Necesita revisión"
              value={needsHumanThreads}
              color="bg-rose-50 text-rose-700"
            />
            <StatBubble label="Enviados" value={sentThreads} color="bg-emerald-50 text-emerald-700" />
            <StatBubble
              label="Aprobados"
              value={approvedThreads}
              color="bg-sky-50 text-sky-700"
            />
            <StatBubble
              label="Descartados"
              value={dismissedThreads}
              color="bg-slate-100 text-slate-500"
            />
          </div>
        )}
      </section>

      {/* Leads */}
      <section className="space-y-3">
        <SectionHeading>
          Pipeline de leads ({leads.length}) · conversión {conversionRate}%
        </SectionHeading>
        {leads.length === 0 ? (
          <p className="text-sm text-slate-400">
            Sin leads detectados aún. Los leads se capturan automáticamente desde conversaciones.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <StatBubble label="HOT" value={hotLeads} color="bg-rose-100 text-rose-700" />
            <StatBubble label="WARM" value={warmLeads} color="bg-amber-50 text-amber-700" />
            <StatBubble label="COLD" value={coldLeads} color="bg-sky-50 text-sky-600" />
            <div className="mx-1 w-px self-stretch bg-slate-200" />
            <StatBubble label="Activos" value={activeLeads} color="bg-slate-100 text-slate-600" />
            <StatBubble
              label="Convertidos"
              value={convertedLeads}
              color="bg-emerald-50 text-emerald-700"
            />
            <StatBubble label="Perdidos" value={lostLeads} color="bg-slate-100 text-slate-400" />
          </div>
        )}
      </section>

      {/* Published posts */}
      <section className="space-y-3">
        <SectionHeading>Posts publicados recientes ({publishedPosts.length})</SectionHeading>
        {publishedPosts.length === 0 ? (
          <p className="text-sm text-slate-400">Sin posts publicados registrados aún.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Título
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Canal
                  </th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                    Publicado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {publishedPosts.map((post: SaasSocialPost) => {
                  const date = post.postedAt ?? post.updatedAt;
                  const dateLabel = date ? new Date(date).toLocaleDateString("es-MX", { month: "short", day: "numeric" }) : "—";
                  const providerColor = PROVIDER_COLOR[post.provider] ?? PROVIDER_COLOR.OTHER;
                  const providerLabel = PROVIDER_LABEL[post.provider] ?? post.provider;
                  return (
                    <tr key={post.id} className="hover:bg-slate-50">
                      <td className="max-w-[280px] truncate px-4 py-2.5 font-medium text-slate-800">
                        {post.title || post.body?.slice(0, 60) || "Sin título"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${providerColor}`}
                        >
                          {providerLabel}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-[11px] text-slate-400">
                        {dateLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
