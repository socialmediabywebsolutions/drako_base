import type { SocialFlowPlanCode } from "@/lib/socialflow/billing/plans";

type MetricsSource = {
  overview: {
    connectedAccounts: number;
    activeCampaigns: number;
    scheduledPostsThisWeek: number;
    publishedPostsLast30Days: number;
    engagementLast30Days: number;
  };
  analytics: {
    last30Days: {
      impressions: number;
      leadsGenerated: number;
      averageEngagementPerPublishedPost: number;
    };
  };
};

type Metric = { label: string; value: string; hint: string; accent: string };

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-ES").format(Math.round(value));
}

function analyticsValue(value: number): string {
  return value === 0 ? "—" : formatNumber(value);
}

function buildMetrics(
  planCode: SocialFlowPlanCode,
  summary: MetricsSource,
  auditScore: number | null,
): Metric[] {
  if (
    planCode === "influencer_pro"
    || planCode === "influencer_elite"
    || planCode === "empresa_pro"
    || planCode === "empresa_elite"
  ) {
    return [
      { label: "Leads (30 días)",       value: analyticsValue(summary.analytics.last30Days.leadsGenerated),              hint: "Generados por tus publicaciones",            accent: "from-violet-500 to-purple-600" },
      { label: "Impresiones (30 días)", value: analyticsValue(summary.analytics.last30Days.impressions),                  hint: "Alcance total de tu contenido",              accent: "from-fuchsia-500 to-pink-600" },
      { label: "Engagement / post",     value: analyticsValue(summary.analytics.last30Days.averageEngagementPerPublishedPost), hint: "Promedio de interacciones por publicación", accent: "from-blue-500 to-indigo-600" },
      { label: "Reputación online",     value: auditScore !== null ? `${auditScore}/100` : "—",                          hint: "Score de tu última auditoría social",        accent: "from-cyan-400 to-blue-500" },
    ];
  }

  return [
    { label: "Programadas (7 días)",  value: formatNumber(summary.overview.scheduledPostsThisWeek),     hint: "Publicaciones listas para salir",            accent: "from-violet-500 to-purple-600" },
    { label: "Publicadas (30 días)",  value: formatNumber(summary.overview.publishedPostsLast30Days),   hint: "Contenido publicado este mes",               accent: "from-fuchsia-500 to-pink-600" },
    { label: "Engagement (30 días)",  value: analyticsValue(summary.overview.engagementLast30Days),     hint: "Sin datos aún — conecta tus redes para ver métricas reales", accent: "from-blue-500 to-indigo-600" },
    { label: "Score de presencia",    value: auditScore !== null ? `${auditScore}/100` : "—",          hint: "Resultado de tu última auditoría",           accent: "from-cyan-400 to-blue-500" },
  ];
}

export default function DashboardMetrics({
  planCode,
  summary,
  auditScore,
}: {
  planCode: SocialFlowPlanCode;
  summary: MetricsSource;
  auditScore: number | null;
}) {
  const metrics = buildMetrics(planCode, summary, auditScore);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-2xl border border-white/8 bg-white/5 p-5 transition hover:border-white/12 hover:bg-white/8"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
            {metric.label}
          </p>
          <p className={`mt-2 bg-gradient-to-r ${metric.accent} bg-clip-text text-3xl font-black text-transparent`}>
            {metric.value}
          </p>
          <p className="mt-1.5 text-xs text-white/30">{metric.hint}</p>
        </div>
      ))}
    </div>
  );
}
