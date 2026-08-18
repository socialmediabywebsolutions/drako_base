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

type Metric = { label: string; value: string; hint: string; color: string; shadowClass: string };

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-ES").format(Math.round(value));
}

function analyticsValue(value: number): string {
  return value === 0 ? "—" : formatNumber(value);
}

// Paleta de marca fija por posición (0=morado, 1=rosa IG, 2=turquesa, 3=azul LI) —
// mismos hex que landing-client.tsx (ACCENT_SOFT/IG_PINK/ACCENT2/LI_BLUE), reutilizados
// aquí para que el panel de métricas del dashboard hable el mismo lenguaje visual.
const METRIC_COLORS = ["#6D5DFB", "#DD2A7B", "#00C2A8", "#0A66C2"];
const METRIC_SHADOW_CLASSES = [
  "hover:shadow-[0_8px_20px_rgba(109,93,251,0.35)]",
  "hover:shadow-[0_8px_20px_rgba(221,42,123,0.35)]",
  "hover:shadow-[0_8px_20px_rgba(0,194,168,0.35)]",
  "hover:shadow-[0_8px_20px_rgba(10,102,194,0.35)]",
];

function buildMetrics(
  planCode: SocialFlowPlanCode,
  summary: MetricsSource,
  auditScore: number | null,
  leadsCount: number,
): Metric[] {
  const base = planCode === "influencer_pro" || planCode === "empresa_pro"
    ? [
        { label: "Leads (30 días)",       value: analyticsValue(leadsCount),                                                     hint: "Detectados en tus comentarios y DMs" },
        { label: "Impresiones (30 días)", value: analyticsValue(summary.analytics.last30Days.impressions),                       hint: "Alcance total de tu contenido" },
        { label: "Engagement / post",     value: analyticsValue(summary.analytics.last30Days.averageEngagementPerPublishedPost), hint: "Promedio de interacciones por publicación" },
        { label: "Reputación online",     value: auditScore !== null ? `${auditScore}/100` : "—",                               hint: "Score de tu última auditoría social" },
      ]
    : [
        { label: "Programadas (7 días)",  value: formatNumber(summary.overview.scheduledPostsThisWeek),   hint: "Publicaciones listas para salir" },
        { label: "Publicadas (30 días)",  value: formatNumber(summary.overview.publishedPostsLast30Days), hint: "Contenido publicado este mes" },
        { label: "Engagement (30 días)",  value: analyticsValue(summary.overview.engagementLast30Days),   hint: "Sin datos aún — conecta tus redes para ver métricas reales" },
        { label: "Score de presencia",    value: auditScore !== null ? `${auditScore}/100` : "—",         hint: "Resultado de tu última auditoría" },
      ];

  return base.map((metric, i) => ({ ...metric, color: METRIC_COLORS[i], shadowClass: METRIC_SHADOW_CLASSES[i] }));
}

export default function DashboardMetrics({
  planCode,
  summary,
  auditScore,
  leadsCount,
}: {
  planCode: SocialFlowPlanCode;
  summary: MetricsSource;
  auditScore: number | null;
  leadsCount: number;
}) {
  const metrics = buildMetrics(planCode, summary, auditScore, leadsCount);

  return (
    <div className="grid grid-cols-4 gap-2">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className={`transition-all duration-300 hover:-translate-y-0.5 ${metric.shadowClass}`}
          style={{ borderRadius: 8, padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: `1.5px solid ${metric.color}` }}
        >
          <p style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#64748b" }}>
            {metric.label}
          </p>
          <p style={{ marginTop: 2, fontSize: 24, fontWeight: 800, color: metric.color }}>
            {metric.value}
          </p>
          <p style={{ marginTop: 2, fontSize: 8, color: "#94a3b8" }}>{metric.hint}</p>
        </div>
      ))}
    </div>
  );
}
