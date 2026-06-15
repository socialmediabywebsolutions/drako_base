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

type Metric = { label: string; value: string; hint: string };

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-ES").format(Math.round(value));
}

function buildMetrics(planCode: SocialFlowPlanCode, summary: MetricsSource, auditScore: number | null): Metric[] {
  if (planCode === "pro") {
    return [
      { label: "Leads (30 dias)", value: formatNumber(summary.analytics.last30Days.leadsGenerated), hint: "Generados por tus publicaciones" },
      { label: "Impresiones (30 dias)", value: formatNumber(summary.analytics.last30Days.impressions), hint: "Alcance total de tu contenido" },
      { label: "Engagement / post", value: formatNumber(summary.analytics.last30Days.averageEngagementPerPublishedPost), hint: "Promedio de interacciones por publicacion" },
      { label: "Reputacion online", value: auditScore !== null ? `${auditScore}/100` : "-", hint: "Score de tu ultima auditoria social" },
    ];
  }

  return [
    { label: "Programadas (7 dias)", value: formatNumber(summary.overview.scheduledPostsThisWeek), hint: "Publicaciones listas para salir" },
    { label: "Publicadas (30 dias)", value: formatNumber(summary.overview.publishedPostsLast30Days), hint: "Contenido publicado este mes" },
    { label: "Engagement (30 dias)", value: formatNumber(summary.overview.engagementLast30Days), hint: "Likes, comentarios y shares acumulados" },
    { label: "Score de presencia", value: auditScore !== null ? `${auditScore}/100` : "-", hint: "Resultado de tu ultima auditoria" },
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
        <div key={metric.label} className="rounded-3xl border-2 border-sky-100 bg-white p-5 shadow-md">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-600">{metric.label}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{metric.value}</p>
          <p className="mt-1 text-xs text-slate-400">{metric.hint}</p>
        </div>
      ))}
    </div>
  );
}
